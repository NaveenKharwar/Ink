/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { docToPlainText, ydocToEditorDoc, type EditorDoc } from "@ink/schemas";
import { getSchema } from "@tiptap/core";
import { prosemirrorJSONToYDoc, yXmlFragmentToProseMirrorRootNode } from "@tiptap/y-tiptap";
import { writingExtensions } from "./extensions.ts";

// The server reads the piece straight from Yjs (no editor code). This checks that what the
// editor's own Yjs binding writes is read back as the same document.
const schema = getSchema(writingExtensions);

const doc: EditorDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Monsoon" }] },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "the rain remembers", marks: [{ type: "italic" }] }] }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "\tपिता के हाथों में" },
        { type: "hardBreak" },
        { type: "text", text: "लोहे की ", marks: [{ type: "bold" }] },
        { type: "text", text: "गंध थी," }
      ]
    },
    { type: "horizontalRule" },
    { type: "paragraph", content: [{ type: "text", text: "Yaar, aaj phir chai thandi ho gayi." }] }
  ]
};

test("the editor's Yjs data reads back as the same JSON on the server", () => {
  const ydoc = prosemirrorJSONToYDoc(schema, doc, "default");
  const back = ydocToEditorDoc(ydoc);
  const expected = yXmlFragmentToProseMirrorRootNode(ydoc.getXmlFragment("default"), schema).toJSON();
  // Compared as JSON: Yjs hands back its attributes as plain objects of a different kind.
  assert.deepEqual(JSON.parse(JSON.stringify(back)), JSON.parse(JSON.stringify(expected)));
  assert.equal(
    docToPlainText(back),
    "Monsoon\n\nthe rain remembers\n\n\tपिता के हाथों में\nलोहे की गंध थी,\n\n* * *\n\nYaar, aaj phir chai thandi ho gayi."
  );
});

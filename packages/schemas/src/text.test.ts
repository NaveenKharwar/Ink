import assert from "node:assert/strict";
import { test } from "node:test";
import { docToPlainText, editorDoc } from "./index.js";

const line = (text: string) => ({ type: "text", text });
const br = { type: "hardBreak" };

test("stanzas are separated by a blank line, lines keep their breaks", () => {
  const doc = {
    type: "doc" as const,
    content: [
      { type: "paragraph", content: [line("The kettle clicks off"), br, line("and for a second the house")] },
      { type: "paragraph", content: [line("A little bit of steam,")] }
    ]
  };
  assert.equal(docToPlainText(doc), "The kettle clicks off\nand for a second the house\n\nA little bit of steam,");
});

test("keeps Devanagari and marks' text exactly", () => {
  const doc = {
    type: "doc" as const,
    content: [{ type: "paragraph", content: [{ type: "text", text: "पिता के हाथों में", marks: [{ type: "bold" }] }, br, line("लोहे की गंध थी,")] }]
  };
  assert.equal(docToPlainText(doc), "पिता के हाथों में\nलोहे की गंध थी,");
});

test("lists become one line per item", () => {
  const item = (text: string) => ({ type: "listItem", content: [{ type: "paragraph", content: [line(text)] }] });
  const doc = {
    type: "doc" as const,
    content: [
      { type: "bulletList", content: [item("rain"), item("chai")] },
      { type: "orderedList", attrs: { start: 3 }, content: [item("one"), item("two")] }
    ]
  };
  assert.equal(docToPlainText(doc), "- rain\n- chai\n\n3. one\n4. two");
});

test("an empty document is empty text", () => {
  assert.equal(docToPlainText({ type: "doc" }), "");
  assert.equal(docToPlainText({ type: "doc", content: [{ type: "paragraph" }] }), "");
});

test("editorDoc accepts a normal document and rejects a non-doc root", () => {
  assert.equal(editorDoc.safeParse({ type: "doc", content: [{ type: "paragraph", content: [line("hi")] }] }).success, true);
  assert.equal(editorDoc.safeParse({ type: "paragraph" }).success, false);
});

test("editorDoc rejects very deep nesting without overflowing the stack", () => {
  let node: Record<string, unknown> = { type: "text", text: "x" };
  for (let i = 0; i < 100_000; i++) node = { type: "blockquote", content: [node] };
  const result = editorDoc.safeParse({ type: "doc", content: [node] });
  assert.equal(result.success, false);
});

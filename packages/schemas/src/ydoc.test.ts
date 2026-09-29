import assert from "node:assert/strict";
import { test } from "node:test";
import * as Y from "yjs";
import { docToPlainText } from "./text.js";
import { fromBase64, toBase64 } from "./bytes.js";
import { ydocToEditorDoc, ydocToMeta } from "./ydoc.js";

// Builds a document the way the editor's Yjs binding stores it.
function build() {
  const ydoc = new Y.Doc();
  const f = ydoc.getXmlFragment("default");
  const heading = new Y.XmlElement("heading");
  f.push([heading]);
  heading.setAttribute("level", 1 as never);
  const ht = new Y.XmlText();
  heading.push([ht]);
  ht.insert(0, "Monsoon");

  const quote = new Y.XmlElement("blockquote");
  f.push([quote]);
  const qp = new Y.XmlElement("paragraph");
  quote.push([qp]);
  const qt = new Y.XmlText();
  qp.push([qt]);
  qt.insert(0, "the rain remembers", { italic: {} });

  const p = new Y.XmlElement("paragraph");
  f.push([p]);
  const t = new Y.XmlText();
  p.push([t]);
  t.insert(0, "first line");
  p.push([new Y.XmlElement("hardBreak")]);
  const t2 = new Y.XmlText();
  p.push([t2]);
  t2.insert(0, "दूसरी पंक्ति", { bold: {} });

  f.push([new Y.XmlElement("horizontalRule")]);
  return ydoc;
}

test("a Yjs document reads back as the editor's JSON", () => {
  const doc = ydocToEditorDoc(build());
  assert.deepEqual(doc.content?.[0], { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Monsoon" }] });
  assert.deepEqual(doc.content?.[1]?.content?.[0]?.content?.[0], { type: "text", text: "the rain remembers", marks: [{ type: "italic" }] });
  assert.deepEqual(doc.content?.[2]?.content?.map((n) => n.type), ["text", "hardBreak", "text"]);
  assert.deepEqual(doc.content?.[2]?.content?.[2]?.marks, [{ type: "bold" }]);
  assert.equal(doc.content?.[3]?.type, "horizontalRule");
});

test("plain text comes out with stanzas, lines and the scene break", () => {
  assert.equal(docToPlainText(ydocToEditorDoc(build())), "Monsoon\n\nthe rain remembers\n\nfirst line\nदूसरी पंक्ति\n\n* * *");
});

test("an empty document is an empty doc", () => {
  assert.deepEqual(ydocToEditorDoc(new Y.Doc()), { type: "doc" });
});

test("the result is the same after the bytes travel and merge", () => {
  const copy = new Y.Doc();
  Y.applyUpdate(copy, fromBase64(toBase64(Y.encodeStateAsUpdate(build()))));
  assert.deepEqual(ydocToEditorDoc(copy), ydocToEditorDoc(build()));
});

test("title and language are read from the meta map", () => {
  const ydoc = new Y.Doc();
  const meta = ydoc.getMap("meta");
  meta.set("title", "  Kettle  ");
  meta.set("language", "hi");
  assert.deepEqual(ydocToMeta(ydoc), { title: "Kettle", language: "hi" });
});

test("missing or invalid settings read as empty", () => {
  assert.deepEqual(ydocToMeta(new Y.Doc()), { title: null, language: null });
  const ydoc = new Y.Doc();
  const meta = ydoc.getMap("meta");
  meta.set("title", 42);
  meta.set("language", "klingon");
  assert.deepEqual(ydocToMeta(ydoc), { title: null, language: null });
  meta.set("title", "x".repeat(500));
  assert.equal(ydocToMeta(ydoc).title?.length, 200);
});

test("two devices renaming: each key merges on its own, the later edit of a key wins", () => {
  const a = new Y.Doc();
  a.getMap("meta").set("language", "en");
  const b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  a.getMap("meta").set("title", "From the laptop");
  b.getMap("meta").set("language", "hi");
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  assert.deepEqual(ydocToMeta(a), ydocToMeta(b));
  assert.deepEqual(ydocToMeta(a), { title: "From the laptop", language: "hi" });
});

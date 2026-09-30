import assert from "node:assert/strict";
import { test } from "node:test";
import * as Y from "yjs";
import { docToPlainText } from "./text.js";
import { fromBase64, toBase64 } from "./bytes.js";
import { removePictureFromYdoc, ydocPictureIds, ydocToEditorDoc, ydocToMeta } from "./ydoc.js";

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

test("title, language and style are read from the meta map", () => {
  const ydoc = new Y.Doc();
  const meta = ydoc.getMap("meta");
  meta.set("title", "  Kettle  ");
  meta.set("language", "hi");
  meta.set("style", "story");
  assert.deepEqual(ydocToMeta(ydoc), { title: "Kettle", language: "hi", style: "story" });
});

test("missing or invalid settings read as empty", () => {
  assert.deepEqual(ydocToMeta(new Y.Doc()), { title: null, language: null, style: null });
  const ydoc = new Y.Doc();
  const meta = ydoc.getMap("meta");
  meta.set("title", 42);
  meta.set("language", "klingon");
  meta.set("style", "sonnet");
  assert.deepEqual(ydocToMeta(ydoc), { title: null, language: null, style: null });
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
  assert.deepEqual(ydocToMeta(a), { title: "From the laptop", language: "hi", style: null });
});

const COVER = "3f2a9c1e-8b7d-4c6a-9e5f-1a2b3c4d5e6f";
const INLINE = "7a1d2e3f-4b5c-4d6e-8f70-81a2b3c4d5e6";
const CROP = { x: 0, y: 20, width: 100, height: 40 };

// A piece with a cover and, in a list and at the top level, pictures in its text.
function withPictures() {
  const ydoc = new Y.Doc();
  ydoc.getMap("meta").set("cover", { id: COVER, crop: CROP });
  const fragment = ydoc.getXmlFragment("default");
  const picture = (id: string) => {
    const el = new Y.XmlElement("picture");
    el.setAttribute("id", id);
    return el;
  };
  const p = new Y.XmlElement("paragraph");
  fragment.push([p, picture(INLINE)]);
  p.push([new Y.XmlText("Night trains")]);
  const list = new Y.XmlElement("bulletList");
  const item = new Y.XmlElement("listItem");
  fragment.push([list]);
  list.push([item]);
  item.push([picture(INLINE), picture(COVER)]);
  return ydoc;
}

test("a piece's pictures are its cover and the pictures in its text, each once", () => {
  assert.deepEqual(ydocPictureIds(withPictures()).sort(), [COVER, INLINE].sort());
  assert.deepEqual(ydocPictureIds(new Y.Doc()), []);
  const bad = new Y.Doc();
  bad.getMap("meta").set("cover", { id: "not-an-id", crop: CROP });
  assert.deepEqual(ydocPictureIds(bad), []);
});

test("removing a picture takes it off the cover and out of the text, and leaves the rest", () => {
  const ydoc = withPictures();
  assert.equal(removePictureFromYdoc(ydoc, INLINE), true);
  assert.deepEqual(ydocPictureIds(ydoc), [COVER]);
  assert.ok(!JSON.stringify(ydocToEditorDoc(ydoc)).includes(INLINE));
  assert.ok(docToPlainText(ydocToEditorDoc(ydoc)).startsWith("Night trains"));
  assert.equal(removePictureFromYdoc(ydoc, COVER), true);
  assert.deepEqual(ydocPictureIds(ydoc), []);
  assert.equal(ydoc.getMap("meta").get("cover"), undefined);
  assert.equal(removePictureFromYdoc(ydoc, COVER), false);
});

test("a removal made elsewhere merges into a device's copy", () => {
  const device = withPictures();
  const server = new Y.Doc();
  Y.applyUpdate(server, Y.encodeStateAsUpdate(device));
  removePictureFromYdoc(server, COVER);
  Y.applyUpdate(device, Y.encodeStateAsUpdate(server, Y.encodeStateVector(device)));
  assert.deepEqual(ydocPictureIds(device), [INLINE]);
});

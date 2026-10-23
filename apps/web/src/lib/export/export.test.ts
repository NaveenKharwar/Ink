import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExportPiece } from "@ink/schemas";
import { strFromU8, unzipSync } from "fflate";
import { fileNameOf, uniqueNamer, zipOf } from "./files";
import { toMarkdown } from "./markdown";
import { picturesOf, toExportDoc } from "./piece";

const TZ = "Asia/Kolkata";
const text = (t: string, marks?: Array<{ type: string; attrs?: Record<string, unknown> }>) => ({ type: "text", text: t, ...(marks ? { marks } : {}) });
const br = { type: "hardBreak" };
const para = (...content: object[]) => ({ type: "paragraph", content });

function piece(content: object[], extra: Partial<ExportPiece> = {}): ExportPiece {
  return {
    id: "3f0c7a52-8b1e-4d2a-9c3e-5a6b7c8d9e01",
    title: null,
    status: "draft",
    style: "poem",
    createdAt: "2025-01-03T10:00:00.000Z",
    updatedAt: "2025-02-01T10:00:00.000Z",
    content: { type: "doc", content } as ExportPiece["content"],
    cover: null,
    ...extra
  };
}

test("a poem keeps its stanzas and its lines", () => {
  const doc = toExportDoc(piece([para(text("The kettle went cold"), br, text("while I waited")), para(), para(text("for nothing at all"))]), TZ, "south-asia");
  assert.equal(doc.title, "The kettle went cold");
  assert.equal(doc.titled, false);
  assert.equal(doc.season, "Winter 2025");
  assert.equal(
    toMarkdown(doc, TZ, () => null),
    "*Winter 2025 · Poem · Draft*  \n*Written 3 January 2025*\n\nThe kettle went cold  \nwhile I waited\n\nfor nothing at all\n"
  );
});

test("a titled piece has a heading, and what Markdown would read as marks stays as written", () => {
  const doc = toExportDoc(piece([para(text("# not a heading * or a list")), para(text("2. two")), para(text("a_b [c]"))], { title: "On *stars*", status: "finished", style: "story" }), TZ, "north");
  const md = toMarkdown(doc, TZ, () => null);
  assert.ok(md.startsWith("# On \\*stars\\*\n\n*Winter 2025 · Story · Finished*"));
  assert.ok(md.includes("\n\\# not a heading \\* or a list\n"));
  assert.ok(md.includes("\n2\\. two\n"));
  assert.ok(md.includes("a\\_b \\[c\\]"));
});

test("Notes keep their headings, lists, quotes, marks, links and pictures", () => {
  const picture = "11111111-2222-4333-8444-555555555555";
  const cover = "99999999-2222-4333-8444-555555555555";
  const doc = toExportDoc(
    piece(
      [
        { type: "heading", attrs: { level: 2 }, content: [text("Groceries")] },
        { type: "bulletList", content: [{ type: "listItem", content: [para(text("rice"))] }, { type: "listItem", content: [para(text("milk", [{ type: "bold" }]))] }] },
        { type: "blockquote", content: [para(text("a line I heard"))] },
        para(text("see "), text("this", [{ type: "link", attrs: { href: "https://example.com/a b" } }]), text(" and "), text("that", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])),
        { type: "picture", attrs: { id: picture } },
        { type: "horizontalRule" }
      ],
      { style: "notes", cover }
    ),
    TZ,
    "south-asia"
  );
  assert.deepEqual(picturesOf(doc), [cover, picture]);
  const md = toMarkdown(doc, TZ, (id) => `pictures/${id}.jpg`);
  assert.ok(md.includes(`![Cover](pictures/${cover}.jpg)`));
  assert.ok(md.includes("### Groceries"));
  assert.ok(md.includes("- rice\n- **milk**"));
  assert.ok(md.includes("> a line I heard"));
  assert.ok(md.includes("[this](<https://example.com/a b>)"), "a followable link stays a link");
  assert.ok(md.includes(" and that"), "a link Ink would never follow is kept as plain words");
  assert.ok(!md.includes("javascript:"));
  assert.ok(md.includes(`![](pictures/${picture}.jpg)`));
  assert.ok(md.includes("\n---\n"));
});

test("a picture that couldn't be fetched is left out, and the words stay", () => {
  const doc = toExportDoc(piece([para(text("before")), { type: "picture", attrs: { id: "a" } }, para(text("after"))], { style: "notes" }), TZ, "north");
  assert.ok(toMarkdown(doc, TZ, () => null).endsWith("before\n\nafter\n"));
});

test("file names are safe, dated and never taken twice", () => {
  const doc = toExportDoc(piece([para(text("x"))], { title: 'A/b: "c"? <d>|e*' }), TZ, "north");
  assert.equal(fileNameOf(doc, TZ, "md"), "2025-01-03 A b c d e.md");
  const name = uniqueNamer();
  assert.equal(name("2025-01-03 Untitled.md"), "2025-01-03 Untitled.md");
  assert.equal(name("2025-01-03 untitled.md"), "2025-01-03 untitled (2).md");
  assert.equal(name("2025-01-03 Untitled.md"), "2025-01-03 Untitled (3).md");
});

test("the zip holds the files as written", () => {
  const zip = zipOf([
    { path: "Ink/one.md", data: "हवा में\nwords" },
    { path: "Ink/pictures/p.jpg", data: new Uint8Array([1, 2, 3]) }
  ]);
  const files = unzipSync(zip);
  assert.equal(strFromU8(files["Ink/one.md"]!), "हवा में\nwords");
  assert.deepEqual([...files["Ink/pictures/p.jpg"]!], [1, 2, 3]);
});

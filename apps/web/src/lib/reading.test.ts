import assert from "node:assert/strict";
import { test } from "node:test";
import { NOT_READING, readingReducer, tabFor, type BesideTab } from "./reading";

const tab = (id: string): BesideTab => ({ id, title: id, createdAt: "2025-08-10T00:00:00Z" });
const open = (ids: string[]) => ids.reduce((s, id) => readingReducer(s, { type: "open", tab: tab(id) }), NOT_READING);

test("opening a piece adds a tab and makes it the one being read; opening it again adds nothing", () => {
  const s = open(["a", "b"]);
  assert.deepEqual(s.tabs.map((t) => t.id), ["a", "b"]);
  assert.equal(s.active, "b");
  const again = readingReducer(s, { type: "open", tab: tab("a") });
  assert.equal(again.tabs.length, 2);
  assert.equal(again.active, "a");
});

test("closing the open tab moves to the last one; closing another keeps the open one; closing the last ends reading", () => {
  const s = open(["a", "b", "c"]);
  assert.equal(readingReducer(s, { type: "close", id: "c" }).active, "b");
  assert.equal(readingReducer(s, { type: "close", id: "a" }).active, "c");
  assert.deepEqual(readingReducer(open(["a"]), { type: "close", id: "a" }), NOT_READING);
});

test("asking for the menu when it has no room beside the paper puts the paper away, tabs kept; closing the menu brings it back", () => {
  const s = open(["a", "b"]);
  const away = readingReducer(s, { type: "menuOpened", takesRoom: true });
  assert.equal(away.away, true);
  assert.deepEqual(away.tabs, s.tabs);
  assert.equal(readingReducer(away, { type: "menuClosed" }).away, false);
  // Opening the menu when there is room for both changes nothing.
  assert.equal(readingReducer(s, { type: "menuOpened", takesRoom: false }), s);
});

test("reading a piece again shows the paper again, and closing the last tab forgets 'away'", () => {
  const away = readingReducer(open(["a"]), { type: "menuOpened", takesRoom: true });
  assert.equal(readingReducer(away, { type: "open", tab: tab("b") }).away, false);
  assert.equal(readingReducer(away, { type: "close", id: "a" }).away, false);
});

test("moving to another piece clears everything", () => {
  const away = readingReducer(open(["a", "b"]), { type: "menuOpened", takesRoom: true });
  assert.deepEqual(readingReducer(away, { type: "clear" }), NOT_READING);
});

test("a tab is named by the piece's title, else its first line, else Untitled", () => {
  const base = { id: "x", createdAt: "2025-08-10T00:00:00Z" };
  assert.equal(tabFor({ ...base, title: " Rain ", lines: ["a line"] }).title, "Rain");
  const long = "A long first line that goes on and on and on";
  assert.equal(tabFor({ ...base, title: null, lines: [long] }).title, long.slice(0, 32));
  assert.equal(tabFor({ ...base, title: null, lines: [] }).title, "Untitled");
});

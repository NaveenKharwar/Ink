import assert from "node:assert/strict";
import { test } from "node:test";
import { desktopLayout, EDGE, menuWouldTakeReadingRoom, PAGE_IDEAL, PAGE_MIN, READER_GAP, READER_IDEAL, READER_MIN, sheetRoom, sheetWidth } from "./beside";

const base = { panelOpen: true, reading: true, readerAway: false };

test("when nothing is being read, the writer's menu choice stands and there is no reading paper", () => {
  assert.deepEqual(desktopLayout({ viewport: 1229, menuPreferred: true, panelOpen: true, reading: false, readerAway: false }), {
    menuVisible: true,
    menuSteppedAside: false,
    reading: null
  });
});

test("with room for everything the menu stays and both papers are at full size", () => {
  const out = desktopLayout({ ...base, viewport: 2200, menuPreferred: true });
  assert.equal(out.menuVisible, true);
  // At least the ideal sizes; with this much room they keep filling what is left.
  assert.ok(out.reading!.page >= PAGE_IDEAL);
  assert.ok(out.reading!.reader >= READER_IDEAL);
});

test("when the room is short the menu steps aside, at any width from the breakpoint up", () => {
  for (const viewport of [1200, 1229, 1280, 1366, 1440]) {
    const out = desktopLayout({ ...base, viewport, menuPreferred: true });
    if (out.menuVisible) continue;
    assert.equal(out.menuSteppedAside, true);
    assert.equal(out.reading!.left, EDGE);
  }
  assert.equal(desktopLayout({ ...base, viewport: 1229, menuPreferred: true }).menuVisible, false);
  // A writer who keeps the menu closed sees nothing "step aside".
  assert.equal(desktopLayout({ ...base, viewport: 1229, menuPreferred: false }).menuSteppedAside, false);
});

test("from 1200 up the reading paper always fits, and the papers never overlap or overflow", () => {
  for (let viewport = 1200; viewport <= 2200; viewport += 7) {
    for (const menuPreferred of [false, true]) {
      for (const panelOpen of [false, true]) {
        const { reading, menuVisible } = desktopLayout({ viewport, menuPreferred, panelOpen, reading: true, readerAway: false });
        const r = reading!;
        assert.ok(r.page >= PAGE_MIN, `page ${r.page} at ${viewport}`);
        assert.ok(r.reader >= READER_MIN, `reader ${r.reader} at ${viewport}`);
        assert.ok(r.left + r.page + READER_GAP + r.reader + r.right <= viewport, `overflow at ${viewport}`);
        assert.equal(r.left > EDGE, menuVisible);
        // A paper never touches the window, on either side.
        assert.ok(r.left >= EDGE && r.right >= EDGE);
      }
    }
  }
});

test("the papers grow with the room and fill it, so a big screen has no wide empty gap", () => {
  const sizes = [1200, 1400, 1600, 1800, 2000, 2560].map((viewport) => {
    const r = desktopLayout({ ...base, viewport, menuPreferred: false }).reading!;
    return r.page + r.reader;
  });
  for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i]! >= sizes[i - 1]!);
  // Past the ideal sizes nothing is left over: the sheets touch the window edges.
  for (const viewport of [1900, 2200, 2560]) {
    const r = desktopLayout({ ...base, viewport, menuPreferred: true }).reading!;
    assert.equal(r.left + r.page + READER_GAP + r.reader + r.right, viewport);
  }
});

test("a side sheet is 290px up to 1448px wide, then grows to 360px", () => {
  assert.equal(sheetWidth(1200), 290);
  assert.equal(sheetWidth(1448), 290);
  assert.ok(sheetWidth(1700) > 290 && sheetWidth(1700) < 360);
  assert.equal(sheetWidth(1920), 360);
  assert.equal(sheetWidth(2560), 360);
  assert.equal(sheetRoom(1920), 384);
});

test("opening the menu while it has stepped aside puts the reading paper away, and closing the menu brings it back", () => {
  const stepped = desktopLayout({ ...base, viewport: 1229, menuPreferred: true });
  assert.equal(stepped.menuSteppedAside, true);
  assert.ok(stepped.reading);
  const away = desktopLayout({ ...base, viewport: 1229, menuPreferred: true, readerAway: true });
  assert.equal(away.menuVisible, true);
  assert.equal(away.reading, null);
  // Once the writer closes the menu (its choice becomes closed) the same reading paper returns.
  const back = desktopLayout({ ...base, viewport: 1229, menuPreferred: false, readerAway: false });
  assert.ok(back.reading && !back.menuVisible);
});

test("away only matters when there is no room for both", () => {
  const out = desktopLayout({ ...base, viewport: 2200, menuPreferred: true, readerAway: true });
  assert.equal(out.menuVisible, true);
  assert.ok(out.reading);
});

test("asking for the menu while reading: it takes the room whenever both would not fit, whatever it was before", () => {
  assert.equal(menuWouldTakeReadingRoom(1441, true), true);
  assert.equal(menuWouldTakeReadingRoom(1229, true), true);
  assert.equal(menuWouldTakeReadingRoom(2200, true), false);
  // With the panel closed there is more room.
  assert.equal(menuWouldTakeReadingRoom(1441, false), false);
});

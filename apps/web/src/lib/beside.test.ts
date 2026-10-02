import assert from "node:assert/strict";
import { test } from "node:test";
import { desktopLayout, EDGE, menuWouldTakeReadingRoom, PAGE_IDEAL, PAGE_MIN, READER_GAP, READER_IDEAL, READER_MIN, SHEET, sheetInsets } from "./beside";

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
  assert.equal(out.reading!.page, PAGE_IDEAL);
  assert.equal(out.reading!.reader, READER_IDEAL);
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
        assert.ok(r.page >= PAGE_MIN && r.page <= PAGE_IDEAL, `page ${r.page} at ${viewport}`);
        assert.ok(r.reader >= READER_MIN && r.reader <= READER_IDEAL, `reader ${r.reader} at ${viewport}`);
        assert.ok(r.left + r.page + READER_GAP + r.reader + r.right <= viewport, `overflow at ${viewport}`);
        assert.equal(r.left > EDGE, menuVisible);
        // A paper never touches the window, on either side.
        assert.ok(r.left >= EDGE && r.right >= EDGE);
      }
    }
  }
});

test("the papers grow with the room, so a big screen is not left with a wide empty gap", () => {
  const sizes = [1200, 1400, 1600, 1800, 2000].map((viewport) => {
    const r = desktopLayout({ ...base, viewport, menuPreferred: false }).reading!;
    return r.page + r.reader;
  });
  for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i]! >= sizes[i - 1]!);
  // At 1848 wide (menu hidden) the leftover room is small, not hundreds of pixels a side.
  const r = desktopLayout({ ...base, viewport: 1848, menuPreferred: false }).reading!;
  const left = 1848 - r.right - r.left - (r.page + READER_GAP + r.reader);
  assert.ok(left / 2 < 120, `${left / 2}px left on each side`);
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

test("on a big screen the sheets sit 24px from the paper(s); on a small one they sit at the window edges", () => {
  // One paper: 2560 wide, the page 820 centred. The group is menu + gap + page + gap + panel.
  assert.deepEqual(sheetInsets({ viewport: 2560, group: 820, left: SHEET, right: SHEET }), { menu: 556, panel: 556 });
  // Just wide enough for the sheets and the full page: no spare room, so no inset.
  assert.deepEqual(sheetInsets({ viewport: 2 * SHEET + PAGE_IDEAL, group: PAGE_IDEAL, left: SHEET, right: SHEET }), { menu: 0, panel: 0 });
  // Smaller windows have a smaller page and never go negative.
  assert.deepEqual(sheetInsets({ viewport: 1200, group: 1200 - 2 * SHEET, left: SHEET, right: SHEET }), { menu: 0, panel: 0 });
  // Reading: the page and the reading paper stand together; the sheets hug the pair.
  const group = PAGE_IDEAL + READER_GAP + READER_IDEAL;
  assert.deepEqual(sheetInsets({ viewport: 2560, group, left: SHEET, right: SHEET }), { menu: Math.round((2560 - 2 * SHEET - group) / 2), panel: Math.round((2560 - 2 * SHEET - group) / 2) });
});

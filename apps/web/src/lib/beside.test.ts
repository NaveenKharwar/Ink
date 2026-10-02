import assert from "node:assert/strict";
import { test } from "node:test";
import { desktopLayout, EDGE, menuWouldTakeReadingRoom, PAGE_COMFORT, PANEL_ASIDE_BELOW, PAGE_IDEAL, READER_COMFORT, PAGE_MIN, READER_GAP, READER_IDEAL, READER_MIN, sheetRoom, sheetWidth } from "./beside";

const base = { panelOpen: true, reading: true, readerAway: false };

test("when nothing is being read, the writer's menu choice stands and there is no reading paper", () => {
  assert.deepEqual(desktopLayout({ viewport: 1229, menuPreferred: true, panelOpen: true, reading: false, readerAway: false }), {
    menuVisible: true,
    menuSteppedAside: false,
    panelVisible: true,
    panelSteppedAside: false,
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
  const sizes = [1280, 1400, 1600, 1800, 2000, 2560].map((viewport) => {
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

test("on a narrow window the panel steps aside while reading, so the papers get its room", () => {
  const open = (viewport: number) => desktopLayout({ ...base, viewport, menuPreferred: false });
  const narrow = open(1200);
  assert.equal(narrow.panelVisible, false);
  assert.equal(narrow.panelSteppedAside, true);
  assert.equal(narrow.reading!.right, EDGE);
  assert.equal(narrow.reading!.left, EDGE);
  // That room goes to the papers: more than they had with the panel beside them.
  const withPanel = desktopLayout({ ...base, viewport: PANEL_ASIDE_BELOW, menuPreferred: false });
  assert.equal(withPanel.panelVisible, true);
  assert.ok(narrow.reading!.page + narrow.reading!.reader > withPanel.reading!.page + withPanel.reading!.reader - 80);
  assert.ok(narrow.reading!.page > 600, `page ${narrow.reading!.page}`);
  // A writer who closed the panel sees nothing step aside; a wide window keeps it.
  assert.equal(desktopLayout({ ...base, panelOpen: false, viewport: 1200, menuPreferred: false }).panelSteppedAside, false);
  assert.equal(open(1500).panelSteppedAside, false);
  // Not reading: the panel is just as the writer left it.
  assert.equal(desktopLayout({ viewport: 1200, menuPreferred: false, panelOpen: true, reading: false, readerAway: false }).panelVisible, true);
});

test("asking for the panel on a narrow window gives it the room: the reading paper waits", () => {
  const out = desktopLayout({ ...base, viewport: 1200, menuPreferred: false, readerAway: true });
  assert.equal(out.panelVisible, true);
  assert.equal(out.reading, null);
});

test("on a narrow window only the sheet that was asked for comes back, never both", () => {
  const both = { ...base, viewport: 1200, menuPreferred: true, panelOpen: true, readerAway: true };
  const byPanel = desktopLayout({ ...both, awayBy: "panel" });
  assert.equal(byPanel.panelVisible, true);
  assert.equal(byPanel.menuVisible, false);
  assert.equal(byPanel.menuSteppedAside, true);
  assert.equal(byPanel.reading, null);
  const byMenu = desktopLayout({ ...both, awayBy: "menu" });
  assert.equal(byMenu.menuVisible, true);
  assert.equal(byMenu.panelVisible, false);
  assert.equal(byMenu.panelSteppedAside, true);
});

test("the menu only stays beside the papers when they keep a comfortable size", () => {
  // Menu, panel and a note open together at 1500: the papers would be at their very smallest, so the menu steps aside.
  const at1500 = desktopLayout({ ...base, viewport: 1500, menuPreferred: true });
  assert.equal(at1500.menuVisible, false);
  assert.equal(at1500.menuSteppedAside, true);
  assert.ok(at1500.reading!.page >= PAGE_COMFORT && at1500.reading!.reader >= READER_COMFORT);
  // Wherever the menu does stay, the papers are comfortable.
  for (let viewport = 1280; viewport <= 2600; viewport += 9) {
    const out = desktopLayout({ ...base, viewport, menuPreferred: true });
    if (out.menuVisible) assert.ok(out.reading!.page >= PAGE_COMFORT && out.reading!.reader >= READER_COMFORT, `${out.reading!.page}/${out.reading!.reader} at ${viewport}`);
  }
  // And it does stay on a big screen.
  assert.equal(desktopLayout({ ...base, viewport: 1920, menuPreferred: true }).menuVisible, true);
  assert.equal(menuWouldTakeReadingRoom(1500, true), true);
  assert.equal(menuWouldTakeReadingRoom(1920, true), false);
});

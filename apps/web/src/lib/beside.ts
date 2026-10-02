// Reading an older piece beside the page (desktop, from the app's one breakpoint upwards).
//
// This is the one place that decides how the desktop screen is shared while a piece is being
// read: the page, the reading paper ("lite paper"), the menu and "Ink sees this too". Nothing is
// stored: the answer follows from the window's width and three facts, so resizing the window,
// opening the panel or closing the last tab always gives a consistent screen.
//
//  - The reading paper is always available. When the room is short the menu steps aside (the
//    writer's own open/closed choice is kept) and comes back when reading ends. If the writer opens
//    the menu meanwhile, the menu wins the room and the reading paper is put away, tabs kept; it
//    comes back as it was when the menu is closed.
//  - Both papers grow with the room, together: each goes from its smallest size to its ideal size
//    in step (one shared factor), then keeps filling what is left in the same proportion, so the
//    side sheets touch the window edges on a big screen and no ground is left empty.

export const SHEET_GAP = 24;
export const SHEET_MIN = 290;
export const SHEET_MAX = 360;
const SHEET_GROWS_FROM = 1448; // the window width where the sheets start to grow (and the paper stops at 820)
const SHEET_GROWTH = 0.15;
/** A side sheet's width: 290px up to 1448px wide, then growing with the window to 360px. Keep equal to --sheet-width in styles.css. */
export const sheetWidth = (viewport: number) => Math.round(Math.min(SHEET_MAX, Math.max(SHEET_MIN, SHEET_MIN + (viewport - SHEET_GROWS_FROM) * SHEET_GROWTH)));
/** A side sheet and its gap: the room a paper keeps clear on a side that has one. */
export const sheetRoom = (viewport: number) => sheetWidth(viewport) + SHEET_GAP;
export const READER_GAP = 24;
/** Room kept clear at a window edge that has no sheet, so a paper never touches the window. */
export const EDGE = 24;
export const PAGE_MIN = 480;
export const PAGE_IDEAL = 820; // the page's width when it has the room; with more room it keeps growing (its text stays in a 640px column)
export const READER_MIN = 320;
export const READER_IDEAL = 560;

export type DesktopLayoutInput = {
  viewport: number;
  /** The writer's choice: the menu is open when there is room for it. */
  menuPreferred: boolean;
  /** "Ink sees this too" is open on the right. */
  panelOpen: boolean;
  /** At least one older piece is open beside the page. */
  reading: boolean;
  /** The writer opened the menu while it had stepped aside: the reading paper is put away for now. */
  readerAway: boolean;
};

export type DesktopLayout = {
  menuVisible: boolean;
  /** The menu is wanted but has stepped aside for the reading paper. */
  menuSteppedAside: boolean;
  /** Set while reading: the widths of the two papers and the room kept clear on each side. */
  reading: { page: number; reader: number; left: number; right: number } | null;
};

function share(viewport: number, menuShown: boolean, panelOpen: boolean) {
  const left = menuShown ? sheetRoom(viewport) : EDGE;
  const right = panelOpen ? sheetRoom(viewport) : EDGE;
  const free = viewport - left - right - READER_GAP;
  const least = PAGE_MIN + READER_MIN;
  const ideal = PAGE_IDEAL + READER_IDEAL;
  // 0 at the smallest sizes, 1 at the ideal ones; both papers move by the same share.
  const t = Math.min(1, Math.max(0, (free - least) / (ideal - least)));
  // Past the ideal sizes the papers keep filling what is left (in the same proportion), so the
  // sheets touch the window edges and no ground is left empty; their text stays in its own column.
  const page = free > ideal ? Math.round((free * PAGE_IDEAL) / ideal) : Math.round(PAGE_MIN + t * (PAGE_IDEAL - PAGE_MIN));
  return {
    page,
    reader: free > ideal ? free - page : Math.round(READER_MIN + t * (READER_IDEAL - READER_MIN)),
    left,
    right,
    fits: free >= least
  };
}

export function desktopLayout({ viewport, menuPreferred, panelOpen, reading, readerAway }: DesktopLayoutInput): DesktopLayout {
  if (!reading) return { menuVisible: menuPreferred, menuSteppedAside: false, reading: null };
  const withMenu = menuPreferred ? share(viewport, true, panelOpen) : null;
  if (withMenu?.fits) return { menuVisible: true, menuSteppedAside: false, reading: withMenu };
  // No room for both, and the writer asked for the menu: it wins, the reading paper waits.
  if (menuPreferred && readerAway) return { menuVisible: true, menuSteppedAside: false, reading: null };
  const without = share(viewport, false, panelOpen);
  return {
    menuVisible: false,
    menuSteppedAside: menuPreferred,
    reading: { page: without.page, reader: without.reader, left: without.left, right: without.right }
  };
}

/**
 * Whether the menu, if the writer asks for it now, would have no room beside the reading paper
 * (so it would take the room and the paper would be put away). Used when the menu is asked for,
 * whatever its remembered state was.
 */
export function menuWouldTakeReadingRoom(viewport: number, panelOpen: boolean): boolean {
  return !share(viewport, true, panelOpen).fits;
}

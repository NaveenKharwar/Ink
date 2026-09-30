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
//    in step (one shared factor), so no width is cut off at a fixed maximum while the screen still
//    has space. Any room left over sits evenly on both sides, as around the single page.

export const SHEET = 314; // a side sheet (290px) and its 24px gap; keep equal to styles.css
export const READER_GAP = 24;
/** Room kept clear at a window edge that has no sheet, so a paper never touches the window. */
export const EDGE = 24;
export const PAGE_MIN = 480;
export const PAGE_IDEAL = 820; // the page's width when nothing is open beside it (styles.css --paper-max)
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
  const left = menuShown ? SHEET : EDGE;
  const right = panelOpen ? SHEET : EDGE;
  const free = viewport - left - right - READER_GAP;
  const least = PAGE_MIN + READER_MIN;
  const ideal = PAGE_IDEAL + READER_IDEAL;
  // 0 at the smallest sizes, 1 at the ideal ones; both papers move by the same share.
  const t = Math.min(1, Math.max(0, (free - least) / (ideal - least)));
  return {
    page: Math.round(PAGE_MIN + t * (PAGE_IDEAL - PAGE_MIN)),
    reader: Math.round(READER_MIN + t * (READER_IDEAL - READER_MIN)),
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

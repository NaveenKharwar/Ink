import type { RelatedNote } from "@ink/schemas";
import { useCallback, useEffect, useReducer } from "react";
import { desktopLayout, menuWouldTakeReadingRoom } from "../lib/beside";
import { NOT_READING, readingReducer, tabFor } from "../lib/reading";
import { useViewportWidth } from "../lib/useViewportWidth";

type Input = {
  /** The writer's own choice for the menu (remembered on the device). */
  menuPreferred: boolean;
  setMenuPreferred: (open: boolean) => void;
  panelOpen: boolean;
  /** The piece being written; none on screens that are not a piece. */
  pieceId: string | null;
};

/**
 * How the desktop screen is shared between the menu, the page, the reading paper and the panel,
 * and the older pieces being read. Everything about it is here: the screen only reads the answer
 * and calls the actions. The sizes come from `desktopLayout` (lib/beside.ts), the tabs from
 * `readingReducer` (lib/reading.ts).
 */
export function useDesktopLayout({ menuPreferred, setMenuPreferred, panelOpen, pieceId }: Input) {
  const viewport = useViewportWidth();
  const [state, dispatch] = useReducer(readingReducer, NOT_READING);

  // Older pieces belong to the piece being written: moving to another piece leaves them.
  useEffect(() => dispatch({ type: "clear" }), [pieceId]);

  const reading = pieceId !== null && state.tabs.length > 0;
  const layout = desktopLayout({
    viewport,
    menuPreferred,
    panelOpen,
    reading,
    readerAway: state.away
  });

  // ☰ and ⌘\: asking for the menu while it has stepped aside puts the reading paper away (tabs
  // kept) instead of closing anything; closing the menu brings the paper back.
  // Whether the menu would take the room the reading paper is using. Judged from the window and
  // the panel, not from the menu's earlier state: it holds whether the menu was open or closed.
  const takesRoom = reading && menuWouldTakeReadingRoom(viewport, panelOpen);
  const openMenu = useCallback(() => {
    dispatch({ type: "menuOpened", takesRoom });
    setMenuPreferred(true);
  }, [takesRoom, setMenuPreferred]);
  const closeMenu = useCallback(() => {
    dispatch({ type: "menuClosed" });
    setMenuPreferred(false);
  }, [setMenuPreferred]);
  const menuVisible = layout.menuVisible;
  const toggleMenu = useCallback(() => (menuVisible ? closeMenu() : openMenu()), [menuVisible, closeMenu, openMenu]);

  return {
    layout,
    menuVisible,
    tabs: state.tabs,
    /** The tab being read (the first one if none is chosen yet). */
    active: state.active ?? state.tabs[0]?.id ?? null,
    read: useCallback((note: RelatedNote) => dispatch({ type: "open", tab: tabFor(note) }), []),
    select: useCallback((id: string) => dispatch({ type: "select", id }), []),
    close: useCallback((id: string) => dispatch({ type: "close", id }), []),
    stop: useCallback(() => dispatch({ type: "clear" }), []),
    openMenu,
    closeMenu,
    toggleMenu,
    /** The panel is wanted but has stepped aside for the reading paper. */
    panelSteppedAside: layout.panelSteppedAside,
    panelVisible: layout.panelVisible,
    /** Asking for the panel while it has stepped aside: it takes the room, the reading paper waits. */
    showPanel: useCallback(() => dispatch({ type: "panelOpened" }), []),
    /** The panel was closed: a reading paper that was waiting comes back. */
    panelClosed: useCallback(() => dispatch({ type: "panelClosed" }), [])
  };
}

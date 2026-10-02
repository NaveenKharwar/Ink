import type { RelatedNote } from "@ink/schemas";

// Older pieces the writer is reading while they write: desktop tabs beside the page, or the one
// screen after the panel on a phone. Kept as one state that changes only through `readingReducer`,
// so the rules (which tab is open, when the paper is put away) live in one place.

export type BesideTab = { id: string; title: string; createdAt: string };

export type ReadingState = {
  tabs: BesideTab[];
  /** The tab being read; null when there are none. */
  active: string | null;
  /** The writer asked for the menu and it has no room beside the reading paper: the paper waits, tabs kept. */
  away: boolean;
  /** Which sheet put the paper away; on a narrow window only that sheet comes back, never both. */
  awayBy: "menu" | "panel" | null;
};

export const NOT_READING: ReadingState = { tabs: [], active: null, away: false, awayBy: null };

export type ReadingAction =
  | { type: "open"; tab: BesideTab }
  | { type: "select"; id: string }
  | { type: "close"; id: string }
  | { type: "clear" }
  /** The menu was asked for; `takesRoom` says it has no room beside the reading paper (see lib/beside.ts). */
  | { type: "menuOpened"; takesRoom: boolean }
  | { type: "menuClosed" }
  /** The panel was asked for while it had stepped aside for the reading paper: the paper waits, tabs kept. */
  | { type: "panelOpened" }
  | { type: "panelClosed" };

/** The tab an older note opens as: its title, else the start of its first line. */
export function tabFor(note: Pick<RelatedNote, "id" | "title" | "lines" | "createdAt">): BesideTab {
  return { id: note.id, title: note.title?.trim() || note.lines[0]?.slice(0, 32) || "Untitled", createdAt: note.createdAt };
}

export function readingReducer(state: ReadingState, action: ReadingAction): ReadingState {
  switch (action.type) {
    case "open":
      // Asking to read a piece always shows the paper, whatever put it away.
      return {
        tabs: state.tabs.some((t) => t.id === action.tab.id) ? state.tabs : [...state.tabs, action.tab],
        active: action.tab.id,
        away: false,
        awayBy: null
      };
    case "select":
      return state.tabs.some((t) => t.id === action.id) ? { ...state, active: action.id } : state;
    case "close": {
      const tabs = state.tabs.filter((t) => t.id !== action.id);
      if (tabs.length === 0) return NOT_READING;
      return { ...state, tabs, active: state.active === action.id ? tabs[tabs.length - 1]!.id : state.active };
    }
    case "clear":
      return state === NOT_READING ? state : NOT_READING;
    case "menuOpened":
      return action.takesRoom ? { ...state, away: true, awayBy: "menu" } : state;
    case "menuClosed":
      return state.away && state.awayBy !== "panel" ? { ...state, away: false, awayBy: null } : state;
    case "panelOpened":
      return state.tabs.length ? { ...state, away: true, awayBy: "panel" } : state;
    case "panelClosed":
      return state.away && state.awayBy !== "menu" ? { ...state, away: false, awayBy: null } : state;
  }
}

import { useSyncExternalStore } from "react";

// The one thing that can go wrong for the whole app, kept in one place so Ink shows one screen for it
// (see ui/BrokenScreen) and never a different complaint in every panel.
//  - signed-out: the session ended (for example, the writer signed out on another device).
//  - offline: Ink could not be reached.
//  - broken: Ink answered with a failure of its own.
export type Trouble = "signed-out" | "offline" | "broken";

// A session that ended explains more than a bare "offline", and every request after it fails the
// same way, so the first of the worse kinds is the one shown.
const RANK: Record<Trouble, number> = { offline: 0, broken: 1, "signed-out": 2 };

let current: Trouble | null = null;
const listeners = new Set<() => void>();

function set(next: Trouble | null) {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

export function reportTrouble(kind: Trouble) {
  if (current === null || RANK[kind] > RANK[current]) set(kind);
}

export function clearTrouble() {
  set(null);
}

/** What is wrong right now, outside React. */
export const currentTrouble = (): Trouble | null => current;

export function useTrouble(): Trouble | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current
  );
}

/** What a failed request means for the whole app, or null when it is only about that one request. */
export function troubleOf(status: number | null, quiet: boolean): Trouble | null {
  if (status === 401) return "signed-out";
  if (quiet) return null;
  if (status === null) return "offline";
  return status >= 500 ? "broken" : null;
}

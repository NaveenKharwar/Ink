// The one quiet line at the end of "Ink sees this too": keep this piece out of Ink's memory, or put
// it back. The words name what the action does, so no bare "Undo".

export function keepOutAction(keptOut: boolean): string {
  return keptOut ? "Put it back in Ink’s memory" : "Keep it out of Ink’s memory";
}

/** The panel's body for a piece kept out: what happened and what it means. */
export const KEPT_OUT_BODY = "Kept out of Ink’s memory. Ink isn’t looking beside this piece, and it won’t appear beside others.";

export const KEEP_OUT_FAILED = "Couldn’t change that just now.";

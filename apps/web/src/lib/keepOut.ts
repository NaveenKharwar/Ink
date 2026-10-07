// The switch at the foot of "Ink sees this too": whether Ink looks at this piece. On means Ink
// remembers it; off keeps it out. The hint says what the state means, so there is no bare "Undo".

/** The panel's body for a piece kept out: what happened and what it means. */
export const KEPT_OUT_BODY = "Kept out of Ink’s memory. Ink isn’t looking beside this piece, and it won’t appear beside others.";

export const KEEP_OUT_FAILED = "Couldn’t change that just now.";

/** The switch row in the panel's foot: on means Ink looks at the piece. */
export const MEMORY_LABEL = "Ink remembers this";
export const memoryHint = (keptOut: boolean): string => (keptOut ? "Kept out of Ink’s memory." : "Turn off to keep it private.");

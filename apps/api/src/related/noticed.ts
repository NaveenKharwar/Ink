import type { Noticed } from "@ink/schemas";
import { rankRelated, type Candidate } from "./rank.js";

/** "An old theme returns" only counts when the writer has written lately. */
export const RECENT_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

/**
 * An old piece that comes back because the writer's latest piece is clearly close to it in meaning.
 * Hinglish is left out until memory features cover it, and a piece without a vector never counts:
 * a shared word is not enough to say "I noticed". Null when nothing is close.
 */
export function noticeReturn(current: Candidate, others: Candidate[], now: Date): Noticed | null {
  if (Date.parse(current.updatedAt) < now.getTime() - RECENT_DAYS * DAY) return null;
  if (current.language === "hi-Latn") return null;
  const usable = others.filter((piece) => piece.language !== "hi-Latn");
  const hasVector = new Set(usable.filter((piece) => piece.similarity != null).map((piece) => piece.id));
  // The closest of the forgotten ones: old, not opened for a long while, and over the shared floor.
  const note = rankRelated(current, usable, now).forgotten.find((n) => hasVector.has(n.id));
  return note ? { kind: "returns", note } : null;
}

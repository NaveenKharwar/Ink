import type { Noticed } from "@ink/schemas";
import { MIN_SIDE_SIMILARITY, rankRelated, type Candidate } from "./rank.js";

/** "An old theme returns" only counts when the writer has written lately. */
export const RECENT_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

/**
 * What the writer is shown under All writing, one remark: the same thing written three times
 * wins over an old piece coming back. Null when nothing is close.
 */
export function noticeOne(current: Candidate, others: Candidate[], now: Date): Noticed | null {
  return noticeRepeats(current, others, now) ?? noticeReturn(current, others, now);
}

/**
 * The latest piece and two others that are all clearly close to it (the same floor, a real vector,
 * no Hinglish): the same thing written three times. The earliest of the others speaks; the dates
 * of all three go into the sentence.
 */
export function noticeRepeats(current: Candidate, others: Candidate[], now: Date): Noticed | null {
  if (Date.parse(current.updatedAt) < now.getTime() - RECENT_DAYS * DAY) return null;
  if (current.language === "hi-Latn") return null;
  const usable = others.filter((piece) => piece.language !== "hi-Latn");
  const similarity = new Map(usable.map((piece) => [piece.id, piece.similarity ?? null]));
  const ranked = rankRelated(current, usable, now);
  // rankRelated has already left out noise: copies, repeats of the same words, lines too short.
  const close = [...ranked.related, ...ranked.forgotten, ...ranked.loose]
    .filter((note) => (similarity.get(note.id) ?? 0) >= MIN_SIDE_SIMILARITY)
    .sort((a, b) => (similarity.get(b.id) ?? 0) - (similarity.get(a.id) ?? 0))
    .slice(0, 2);
  if (close.length < 2) return null;
  const [first, second] = [...close].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) as [typeof close[0], typeof close[0]];
  const dates = [first.createdAt, second.createdAt, current.createdAt].sort();
  return { kind: "repeats", note: first, dates };
}

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

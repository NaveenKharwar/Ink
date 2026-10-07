import type { RelatedNote, RelatedResponse } from "@ink/schemas";
import { openingLines } from "../pieces/fold.js";

// Pieces count as close by meaning (cosine similarity of their vectors). A piece without a vector
// yet, or no embedder at all, falls back to shared words.

export type Candidate = {
  id: string;
  title: string | null;
  text: string;
  language: RelatedNote["language"];
  style: RelatedNote["style"];
  createdAt: string;
  updatedAt: string;
  /** Cosine similarity to the current piece. Absent when either has no vector yet. */
  similarity?: number | null;
  /** When Forgotten last returned this piece, and the piece the writer was looking at then. */
  shownAt?: string | null;
  shownFor?: string | null;
};

/** Below this a vector match is too weak to call related (soft suggestions only). Retune on real writing. */
export const MIN_SIMILARITY = 0.45;
/**
 * Forgotten and Loose lines are extra, so they need a clearly close match: the same floor as
 * "Close in meaning" in search. Below it the section is simply empty. Retune on real writing.
 */
export const MIN_SIDE_SIMILARITY = 0.53;
export const RELATED_LIMIT = 5;
export const FORGOTTEN_LIMIT = 2;
export const LOOSE_LIMIT = 2;
export const FORGOTTEN_AFTER_DAYS = 180;
/** A piece Forgotten has shown rests this long before it can come back (beside another piece). */
export const FORGOTTEN_REST_DAYS = 30;
export const LOOSE_MAX_CHARS = 160;
/** Fewer words than this is not a line yet: it is not shown as a note, and a piece this short has no notes. */
export const MIN_WORDS = 3;

const DAY = 24 * 60 * 60 * 1000;
const COMMON = new Set(["that", "this", "with", "from", "have", "were", "they", "them", "then", "than", "what", "when", "will", "your", "into", "just", "like", "there", "their", "about", "which", "would", "could"]);

function wordsOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const word of text.toLowerCase().match(/[\p{L}\p{M}]+/gu) ?? []) {
    // Devanagari words are shorter in letters, so three is enough there.
    const min = /\p{Script=Devanagari}/u.test(word) ? 3 : 4;
    if (word.length >= min && !COMMON.has(word)) out.add(word);
  }
  return out;
}

function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{M}]+/gu) ?? []).length;
}

/** The words only, in lower case: "Rain" and "rain." are the same line. */
function sameness(text: string): string {
  return (text.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).join(" ");
}

const toNote = ({ id, title, text, language, style, createdAt, updatedAt }: Candidate): RelatedNote => ({
  id, title, lines: openingLines(text), language, style, createdAt, updatedAt
});

/**
 * Splits the writer's other pieces into what the panel shows. `others` must already leave out
 * the piece itself, dismissed pairs and pieces kept out of memory.
 */
/** What ranking decides; whether the writer kept the piece out of memory is added by the route. */
export type Ranked = Omit<RelatedResponse, "keptOut">;

export function rankRelated(current: Candidate, others: Candidate[], now: Date): Ranked {
  return rankWithPicks(current, others, now).ranked;
}

/** Which list a piece landed in, and the numbers behind it. Ids and numbers only, never any text. */
export type Pick = { id: string; list: "related" | "forgotten" | "loose"; similarity: number | null; overlap: number };
export type Picks = { considered: number; withoutVector: number; picks: Pick[] };

/** `rankRelated`, plus what a debugging log needs to say why each piece was shown. */
export function rankWithPicks(current: Candidate, others: Candidate[], now: Date): { ranked: Ranked; trace: Picks } {
  const mine = wordsOf(current.text);
  // A blank or one-word page has nothing to be close to: the panel says "Nothing yet".
  if (mine.size === 0 || wordCount(current.text) < MIN_WORDS) return { ranked: { related: [], forgotten: [], loose: [], looked: false }, trace: { considered: 0, withoutVector: 0, picks: [] } };

  // Noise out: pieces too short to be a line, copies of the page being written, and the same words
  // written twice (the newest of those is kept).
  const mineSame = sameness(current.text);
  const seen = new Set<string>();
  const candidates = [...others]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter((piece) => {
      if (wordCount(piece.text) < MIN_WORDS) return false;
      const same = sameness(piece.text);
      if (same === mineSame || seen.has(same)) return false;
      seen.add(same);
      return true;
    });

  const scored = candidates.map((piece) => {
    let overlap = 0;
    for (const word of wordsOf(piece.text)) if (mine.has(word)) overlap += 1;
    const similarity = piece.similarity ?? null;
    // Meaning first; pieces without a vector sit below every vector match and sort by shared words.
    return { piece, overlap, similarity, score: (similarity ?? 0) * 1000 + overlap };
  });

  const cutoff = now.getTime() - FORGOTTEN_AFTER_DAYS * DAY;
  const isOld = (piece: Candidate) => Date.parse(piece.updatedAt) < cutoff;
  // Close enough for Forgotten and Loose; a piece without a vector yet needs a shared word, as in Related.
  const closeEnough = ({ overlap, similarity }: (typeof scored)[number]) =>
    similarity === null ? overlap > 0 : similarity >= MIN_SIDE_SIMILARITY;

  // A shown piece rests, except beside the piece it was shown for, so the notes stay put while the writer keeps working.
  const restCutoff = now.getTime() - FORGOTTEN_REST_DAYS * DAY;
  const isResting = ({ shownAt, shownFor }: Candidate) => !!shownAt && Date.parse(shownAt) > restCutoff && shownFor !== current.id;
  const neverShown = ({ piece }: (typeof scored)[number]) => (piece.shownAt ? 1 : 0);

  // Forgotten: not edited for a long while and not resting; never shown first, then the closest, then the oldest.
  const forgotten = scored
    .filter((item) => isOld(item.piece) && closeEnough(item) && !isResting(item.piece))
    .sort((a, b) => neverShown(a) - neverShown(b) || b.score - a.score || a.piece.updatedAt.localeCompare(b.piece.updatedAt))
    .slice(0, FORGOTTEN_LIMIT);
  const taken = new Set(forgotten.map(({ piece }) => piece.id));

  const rest = scored.filter(({ piece }) => !taken.has(piece.id));
  const isLoose = ({ piece }: (typeof scored)[number]) => piece.text.trim().length <= LOOSE_MAX_CHARS;

  // Loose lines: short ones, the closest first, then the newest.
  const loose = rest
    .filter((item) => isLoose(item) && closeEnough(item))
    .sort((a, b) => b.score - a.score || b.piece.updatedAt.localeCompare(a.piece.updatedAt))
    .slice(0, LOOSE_LIMIT);
  const looseIds = new Set(loose.map(({ piece }) => piece.id));

  const related = rest
    .filter(({ piece, overlap, similarity }) => (similarity === null ? overlap > 0 : similarity >= MIN_SIMILARITY) && !looseIds.has(piece.id))
    .sort((a, b) => b.score - a.score || b.piece.updatedAt.localeCompare(a.piece.updatedAt))
    .slice(0, RELATED_LIMIT);

  const pick = (list: Pick["list"]) => (item: (typeof scored)[number]): Pick => ({ id: item.piece.id, list, similarity: item.similarity === null ? null : Math.round(item.similarity * 1000) / 1000, overlap: item.overlap });
  return {
    ranked: {
      related: related.map(({ piece }) => toNote(piece)),
      forgotten: forgotten.map(({ piece }) => toNote(piece)),
      loose: loose.map(({ piece }) => toNote(piece)),
      looked: true
    },
    trace: {
      considered: scored.length,
      withoutVector: scored.filter(({ similarity }) => similarity === null).length,
      picks: [...related.map(pick("related")), ...forgotten.map(pick("forgotten")), ...loose.map(pick("loose"))]
    }
  };
}

import type { RelatedNote, RelatedResponse } from "@ink/schemas";
import { openingLines } from "../pieces/fold.js";

// A stand-in until the embedding pipeline exists: pieces count as close when they share words.
// The API's shape does not change when meaning replaces it; only this file does.

export type Candidate = {
  id: string;
  title: string | null;
  text: string;
  language: RelatedNote["language"];
  style: RelatedNote["style"];
  createdAt: string;
  updatedAt: string;
};

export const RELATED_LIMIT = 5;
export const FORGOTTEN_LIMIT = 2;
export const LOOSE_LIMIT = 2;
export const FORGOTTEN_AFTER_DAYS = 180;
export const LOOSE_MAX_CHARS = 160;

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

const toNote = ({ id, title, text, language, style, createdAt, updatedAt }: Candidate): RelatedNote => ({
  id, title, lines: openingLines(text), language, style, createdAt, updatedAt
});

/**
 * Splits the writer's other pieces into what the panel shows. `others` must already leave out
 * the piece itself, dismissed pairs and pieces kept out of memory.
 */
export function rankRelated(current: Candidate, others: Candidate[], now: Date): RelatedResponse {
  const mine = wordsOf(current.text);
  if (mine.size === 0) return { related: [], forgotten: [], loose: [] };

  const scored = others.map((piece) => {
    let score = 0;
    for (const word of wordsOf(piece.text)) if (mine.has(word)) score += 1;
    return { piece, score };
  });

  const cutoff = now.getTime() - FORGOTTEN_AFTER_DAYS * DAY;
  const isOld = (piece: Candidate) => Date.parse(piece.updatedAt) < cutoff;

  // Forgotten: not opened for a long while, the closest first, then the oldest.
  const forgotten = scored
    .filter(({ piece }) => isOld(piece))
    .sort((a, b) => b.score - a.score || a.piece.updatedAt.localeCompare(b.piece.updatedAt))
    .slice(0, FORGOTTEN_LIMIT);
  const taken = new Set(forgotten.map(({ piece }) => piece.id));

  const rest = scored.filter(({ piece }) => !taken.has(piece.id));
  const isLoose = ({ piece }: (typeof scored)[number]) => piece.text.trim().length <= LOOSE_MAX_CHARS;

  // Loose lines: short ones, the closest first, then the newest.
  const loose = rest
    .filter(isLoose)
    .sort((a, b) => b.score - a.score || b.piece.updatedAt.localeCompare(a.piece.updatedAt))
    .slice(0, LOOSE_LIMIT);
  const looseIds = new Set(loose.map(({ piece }) => piece.id));

  const related = rest
    .filter(({ piece, score }) => score > 0 && !looseIds.has(piece.id))
    .sort((a, b) => b.score - a.score || b.piece.updatedAt.localeCompare(a.piece.updatedAt))
    .slice(0, RELATED_LIMIT);

  return {
    related: related.map(({ piece }) => toNote(piece)),
    forgotten: forgotten.map(({ piece }) => toNote(piece)),
    loose: loose.map(({ piece }) => toNote(piece))
  };
}

// Typo-tolerant word search, used only when the exact search finds nothing ("moonlihgt" for
// "moonlight"). It runs over the writer's own pieces in memory, so it needs no index.
import type { MarkedLine, MatchDescription, SearchWords } from "./fold.js";
import { evenDevanagari, excerpt } from "./fold.js";

/** Short words must be exact: one wrong letter in a three-letter word is a different word. */
const MIN_FUZZY_LENGTH = 4;
/** The most pieces looked through, newest first. */
export const NEAR_POOL = 1000;

const TOKEN = /[\p{L}\p{M}\p{N}]+/gu;

/** Letters that may be wrong: one for words of 4 to 7 letters, two from 8. */
export const allowedTypos = (length: number): number => (length < MIN_FUZZY_LENGTH ? 0 : length < 8 ? 1 : 2);

/** Edit distance counting a swap of two neighbours as one mistake; `max + 1` once it is past `max`. */
export function distance(a: string, b: string, max: number): number {
  const x = [...a];
  const y = [...b];
  if (Math.abs(x.length - y.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      let d = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) d = Math.min(d, prev2[j - 2]! + 1);
      row[j] = d;
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[y.length]!;
}

/** How many mistakes it takes for the token to be the searched word: 0 exact, null not close enough. */
function mistakes(word: string, token: string): number | null {
  if (token.includes(word)) return 0;
  const max = allowedTypos(word.length);
  if (max === 0) return null;
  const d = distance(word, token, max);
  return d <= max ? d : null;
}

/** Total mistakes for a piece holding every searched word, or null when one of them is missing. */
export function nearScore(text: string, words: SearchWords): number | null {
  const tokens = [...new Set(evenDevanagari(text).match(TOKEN) ?? [])];
  let total = 0;
  for (const word of words.even) {
    let best: number | null = null;
    for (const token of tokens) {
      const d = mistakes(word, token);
      if (d !== null && (best === null || d < best)) best = d;
      if (best === 0) break;
    }
    if (best === null) return null;
    total += best;
  }
  return total;
}

/** The pieces holding every searched word give or take a typo, fewest mistakes first, then as given. */
export function nearest<T extends { text: string; title?: string | null }>(pieces: T[], words: SearchWords, limit: number): T[] {
  if (!words.even.length || words.even.every((w) => allowedTypos([...w].length) === 0)) return [];
  const scored: { piece: T; score: number; order: number }[] = [];
  pieces.forEach((piece, order) => {
    const score = nearScore(piece.title ? `${piece.title}\n${piece.text}` : piece.text, words);
    if (score !== null) scored.push({ piece, score, order });
  });
  return scored
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .slice(0, limit)
    .map((s) => s.piece);
}

function markLine(line: string, words: SearchWords): MarkedLine {
  const marks: [number, number][] = [];
  for (const token of line.matchAll(TOKEN)) {
    const folded = evenDevanagari(token[0]);
    if (words.even.some((w) => mistakes(w, folded) !== null)) marks.push([token.index!, token.index! + token[0].length]);
  }
  return { text: line, marks };
}

/** Like describeMatch, marking the words that are close to the searched ones. */
export function describeNear(text: string, words: SearchWords): MatchDescription {
  const lines = text.split("\n").map((line) => line.trim());
  const first = Math.max(0, lines.findIndex((line) => line));
  const marked = lines.map((line) => (line ? markLine(line, words) : { text: line, marks: [] as [number, number][] }));
  const found = marked.findIndex((m) => m.marks.length > 0);
  return {
    firstLine: excerpt(marked[first] ?? { text: "", marks: [] }),
    match: found >= 0 && found !== first ? excerpt(marked[found]!) : null
  };
}

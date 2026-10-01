// Word search folds writing and searches the same way, so small spelling differences meet:
// चाँद and चांद, chaand and chand, and Hinglish typing that finds Hindi (Devanagari) writing.
// The stored search text holds two copies: the writing with Devanagari evened out, and a loose
// Latin spelling of all of it. A search word matches if either copy contains it.

const NUKTA = "़";
const CHANDRABINDU = "ँ";
const ANUSVARA = "ं";
const VISARGA = "ः";
const VIRAMA = "्";

const CONSONANTS: Record<string, string> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "n",
  च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n",
  ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n",
  त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m",
  य: "y", र: "r", ल: "l", ळ: "l", व: "v",
  श: "sh", ष: "sh", स: "s", ह: "h"
};

const VOWELS: Record<string, string> = {
  अ: "a", आ: "aa", इ: "i", ई: "ii", उ: "u", ऊ: "uu", ऋ: "ri",
  ए: "e", ऐ: "ai", ओ: "o", औ: "au", ऑ: "o", ऍ: "e"
};

const MATRAS: Record<string, string> = {
  "ा": "aa", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu", "ृ": "ri",
  "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e"
};

type Unit = { consonant: boolean; sound: string; vowel: string; tail: string };

// One run of Devanagari letters, spelled in Latin letters the way Hindi is usually typed.
function spellWord(units: Unit[]): string {
  // Hindi drops the silent "a" at the end of a word and between two sounded syllables
  // (देखता is "dekhta", not "dekhata"), but keeps it after a closed syllable (ज़िंदगी is
  // "zindagi"). Worked from the right, like the spoken rule.
  const last = units.length - 1;
  if (last > 0 && units[last]!.consonant && units[last]!.vowel === "a" && !units[last]!.tail) units[last]!.vowel = "";
  for (let i = last - 1; i >= 1; i--) {
    const unit = units[i]!;
    const before = units[i - 1]!;
    const after = units[i + 1]!;
    if (unit.consonant && unit.vowel === "a" && !unit.tail && before.vowel !== "" && !before.tail && after.consonant && after.vowel !== "") {
      unit.vowel = "";
    }
  }
  return units.map((u) => u.sound + u.vowel + u.tail).join("");
}

/** Devanagari spelled in Latin letters; everything else is left as it is. */
export function romanize(input: string): string {
  const chars = [...input.normalize("NFD")];
  let out = "";
  let word: Unit[] = [];
  const flush = () => {
    if (word.length) out += spellWord(word);
    word = [];
  };

  for (const ch of chars) {
    const current = word[word.length - 1];
    if (ch === NUKTA) continue;
    if (CONSONANTS[ch]) word.push({ consonant: true, sound: CONSONANTS[ch]!, vowel: "a", tail: "" });
    else if (VOWELS[ch]) word.push({ consonant: false, sound: "", vowel: VOWELS[ch]!, tail: "" });
    else if (MATRAS[ch] && current?.consonant) current.vowel = MATRAS[ch]!;
    else if (ch === VIRAMA && current?.consonant) current.vowel = "";
    else if ((ch === ANUSVARA || ch === CHANDRABINDU) && current) current.tail += "n";
    else if (ch === VISARGA && current) current.tail += "h";
    else if (ch >= "०" && ch <= "९") {
      flush();
      out += String(ch.charCodeAt(0) - 0x0966);
    } else if (ch === "।" || ch === "॥") {
      flush();
      out += " ";
    } else {
      flush();
      out += ch;
    }
  }
  flush();
  return out;
}

/** Devanagari evened out: ँ reads as ं and nukta letters as their plain letters (ज़ → ज). */
export function evenDevanagari(input: string): string {
  return input.normalize("NFD").split(NUKTA).join("").split(CHANDRABINDU).join(ANUSVARA).normalize("NFC").toLowerCase();
}

/**
 * Latin spelling made loose, so the common ways of typing a word meet:
 * aa/a, ee/i, oo/u, ph/f, w/v, z/j, sh/s, doubled letters.
 */
export function loosen(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ph/g, "f")
    .replace(/w/g, "v")
    .replace(/z/g, "j")
    .replace(/q/g, "k")
    .replace(/sh/g, "s")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/ei/g, "e")
    .replace(/(\p{L})\1+/gu, "$1");
}

const latin = (input: string) => loosen(romanize(input));

/**
 * Only pieces the writer labelled English are matched by their exact words. Everything else (Hindi,
 * Hinglish, mixed, or no label yet) is matched loosely too, so the ways of spelling a word meet.
 */
export const isLoose = (language: string | null): boolean => language !== "en";

/** What gets stored and indexed for a piece: the exact words, then (for loose pieces) the loose copy. */
export function searchText(title: string | null, text: string, loose = true): string {
  const all = title ? `${title}\n${text}` : text;
  return loose ? `${evenDevanagari(all)}\n${latin(all)}` : evenDevanagari(all);
}

export type SearchWords = { even: string[]; latin: string[] };

/** The searched words (punctuation dropped), folded the same two ways as the writing. */
export function searchWords(query: string): SearchWords {
  const words = query.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean).slice(0, 12);
  return { even: words.map(evenDevanagari), latin: words.map(latin) };
}

function wordIn(words: SearchWords, i: number, piece: { even: string; latin: string }, loose: boolean): boolean {
  const latinWord = words.latin[i];
  return piece.even.includes(words.even[i]!) || (loose && !!latinWord && piece.latin.includes(latinWord));
}

const fold = (text: string) => ({ even: evenDevanagari(text), latin: latin(text) });

export type MarkedLine = { text: string; marks: [number, number][] };

// Marks whole words of the line that hold one of the searched words.
function markLine(line: string, words: SearchWords, loose: boolean): MarkedLine {
  const marks: [number, number][] = [];
  for (const token of line.matchAll(/[\p{L}\p{M}\p{N}]+/gu)) {
    const folded = fold(token[0]);
    if (words.even.some((_, i) => wordIn(words, i, folded, loose))) marks.push([token.index!, token.index! + token[0].length]);
  }
  return { text: line, marks };
}

const MAX_LINE = 160;

// A long line is cut down around its first match, so the match is always in view.
function excerpt({ text, marks }: MarkedLine): MarkedLine {
  if (text.length <= MAX_LINE) return { text, marks };
  const start = marks.length && marks[0]![0] > 60 ? marks[0]![0] - 40 : 0;
  const end = Math.min(text.length, start + MAX_LINE);
  const lead = start > 0 ? "…" : "";
  const shift = lead.length - start;
  return {
    text: lead + text.slice(start, end).trim() + (end < text.length ? "…" : ""),
    marks: marks.filter(([s, e]) => s >= start && e <= end).map(([s, e]) => [s + shift, e + shift])
  };
}

export type MatchDescription = { firstLine: MarkedLine; match: MarkedLine | null };

/** A search result's first line, and the line the words were found in when that is another line. */
export function describeMatch(text: string, query: string, loose = true): MatchDescription {
  const words = searchWords(query);
  const lines = text.split("\n").map((line) => line.trim());
  const first = Math.max(0, lines.findIndex((line) => line));
  const folded = lines.map(fold);
  const all = folded.findIndex((f, n) => lines[n] && words.even.every((_, i) => wordIn(words, i, f, loose)));
  const any = all >= 0 ? all : folded.findIndex((f, n) => lines[n] && words.even.some((_, i) => wordIn(words, i, f, loose)));
  return {
    firstLine: excerpt(markLine(lines[first] ?? "", words, loose)),
    match: any >= 0 && any !== first ? excerpt(markLine(lines[any]!, words, loose)) : null
  };
}

/** The first two lines with words in them, for lists. */
export function openingLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((line) => (line.length > 200 ? `${line.slice(0, 200)}…` : line));
}

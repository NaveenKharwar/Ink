// Counts that work for Devanagari as well as Latin script: a conjunct like "क्ष" is
// one visible character, and words are found by the platform's word segmenter.
const words = new Intl.Segmenter(undefined, { granularity: "word" });
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function countWords(text: string): number {
  let n = 0;
  for (const segment of words.segment(text)) if (segment.isWordLike) n++;
  return n;
}

export function countCharacters(text: string): number {
  let n = 0;
  for (const segment of graphemes.segment(text)) if (segment.segment.trim() !== "") n++;
  return n;
}

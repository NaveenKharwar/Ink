// What the quiet spot under the last line of the page shows. There is no timed question: a draft of
// some length simply carries a small "Mark finished", and a finished piece carries "Finished · Reopen".

/** A piece shorter than this is still a start; it carries no "Mark finished". */
export const MIN_WORDS = 20;

export type SpotFacts = {
  /** The writer already marked it finished and has not written in it since. */
  finished: boolean;
  words: number;
  /** The words are safely on the server, so marking the piece finished cannot be undone by a save still on its way. */
  saved: boolean;
};

export function spotFor({ finished, words, saved }: SpotFacts): "finished" | "mark" | "none" {
  if (finished) return "finished";
  return words >= MIN_WORDS && saved ? "mark" : "none";
}

import type { Piece } from "./piece.js";

// One older piece the panel shows: its own words (the opening lines for now), which piece
// it comes from, and when it was written. The panel never explains why it is shown.
export type RelatedNote = Pick<Piece, "id" | "title" | "language" | "style" | "createdAt" | "updatedAt"> & {
  lines: string[];
};

// What "Ink sees this too" shows next to a piece: close in meaning, old and not edited for
// a long while, and short loose lines. `looked` is false while the page is too short to compare,
// so the panel can tell a new page from a piece with nothing close to it. `keptOut` is true when the
// writer kept this piece out of Ink's memory: nothing is looked at beside it, and the panel says so.
export type RelatedResponse = { related: RelatedNote[]; forgotten: RelatedNote[]; loose: RelatedNote[]; looked: boolean; keptOut: boolean };

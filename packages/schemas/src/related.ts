import type { Piece } from "./piece.js";

// One older piece the panel shows: its own words (the opening lines for now), which piece
// it comes from, and when it was written. The panel never explains why it is shown.
export type RelatedNote = Pick<Piece, "id" | "title" | "language" | "style" | "createdAt" | "updatedAt"> & {
  lines: string[];
};

// What "Ink sees this too" shows next to a piece: close in meaning, old and not opened for
// a long while, and short loose lines.
export type RelatedResponse = { related: RelatedNote[]; forgotten: RelatedNote[]; loose: RelatedNote[] };

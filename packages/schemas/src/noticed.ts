import type { RelatedNote } from "./related.js";

// One quiet remark under the All writing title: an older piece that comes back to mind because
// something recent is close to it. Only the piece is sent; the sentence is built on the device
// from fixed patterns, never generated. `noticed` is null when nothing is close enough.
// "returns": an old piece comes back. "repeats": the latest piece and two others say the same
// thing; `note` is the earliest of the others and `dates` are when all three were written.
export type Noticed = { kind: "returns"; note: RelatedNote } | { kind: "repeats"; note: RelatedNote; dates: string[] };
export type NoticedResponse = { noticed: Noticed | null };

import type { RelatedNote } from "./related.js";

// One quiet remark under the All writing title: an older piece that comes back to mind because
// something recent is close to it. Only the piece is sent; the sentence is built on the device
// from fixed patterns, never generated. `noticed` is null when nothing is close enough.
export type Noticed = { kind: "returns"; note: RelatedNote };
export type NoticedResponse = { noticed: Noticed | null };

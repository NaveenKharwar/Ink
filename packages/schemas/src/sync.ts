import { z } from "zod";
import { piece } from "./piece.js";

// Yjs data (binary) travels as base64. 1MB is Fastify's default body limit.
const base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, "Not base64").max(1_000_000);

// One round trip: the writer's new changes go up, whatever they are missing comes back.
// The piece is created by its first sync, under the id the client made.
// Title and language are in the Yjs data too (its `meta` map); the server copies them to columns.
export const syncPieceInput = z.object({
  // Yjs changes the server may not have yet. Leave out to only fetch.
  update: base64.optional(),
  // What the client already has (Yjs state vector); "AA==" for nothing.
  stateVector: base64.min(1)
});
export type SyncPieceInput = z.infer<typeof syncPieceInput>;

export const syncPieceOutput = z.object({
  // Yjs changes the client is missing.
  update: base64,
  // What the server has now; the next sync only needs to send what is newer.
  stateVector: base64,
  piece: piece.omit({ content: true })
});
export type SyncPieceOutput = z.infer<typeof syncPieceOutput>;

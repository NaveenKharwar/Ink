import { textHash } from "./hash.js";
import type { EmbeddingProvider } from "./provider.js";
import type { EmbeddingsRepo } from "./repo.js";

export type EmbedOutcome = "embedded" | "unchanged" | "removed" | "gone";

/**
 * Brings one piece's vector up to date. Pieces kept out of memory, or with no text, have no vector.
 * Throws when the provider can't be reached, so the queue retries. `force` makes the vector again
 * even when the text has not changed (after the way vectors are made changes).
 */
export async function embedPiece(repo: EmbeddingsRepo, provider: EmbeddingProvider, pieceId: string, { force = false } = {}): Promise<EmbedOutcome> {
  const piece = await repo.load(pieceId);
  if (!piece) return "gone";
  const text = [piece.title, piece.text].filter(Boolean).join("\n\n").trim();
  if (!piece.includeInMemory || !text) {
    await repo.remove(pieceId);
    return "removed";
  }
  const hash = textHash(text);
  if (piece.storedHash === hash && !force) {
    await repo.touch(pieceId); // checked and current, so the sweep leaves it alone
    return "unchanged";
  }
  const [vector] = await provider.embed([text]);
  if (!vector) throw new Error("Embedder returned no vector.");
  await repo.save(pieceId, piece.userId, provider.model, vector, hash);
  return "embedded";
}

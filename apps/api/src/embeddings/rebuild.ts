import { embedPiece } from "./embed-piece.js";
import type { EmbeddingProvider } from "./provider.js";
import type { EmbeddingsRepo } from "./repo.js";

/**
 * Makes every piece's vector again, one piece at a time, even where the text has not changed: for
 * when the way vectors are made changes. A piece that fails is counted and left as it was.
 */
export async function rebuildEmbeddings(repo: EmbeddingsRepo, provider: EmbeddingProvider, log: (line: string) => void = () => {}) {
  const ids = await repo.findAll();
  let done = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      if ((await embedPiece(repo, provider, id, { force: true })) === "embedded") done += 1;
    } catch (err) {
      failed += 1;
      log(`Piece ${id} could not be embedded: ${(err as Error).message}`);
    }
  }
  return { pieces: ids.length, done, failed };
}

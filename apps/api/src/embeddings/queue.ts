import { PgBoss } from "pg-boss";
import type pg from "pg";
import { embedPiece } from "./embed-piece.js";
import type { EmbeddingProvider } from "./provider.js";
import type { EmbeddingsRepo } from "./repo.js";

const QUEUE = "embed-piece";
// A piece is embedded once it has been quiet this long, so a burst of saves makes one job.
const QUIET_SECONDS = 30;

/** Asks for a piece to be embedded in the background. Never throws: a save must not fail because of this. */
export interface EmbeddingQueue {
  enqueue(pieceId: string): Promise<void>;
  stop(): Promise<void>;
}

export const noEmbeddingQueue: EmbeddingQueue = { enqueue: async () => {}, stop: async () => {} };

export async function startEmbeddingQueue(
  pool: pg.Pool,
  repo: EmbeddingsRepo,
  provider: EmbeddingProvider,
  log: { warn: (message: string) => void }
): Promise<EmbeddingQueue> {
  const boss = new PgBoss({ db: { executeSql: (text, values) => pool.query(text, values as unknown[]) } });
  boss.on("error", (err) => log.warn(`Embedding queue: ${err.message}`));
  await boss.start();
  await boss.createQueue(QUEUE, { retryLimit: 8, retryDelay: 30, retryBackoff: true, retryDelayMax: 900 });
  await boss.work<{ pieceId: string }>(QUEUE, async (jobs) => {
    for (const job of jobs) await embedPiece(repo, provider, job.data.pieceId);
  });
  return {
    async enqueue(pieceId) {
      try {
        await boss.sendDebounced(QUEUE, { pieceId }, null, QUIET_SECONDS, pieceId);
      } catch (err) {
        log.warn(`Could not queue embedding: ${(err as Error).message}`);
      }
    },
    stop: () => boss.stop({ graceful: true })
  };
}

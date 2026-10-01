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

const SWEEP_EVERY_MS = 15 * 60 * 1000;
const SWEEP_LIMIT = 50;

/** Queues pieces that lost their job (for example during a long outage). Returns how many it queued. */
export async function sweepStale(repo: EmbeddingsRepo, enqueue: (pieceId: string) => Promise<void>, limit = SWEEP_LIMIT): Promise<number> {
  const ids = await repo.findStale(limit);
  for (const id of ids) await enqueue(id);
  return ids.length;
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
  const enqueue = async (pieceId: string) => {
    try {
      await boss.sendDebounced(QUEUE, { pieceId }, null, QUIET_SECONDS, pieceId);
    } catch (err) {
      log.warn(`Could not queue embedding: ${(err as Error).message}`);
    }
  };
  // Every so often, pick up pieces whose job was dropped. Quiet when nothing is missing.
  const sweep = () => sweepStale(repo, enqueue).catch((err) => log.warn(`Embedding sweep: ${(err as Error).message}`));
  const timer = setInterval(() => void sweep(), SWEEP_EVERY_MS);
  timer.unref();
  void sweep();
  return {
    enqueue,
    stop: async () => {
      clearInterval(timer);
      await boss.stop({ graceful: true });
    }
  };
}

import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { noEmbeddingQueue, type EmbeddingQueue } from "./embeddings/queue.js";
import { requireUser, type VerifyToken } from "./auth.js";
import { registerDocs } from "./docs.js";
import { registerErrorHandling } from "./errors.js";
import { loggerOptions, type LogStream } from "./logging.js";
import type { PiecesRepo } from "./pieces/repo.js";
import { registerPieceRoutes } from "./pieces/routes.js";
import { registerPictureRoutes } from "./pictures/routes.js";
import type { PicturesRepo } from "./pictures/repo.js";
import type { PictureStore } from "./pictures/store.js";
import type { RelatedRepo } from "./related/repo.js";
import { registerRelatedRoutes } from "./related/routes.js";
import { registerHealthRoutes } from "./routes/health.js";
import type { Meaning } from "./search/meaning.js";

export type AppDeps = {
  repo: PiecesRepo;
  related: RelatedRepo;
  pictures: { store: PictureStore; repo: PicturesRepo };
  verify: VerifyToken;
  embeddings?: EmbeddingQueue;
  /** Search by meaning. Without it, search answers with words only. */
  meaning?: Meaning;
  /** True logs to standard output; a stream collects the lines instead (for tests). */
  logger?: boolean | LogStream;
  docs?: boolean;
};

export async function buildApp({ repo, related, pictures, verify, embeddings = noEmbeddingQueue, meaning, logger = false, docs = false }: AppDeps) {
  // Every request gets its own id (not a counter that restarts), so one failure can be found across log lines.
  const app = Fastify({ logger: loggerOptions(logger), genReqId: () => randomUUID() });
  app.addHook("onSend", async (request, reply) => void reply.header("x-request-id", request.id));
  app.decorateRequest("userId", "");
  registerErrorHandling(app);

  if (docs) await registerDocs(app);
  registerHealthRoutes(app);

  await app.register(async (api) => {
    api.addHook("preHandler", requireUser(verify));
    registerPieceRoutes(api, repo, embeddings, meaning);
    registerRelatedRoutes(api, related);
    registerPictureRoutes(api, pictures.store, pictures.repo);
  });

  return app;
}

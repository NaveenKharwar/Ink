import Fastify from "fastify";
import { requireUser, type VerifyToken } from "./auth.js";
import { registerDocs } from "./docs.js";
import { registerErrorHandling } from "./errors.js";
import type { PiecesRepo } from "./pieces/repo.js";
import { registerPieceRoutes } from "./pieces/routes.js";
import { registerPictureRoutes } from "./pictures/routes.js";
import type { PicturesRepo } from "./pictures/repo.js";
import type { PictureStore } from "./pictures/store.js";
import type { RelatedRepo } from "./related/repo.js";
import { registerRelatedRoutes } from "./related/routes.js";
import { registerHealthRoutes } from "./routes/health.js";

export type AppDeps = {
  repo: PiecesRepo;
  related: RelatedRepo;
  pictures: { store: PictureStore; repo: PicturesRepo };
  verify: VerifyToken;
  logger?: boolean;
  docs?: boolean;
};

export async function buildApp({ repo, related, pictures, verify, logger = false, docs = false }: AppDeps) {
  const app = Fastify({ logger });
  app.decorateRequest("userId", "");
  registerErrorHandling(app);

  if (docs) await registerDocs(app);
  registerHealthRoutes(app);

  await app.register(async (api) => {
    api.addHook("preHandler", requireUser(verify));
    registerPieceRoutes(api, repo);
    registerRelatedRoutes(api, related);
    registerPictureRoutes(api, pictures.store, pictures.repo);
  });

  return app;
}

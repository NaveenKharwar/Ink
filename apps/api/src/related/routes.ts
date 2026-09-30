import type { RelatedResponse } from "@ink/schemas";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { RelatedRepo } from "./repo.js";
import { rankRelated } from "./rank.js";

const pairParams = z.object({ id: z.string().uuid(), otherId: z.string().uuid() });
const idParams = z.object({ id: z.string().uuid() });

const notFound = (reply: FastifyReply) => reply.code(404).send({ error: "not_found", message: "This piece doesn't exist." });

export function registerRelatedRoutes(app: FastifyInstance, repo: RelatedRepo) {
  // What "Ink sees this too" shows beside a piece. Only the writer's own pieces, ever.
  app.get("/api/pieces/:id/related", async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return notFound(reply);
    const found = await repo.candidates(request.userId, params.data.id);
    if (!found) return notFound(reply);
    const response: RelatedResponse = rankRelated(found.current, found.others, new Date());
    return response;
  });

  // "Not related": hides that piece beside this one for good. Repeating it changes nothing.
  app.put("/api/pieces/:id/related/:otherId/dismissed", async (request, reply) => {
    const params = pairParams.safeParse(request.params);
    if (!params.success) return notFound(reply);
    const done = await repo.dismiss(request.userId, params.data.id, params.data.otherId);
    return done ? reply.code(204).send() : notFound(reply);
  });

  // Undo, within the few seconds the panel offers it.
  app.delete("/api/pieces/:id/related/:otherId/dismissed", async (request, reply) => {
    const params = pairParams.safeParse(request.params);
    if (!params.success) return notFound(reply);
    const done = await repo.restore(request.userId, params.data.id, params.data.otherId);
    return done ? reply.code(204).send() : notFound(reply);
  });
}

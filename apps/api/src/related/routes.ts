import type { NoticedResponse, RelatedResponse } from "@ink/schemas";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { RelatedRepo } from "./repo.js";
import { noticeOne } from "./noticed.js";
import { rankRelated } from "./rank.js";
import { perWriterLimit, tooMany } from "../rate-limit.js";

const pairParams = z.object({ id: z.string().uuid(), otherId: z.string().uuid() });
const idParams = z.object({ id: z.string().uuid() });

const notFound = (reply: FastifyReply) => reply.code(404).send({ error: "not_found", message: "This piece doesn't exist." });

// Opening pieces asks for the panel each time; this is far above any reading pace.
const LOOKS_PER_MINUTE = 60;

export function registerRelatedRoutes(app: FastifyInstance, repo: RelatedRepo) {
  const looks = perWriterLimit(LOOKS_PER_MINUTE, 60_000);

  // What "Ink sees this too" shows beside a piece. Only the writer's own pieces, ever.
  app.get("/api/pieces/:id/related", async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return notFound(reply);
    if (!looks.allow(request.userId)) return tooMany(reply);
    const found = await repo.candidates(request.userId, params.data.id);
    if (!found) return notFound(reply);
    const response: RelatedResponse = rankRelated(found.current, found.others, new Date());
    await repo.markShown(request.userId, params.data.id, response.forgotten.map((note) => note.id));
    return response;
  });

  // The one remark under the All writing title. Looks from the writer's latest piece, only at
  // the writer's own pieces; nothing close is `null`, which shows nothing.
  app.get("/api/noticed", async (request, reply) => {
    if (!looks.allow(request.userId)) return tooMany(reply);
    const latest = await repo.latest(request.userId);
    const found = latest ? await repo.candidates(request.userId, latest) : null;
    const response: NoticedResponse = { noticed: found ? noticeOne(found.current, found.others, new Date()) : null };
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

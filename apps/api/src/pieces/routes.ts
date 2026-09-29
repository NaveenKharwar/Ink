import { fromBase64, listPiecesQuery, syncPieceInput, toBase64, updatePieceInput, type ListPiecesResponse, type SyncPieceOutput } from "@ink/schemas";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { InvalidUpdateError } from "./merge.js";
import type { PiecesRepo } from "./repo.js";

const idParams = z.object({ id: z.string().uuid() });
const uuid = z.string().uuid();
const PG_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}(:?\d{2})?|Z)?$/;

type Cursor = { updatedAt: string; id: string };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify([cursor.updatedAt, cursor.id])).toString("base64url");
}

export function decodeCursor(value: string): Cursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [updatedAt, id] = parsed;
    if (typeof updatedAt !== "string" || !PG_TIMESTAMP.test(updatedAt) || !uuid.safeParse(id).success) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
}

function invalid(reply: FastifyReply, error: z.ZodError) {
  return reply.code(400).send({
    error: "invalid_request",
    issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
  });
}

const notFound = (reply: FastifyReply) => reply.code(404).send({ error: "not_found", message: "This piece doesn't exist." });

export function registerPieceRoutes(app: FastifyInstance, repo: PiecesRepo) {
  // Writing goes through here: the piece is created by its first sync, and two devices'
  // edits merge (Yjs), so neither overwrites the other.
  app.post("/api/pieces/:id/sync", async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return notFound(reply);
    const body = syncPieceInput.safeParse(request.body);
    if (!body.success) return invalid(reply, body.error);

    let outcome;
    try {
      outcome = await repo.sync(request.userId, params.data.id, {
        update: body.data.update ? fromBase64(body.data.update) : null,
        stateVector: fromBase64(body.data.stateVector),
        title: body.data.title,
        language: body.data.language
      });
    } catch (err) {
      if (err instanceof InvalidUpdateError) {
        return reply.code(400).send({ error: "invalid_request", message: "The update is not valid." });
      }
      throw err;
    }
    if (!outcome) return notFound(reply);
    const response: SyncPieceOutput = { update: toBase64(outcome.update), stateVector: toBase64(outcome.stateVector), piece: outcome.piece };
    return response;
  });

  app.get("/api/pieces", async (request, reply) => {
    const query = listPiecesQuery.safeParse(request.query);
    if (!query.success) return invalid(reply, query.error);

    let after: Cursor | undefined;
    if (query.data.cursor) {
      const decoded = decodeCursor(query.data.cursor);
      if (!decoded) return reply.code(400).send({ error: "invalid_request", message: "The cursor is not valid." });
      after = decoded;
    }

    const page = await repo.list(request.userId, { limit: query.data.limit, after });
    const response: ListPiecesResponse = { items: page.items, nextCursor: page.next ? encodeCursor(page.next) : null };
    return response;
  });

  app.get("/api/pieces/:id", async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return notFound(reply);
    const piece = await repo.get(request.userId, params.data.id);
    return piece ?? notFound(reply);
  });

  app.patch("/api/pieces/:id", async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return notFound(reply);
    const body = updatePieceInput.safeParse(request.body);
    if (!body.success) return invalid(reply, body.error);

    const updated = await repo.update(request.userId, params.data.id, body.data);
    return updated ?? notFound(reply);
  });
}

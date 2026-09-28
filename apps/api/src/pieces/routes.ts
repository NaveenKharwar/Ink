import { createPieceInput, docToPlainText, listPiecesQuery, updatePieceInput, type ListPiecesResponse } from "@ink/schemas";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
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
  app.post("/api/pieces", async (request, reply) => {
    const body = createPieceInput.safeParse(request.body);
    if (!body.success) return invalid(reply, body.error);

    const input = { ...body.data, text: docToPlainText(body.data.content) };
    const created = await repo.create(request.userId, input);
    if (created) return reply.code(201).send(created);

    // The id is taken. If it is this writer's own piece, the create was a retry:
    // answer with what is stored so a sync after a dropped connection is safe.
    const existing = input.id ? await repo.get(request.userId, input.id) : null;
    if (existing) return reply.code(200).send(existing);
    return reply.code(409).send({ error: "conflict", message: "This id is already in use." });
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

    const patch = body.data.content ? { ...body.data, text: docToPlainText(body.data.content) } : body.data;
    const updated = await repo.update(request.userId, params.data.id, patch);
    return updated ?? notFound(reply);
  });
}

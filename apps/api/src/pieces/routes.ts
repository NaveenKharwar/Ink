import {
  fromBase64,
  listPiecesQuery,
  searchQuery,
  syncPieceInput,
  toBase64,
  updatePieceInput,
  type LibraryResponse,
  type ListPiecesResponse,
  type SearchResponse,
  type SyncPieceOutput
} from "@ink/schemas";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { describeMatch, isLoose, openingLines, searchWords } from "./fold.js";
import { InvalidUpdateError } from "./merge.js";
import { describeNear, NEAR_POOL, nearest } from "./typo.js";
import type { EmbeddingQueue } from "../embeddings/queue.js";
import { MIN_CLOSE_SIMILARITY, type Meaning } from "../search/meaning.js";
import type { PiecesRepo } from "./repo.js";
import { perWriterLimit, tooMany } from "../rate-limit.js";

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

const SEARCH_LIMIT = 20;
// The dialog asks twice per pause in typing (words, then meaning), so this allows brisk typing
// but not a script hammering the embedder.
const SEARCHES_PER_MINUTE = 120;
const CLOSE_LIMIT = 5;

const notFound = (reply: FastifyReply) => reply.code(404).send({ error: "not_found", message: "This piece doesn't exist." });

export function registerPieceRoutes(app: FastifyInstance, repo: PiecesRepo, embeddings: EmbeddingQueue, meaning?: Meaning) {
  const searches = perWriterLimit(SEARCHES_PER_MINUTE, 60_000);

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
        stateVector: fromBase64(body.data.stateVector)
      });
    } catch (err) {
      if (err instanceof InvalidUpdateError) {
        return reply.code(400).send({ error: "invalid_request", message: "The update is not valid." });
      }
      throw err;
    }
    if (!outcome) return notFound(reply);
    if (body.data.update) void embeddings.enqueue(params.data.id);
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

  // The whole library in one light list: what the menu's seasons and All writing need.
  app.get("/api/library", async (request) => {
    const rows = await repo.library(request.userId);
    const response: LibraryResponse = {
      items: rows.map(({ id, title, text, status, language, style, isFragment, createdAt, updatedAt }) => ({
        id, title, status, lines: openingLines(text), language, style, isFragment, createdAt, updatedAt
      }))
    };
    return response;
  });

  // Search over the writer's own pieces only: the words first, then pieces close in meaning.
  app.get("/api/search", async (request, reply) => {
    const query = searchQuery.safeParse(request.query);
    if (!query.success) return invalid(reply, query.error);
    if (!searches.allow(request.userId)) return tooMany(reply);
    const words = searchWords(query.data.q);
    let rows = words.even.length ? await repo.search(request.userId, words, SEARCH_LIMIT) : [];
    // Nothing holds the words as typed: look again allowing a typo ("moonlihgt" finds "moonlight").
    const typed = rows.length === 0 && words.even.length > 0;
    if (typed) rows = nearest(await repo.nearPool(request.userId, NEAR_POOL), words, SEARCH_LIMIT);

    // Without an embedder, or when it can't be reached, the writer just gets the words. The words
    // are quick and meaning is not (it waits for the embedder), so the dialog can ask for each alone:
    // `part=words` skips meaning, `part=close` leaves the words out of the answer (they are still
    // looked up, to keep them out of the close pieces).
    let close: SearchResponse["close"] = [];
    if (meaning && words.even.length && query.data.part !== "words") {
      try {
        // A search the writer has moved on from (the dialog drops it) stops waiting for the embedder.
        const gone = new AbortController();
        request.raw.once("close", () => { if (!reply.raw.writableEnded) gone.abort(); });
        const [vector] = await meaning.embedder.embed([query.data.q], gone.signal);
        const found = vector ? await meaning.repo.closeTo(request.userId, vector, rows.map((r) => r.id), MIN_CLOSE_SIMILARITY, CLOSE_LIMIT) : [];
        close = found.map(({ id, text, language, style, isFragment, createdAt, updatedAt }) => ({
          id, language, style, isFragment, createdAt, updatedAt, firstLine: { text: openingLines(text)[0] ?? "", marks: [] }, match: null
        }));
      } catch (err) {
        request.log.warn({ err }, "Search by meaning is unavailable; answering with words only.");
      }
    }

    const response: SearchResponse = {
      items:
        query.data.part === "close"
          ? []
          : rows.map(({ id, text, language, style, isFragment, createdAt, updatedAt }) => ({
              id, language, style, isFragment, createdAt, updatedAt, ...(typed ? describeNear(text, words) : describeMatch(text, query.data.q, isLoose(language)))
            })),
      close
    };
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
    if (!updated) return notFound(reply);
    void embeddings.enqueue(params.data.id);
    return updated;
  });

  // Gone for good: no trash, no undo.
  app.delete("/api/pieces/:id", async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return notFound(reply);
    if (!(await repo.remove(request.userId, params.data.id))) return notFound(reply);
    return reply.code(204).send();
  });
}

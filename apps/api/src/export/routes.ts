import type { ExportResponse } from "@ink/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { decodeCursor, encodeCursor } from "../pieces/routes.js";
import { tooMany, type RateLimits } from "../rate-limit.js";
import type { ExportRepo } from "./repo.js";

const EXPORT_PAGE = 50;
const exportQuery = z.object({ cursor: z.string().min(1).max(200).optional() });

/** "Download all my writing": the device asks for the writer's pieces a page at a time and builds the file itself. */
export function registerExportRoutes(app: FastifyInstance, repo: ExportRepo, limits: RateLimits) {
  app.get("/api/export", async (request, reply) => {
    const query = exportQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_request", message: "The cursor is not valid." });
    const after = query.data.cursor ? decodeCursor(query.data.cursor) : undefined;
    if (after === null) return reply.code(400).send({ error: "invalid_request", message: "The cursor is not valid." });
    if (!(await limits.allow(request.userId, "exports"))) return tooMany(reply);

    const page = await repo.page(request.userId, { limit: EXPORT_PAGE, after });
    const response: ExportResponse = { items: page.items, nextCursor: page.next ? encodeCursor(page.next) : null };
    return response;
  });
}

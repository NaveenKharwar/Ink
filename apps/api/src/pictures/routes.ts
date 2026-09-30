import type { PictureListResponse, PictureUsesResponse } from "@ink/schemas";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { PicturesRepo } from "./repo.js";
import type { PictureStore, PictureType } from "./store.js";

// The web app resizes pictures before sending them (longest side 2400px), so real ones are far
// smaller than this.
export const PICTURE_MAX_BYTES = 5 * 1024 * 1024;

const idParams = z.object({ id: z.string().uuid() });
// `?size=small`: the small copy grids show. Without it, the picture as it is.
const sizeQuery = z.object({ size: z.enum(["small"]).optional() });
// The tiny blurred preview, sent with the picture as a header: a short data: URL, nothing else.
export const PREVIEW_HEADER = "ink-picture-preview";
const PREVIEW = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;
export const PREVIEW_MAX = 4000;

/** What the bytes really are, whatever the request says: only JPEG and WebP are kept. */
export function sniffPicture(bytes: Buffer): PictureType | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

const notFound = (reply: FastifyReply) => reply.code(404).send({ error: "not_found", message: "This picture doesn't exist." });

export function registerPictureRoutes(app: FastifyInstance, store: PictureStore, repo: PicturesRepo) {
  // Pictures arrive as their raw bytes, not JSON.
  app.addContentTypeParser(["image/jpeg", "image/webp"], { parseAs: "buffer", bodyLimit: PICTURE_MAX_BYTES }, (_request, body, done) =>
    done(null, body)
  );

  // The picture id is made on the device (like piece ids), so a retry uploads to the same place.
  app.put("/api/pictures/:id", async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return notFound(reply);
    const bytes = request.body;
    const type = Buffer.isBuffer(bytes) ? sniffPicture(bytes) : null;
    if (!Buffer.isBuffer(bytes) || !type) {
      return reply.code(415).send({ error: "unsupported_media_type", message: "Send the picture as JPEG or WebP." });
    }
    const query = sizeQuery.safeParse(request.query);
    if (!query.success) return notFound(reply);
    // The small copy is stored next to the picture; only the picture itself is listed.
    if (query.data.size === "small") {
      await store.put(request.userId, params.data.id, { bytes, type }, "small");
      return reply.code(204).send();
    }
    const header = request.headers[PREVIEW_HEADER];
    const preview = typeof header === "string" && header.length <= PREVIEW_MAX && PREVIEW.test(header) ? header : null;
    await store.put(request.userId, params.data.id, { bytes, type });
    await repo.add(request.userId, params.data.id, { type, bytes: bytes.length, preview });
    return reply.code(204).send();
  });

  // The Pictures page: every picture of the writer's, newest first, and the space they take.
  app.get("/api/pictures", async (request) => {
    const items = await repo.list(request.userId);
    const response: PictureListResponse = { items, totalBytes: items.reduce((sum, item) => sum + item.bytes, 0) };
    return response;
  });

  // Where a picture is used: the writer's own pieces only.
  app.get("/api/pictures/:id/uses", async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return notFound(reply);
    const uses = await repo.uses(request.userId, params.data.id);
    const response: PictureUsesResponse = {
      items: uses.map(({ id, title, text }) => ({ id, title, firstLine: text.split("\n").find((line) => line.trim())?.trim() ?? "" }))
    };
    return response;
  });

  // Deleting takes the picture out of every piece that uses it, then removes the file itself.
  app.delete("/api/pictures/:id", async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return notFound(reply);
    const found = await repo.remove(request.userId, params.data.id);
    if (!found) return notFound(reply);
    await store.delete(request.userId, params.data.id);
    return reply.code(204).send();
  });

  // Only ever from the signed-in writer's own folder: another writer's id finds nothing.
  app.get("/api/pictures/:id", async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return notFound(reply);
    const query = sizeQuery.safeParse(request.query);
    if (!query.success) return notFound(reply);
    const picture = await store.get(request.userId, params.data.id, query.data.size === "small" ? "small" : "full");
    if (!picture) return notFound(reply);
    return reply
      .header("Content-Type", picture.type)
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .send(picture.bytes);
  });
}

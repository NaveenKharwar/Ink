import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { listPiecesQuery, pictureListResponse, pictureUsesResponse, piece, searchQuery, syncPieceInput, syncPieceOutput, updatePieceInput } from "@ink/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// The docs are generated from the same Zod schemas the routes validate with,
// so they cannot drift from what the API accepts and returns.
const toSchema = (schema: z.ZodTypeAny) =>
  zodToJsonSchema(schema, { target: "openApi3", $refStrategy: "none", definitionPath: "components" }) as Record<string, unknown>;

const errorBody = z.object({ error: z.string(), message: z.string() });
const validationBody = z.object({
  error: z.literal("invalid_request"),
  issues: z.array(z.object({ path: z.string(), message: z.string() }))
});
const pieceSummary = piece.omit({ content: true });
const listBody = z.object({ items: z.array(pieceSummary), nextCursor: z.string().nullable() });
const libraryBody = z.object({
  items: z.array(
    piece.pick({ id: true, title: true, language: true, isFragment: true, createdAt: true, updatedAt: true }).extend({ lines: z.array(z.string()) })
  )
});
const markedLine = z.object({ text: z.string(), marks: z.array(z.tuple([z.number().int(), z.number().int()])) });
const searchBody = z.object({
  items: z.array(
    piece
      .pick({ id: true, language: true, isFragment: true, createdAt: true, updatedAt: true })
      .extend({ firstLine: markedLine, match: markedLine.nullable() })
  )
});

const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { "application/json": { schema: toSchema(schema) } }
});

const errors = {
  "401": json(errorBody, "Not signed in, or the session has expired."),
  "500": json(errorBody, "Something went wrong on the server. No internal details are included.")
};

const idParam = { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Ink API",
    version: "0.1.0",
    description:
      "Every /api route needs a Supabase access token: click Authorize and paste it. " +
      "Pieces are always limited to the signed-in writer: someone else's piece answers 404."
  },
  components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
  security: [{ bearer: [] }],
  paths: {
    "/health": {
      get: { summary: "Is the API running?", security: [], responses: { "200": json(z.object({ ok: z.boolean() }), "Running.") } }
    },
    "/api/pieces": {
      get: {
        summary: "List your pieces, newest first",
        description: "Leaves out `content`. Pass `nextCursor` back as `cursor` for the next page; it is null on the last page.",
        parameters: Object.entries((toSchema(listPiecesQuery).properties ?? {}) as Record<string, unknown>).map(([name, schema]) => ({
          name,
          in: "query",
          required: false,
          schema
        })),
        responses: { "200": json(listBody, "One page."), "400": json(errorBody, "Bad limit or cursor."), ...errors }
      }
    },
    "/api/library": {
      get: {
        summary: "Your whole library in one light list",
        description: "Every piece, newest written first, with its first two lines instead of the words. No paging (up to 5000).",
        responses: { "200": json(libraryBody, "All your pieces."), ...errors }
      }
    },
    "/api/search": {
      get: {
        summary: "Search your writing by its words",
        description:
          "Finds your pieces holding every word, or part of a word, in `q`: Hindi and English, and Hinglish typing finds Hindi writing. " +
          "Up to 20, best first. Each result has its first line and, when the words are on another line, that line; " +
          "`marks` are [start, end) offsets of the found words.",
        parameters: [{ name: "q", in: "query", required: true, schema: (toSchema(searchQuery).properties as Record<string, unknown>).q }],
        responses: { "200": json(searchBody, "Results, possibly none."), "400": json(validationBody, "No search words."), ...errors }
      }
    },
    "/api/pieces/{id}/sync": {
      post: {
        summary: "Write to a piece (and pick up changes from your other devices)",
        description:
          "The only way to write the words. The piece is created by its first sync, under an id the client makes. " +
          "`update` is Yjs data (base64) with the client's new changes; `stateVector` says what the client already has. " +
          "Title and language are in the Yjs data too (its `meta` map), so they merge like the words. " +
          "The answer holds what the client is missing. Merging is safe to repeat, so a retry changes nothing.",
        parameters: [idParam],
        requestBody: { required: true, content: { "application/json": { schema: toSchema(syncPieceInput) } } },
        responses: {
          "200": json(syncPieceOutput, "Merged. `update` holds what the client is missing."),
          "400": json(validationBody, "The body or the Yjs data is not valid."),
          "404": json(errorBody, "No such piece for you, and nothing to create it from."),
          ...errors
        }
      }
    },
    "/api/pieces/{id}": {
      get: {
        summary: "Get one piece",
        parameters: [idParam],
        responses: { "200": json(piece, "The piece, with `content`."), "404": json(errorBody, "No such piece for you."), ...errors }
      },
      patch: {
        summary: "Update a piece",
        description: "Send only the fields that change. The words, title and language are not written here (see sync).",
        parameters: [idParam],
        requestBody: { required: true, content: { "application/json": { schema: toSchema(updatePieceInput) } } },
        responses: {
          "200": json(piece, "Updated."),
          "400": json(validationBody, "The body is not valid, or empty."),
          "404": json(errorBody, "No such piece for you."),
          ...errors
        }
      }
    },
    "/api/pictures": {
      get: {
        summary: "List your pictures, newest first",
        description: "Every picture you stored (covers and pictures in Notes), with the space they take together.",
        responses: { "200": json(pictureListResponse, "Your pictures."), ...errors }
      }
    },
    "/api/pictures/{id}/uses": {
      get: {
        summary: "Which of your pieces use a picture",
        description: "Pieces with it as their cover or in their text, newest first. Another writer's picture id gives an empty list.",
        parameters: [idParam],
        responses: { "200": json(pictureUsesResponse, "The pieces, possibly none."), ...errors }
      }
    },
    "/api/pictures/{id}": {
      delete: {
        summary: "Delete one of your pictures",
        description: "Takes it out of every piece that uses it (as a normal change your devices merge), then deletes the file itself. Can't be undone.",
        parameters: [idParam],
        responses: { "204": { description: "Deleted." }, "404": json(errorBody, "No such picture for you."), ...errors }
      },
      put: {
        summary: "Store one of your pictures (a cover, or a picture in Notes)",
        description:
          "Send the picture's bytes, JPEG or WebP (checked by the bytes themselves), at most 5 MB. The id is made by the client; " +
          "sending the same id again replaces it, so a retry is safe. Pictures go to your own private folder only.",
        parameters: [idParam],
        requestBody: { required: true, content: { "image/webp": { schema: { type: "string", format: "binary" } }, "image/jpeg": { schema: { type: "string", format: "binary" } } } },
        responses: {
          "204": { description: "Stored." },
          "413": json(errorBody, "Larger than 5 MB."),
          "415": json(errorBody, "Not a JPEG or WebP picture."),
          ...errors
        }
      },
      get: {
        summary: "Get one of your pictures",
        description: "The picture's bytes. Only ever from your own folder: someone else's picture id answers 404.",
        parameters: [idParam],
        responses: {
          "200": { description: "The picture.", content: { "image/webp": { schema: { type: "string", format: "binary" } }, "image/jpeg": { schema: { type: "string", format: "binary" } } } },
          "404": json(errorBody, "No such picture for you."),
          ...errors
        }
      }
    }
  }
};

/** Interactive API docs at /docs. Development only. */
export async function registerDocs(app: FastifyInstance) {
  await app.register(swagger, { mode: "static", specification: { document: openApiDocument as never } });
  await app.register(swaggerUi, { routePrefix: "/docs" });
}

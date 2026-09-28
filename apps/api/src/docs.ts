import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { createPieceInput, listPiecesQuery, piece, updatePieceInput } from "@ink/schemas";
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
      post: {
        summary: "Create a piece",
        description:
          "`content` is the editor document. The API derives `text` from it. Send your own `id` to make retries safe: " +
          "sending the same id again returns the stored piece with 200.",
        requestBody: { required: true, content: { "application/json": { schema: toSchema(createPieceInput) } } },
        responses: {
          "201": json(piece, "Created."),
          "200": json(piece, "A piece with this id already exists for you; it is returned as stored."),
          "400": json(validationBody, "The body is not valid; `issues` lists each problem."),
          "409": json(errorBody, "This id is already used by someone else's piece."),
          ...errors
        }
      },
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
    "/api/pieces/{id}": {
      get: {
        summary: "Get one piece",
        parameters: [idParam],
        responses: { "200": json(piece, "The piece, with `content`."), "404": json(errorBody, "No such piece for you."), ...errors }
      },
      patch: {
        summary: "Update a piece",
        description: "Send only the fields that change. Changing `content` re-derives `text`. `title: null` clears the title.",
        parameters: [idParam],
        requestBody: { required: true, content: { "application/json": { schema: toSchema(updatePieceInput) } } },
        responses: {
          "200": json(piece, "Updated."),
          "400": json(validationBody, "The body is not valid, or empty."),
          "404": json(errorBody, "No such piece for you."),
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

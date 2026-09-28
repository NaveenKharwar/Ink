import type { FastifyError, FastifyInstance } from "fastify";

// Errors Fastify raises before our handlers run (bad JSON, wrong content type, too large).
// Their own messages are technical, so each gets a plain one here.
const KNOWN: Record<string, { status: number; error: string; message: string }> = {
  FST_ERR_CTP_INVALID_JSON_BODY: { status: 400, error: "invalid_request", message: "The request body is not valid JSON." },
  FST_ERR_CTP_EMPTY_JSON_BODY: { status: 400, error: "invalid_request", message: "The request body is empty." },
  FST_ERR_CTP_INVALID_MEDIA_TYPE: { status: 415, error: "unsupported_media_type", message: "Send the request body as JSON." },
  FST_ERR_CTP_BODY_TOO_LARGE: { status: 413, error: "too_large", message: "This is too large to save." }
};

/** Every error response is `{ error, message }`; server errors never include internal details. */
export function registerErrorHandling(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError, request, reply) => {
    const known = err.code ? KNOWN[err.code] : undefined;
    if (known) return reply.code(known.status).send({ error: known.error, message: known.message });

    const status = err.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      return reply.code(status).send({ error: "invalid_request", message: "The request could not be processed." });
    }

    request.log.error(err);
    return reply.code(500).send({ error: "server_error", message: "Something went wrong on our side. Try again in a moment." });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: "not_found", message: "There is nothing at this address." })
  );
}

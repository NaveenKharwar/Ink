import type { FastifyReply } from "fastify";

/**
 * Per-writer request limit over a fixed window, kept in memory (one API instance).
 * `allow` counts the request and says whether it may go ahead.
 */
export function perWriterLimit(max: number, windowMs: number, now: () => number = Date.now) {
  let windowStart = now();
  let counts = new Map<string, number>();
  return {
    allow(userId: string): boolean {
      const t = now();
      if (t - windowStart >= windowMs) {
        windowStart = t;
        counts = new Map();
      }
      const used = (counts.get(userId) ?? 0) + 1;
      counts.set(userId, used);
      return used <= max;
    }
  };
}

export const tooMany = (reply: FastifyReply) =>
  reply.code(429).send({ error: "too_many_requests", message: "That was a lot at once. Wait a moment and try again." });

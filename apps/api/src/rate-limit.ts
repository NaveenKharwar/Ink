import type { FastifyReply } from "fastify";
import type pg from "pg";

/** How many requests of each kind one writer may make in a window. */
export const LIMITS = {
  // The search dialog asks twice per pause in typing (words, then meaning), so this allows brisk
  // typing but not a script hammering the embedder.
  searches: { max: 120, windowMs: 60_000 },
  // Opening pieces asks for the Echoes panel (and All writing for Noticed) each time; this is far
  // above any reading pace.
  looks: { max: 60, windowMs: 60_000 },
  // Adding a picture sends two uploads (the picture, then its small copy).
  uploads: { max: 30, windowMs: 60_000 },
  // Each one sends an email to the writer's own address.
  deleteLinks: { max: 5, windowMs: 3_600_000 },
  // Downloading all the writing asks for it a page at a time.
  exports: { max: 120, windowMs: 60_000 }
} as const;

export type Bucket = keyof typeof LIMITS;
export type Limits = Record<Bucket, { max: number; windowMs: number }>;

/** Counts a writer's request of one kind and says whether it may go ahead. */
export interface RateLimits {
  allow(userId: string, bucket: Bucket): Promise<boolean>;
}

/**
 * Kept in Postgres, so the limits hold however many API machines answer: each writer's window
 * starts with their first request and lasts `windowMs`. The row is locked while it is counted,
 * so two machines counting at once never lose a request.
 */
export function pgRateLimits(db: pg.Pool, limits: Limits = LIMITS): RateLimits {
  return {
    async allow(userId, bucket) {
      const { max, windowMs } = limits[bucket];
      const { rows } = await db.query<{ used: number }>(
        `insert into rate_limits (user_id, bucket, window_start, used) values ($1, $2, now(), 1)
         on conflict (user_id, bucket) do update set
           window_start = case when rate_limits.window_start <= now() - make_interval(secs => $3) then now() else rate_limits.window_start end,
           used = case when rate_limits.window_start <= now() - make_interval(secs => $3) then 1 else rate_limits.used + 1 end
         returning used`,
        [userId, bucket, windowMs / 1000]
      );
      return rows[0]!.used <= max;
    }
  };
}

/** Kept in memory: for tests, and the default when no database is given. */
export function memoryRateLimits(now: () => number = Date.now, limits: Limits = LIMITS): RateLimits {
  const windows = new Map<string, { start: number; used: number }>();
  return {
    async allow(userId, bucket) {
      const { max, windowMs } = limits[bucket];
      const key = `${userId}|${bucket}`;
      const t = now();
      const current = windows.get(key);
      const window = current && t - current.start < windowMs ? current : { start: t, used: 0 };
      window.used += 1;
      windows.set(key, window);
      return window.used <= max;
    }
  };
}

export const tooMany = (reply: FastifyReply) =>
  reply.code(429).send({ error: "too_many_requests", message: "That was a lot at once. Wait a moment and try again." });

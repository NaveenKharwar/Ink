import { readFileSync } from "node:fs";
import pg from "pg";
import type { Env } from "./env.js";

export function createPool(env: Env, warn: (message: string) => void): pg.Pool {
  let ssl: pg.PoolConfig["ssl"];
  if (env.DATABASE_SSL_CA) {
    ssl = { ca: readFileSync(env.DATABASE_SSL_CA, "utf8") };
  } else if (env.NODE_ENV !== "development") {
    throw new Error("DATABASE_SSL_CA is required outside development (set NODE_ENV=development to skip it locally).");
  } else {
    ssl = { rejectUnauthorized: false };
    warn("DATABASE_SSL_CA is not set: the database certificate is not verified. Development only.");
  }
  return new pg.Pool({ connectionString: env.DATABASE_URL, ssl, max: 5 });
}

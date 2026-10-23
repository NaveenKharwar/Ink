import { fileURLToPath } from "node:url";
import { createPool } from "../db.js";
import { loadEnv } from "../env.js";
import { migrate } from "../migrate.js";

// Sets up the database, or brings it up to date: `pnpm db:migrate` from the repository root.
// Safe to repeat: files that already ran are skipped.
const dir = fileURLToPath(new URL("../../db/migrations", import.meta.url));
const pool = createPool(loadEnv(), (message) => console.warn(message));
try {
  const applied = await migrate(pool, dir, (line) => console.log(line));
  console.log(applied.length ? `${applied.length} migrations applied.` : "The database is up to date.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

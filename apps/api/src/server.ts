import { buildApp } from "./app.js";
import { supabaseTokenVerifier } from "./auth.js";
import { createPool } from "./db.js";
import { loadEnv } from "./env.js";
import { pgPiecesRepo } from "./pieces/repo.js";

const env = loadEnv();
const warnings: string[] = [];
const pool = createPool(env, (message) => warnings.push(message));

const app = await buildApp({
  repo: pgPiecesRepo(pool),
  verify: supabaseTokenVerifier(env.SUPABASE_URL),
  logger: true,
  docs: env.NODE_ENV !== "production"
});
for (const message of warnings) app.log.warn(message);

app.addHook("onClose", async () => {
  await pool.end();
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

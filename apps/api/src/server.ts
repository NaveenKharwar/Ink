import { buildApp } from "./app.js";
import { pgSessionCheck, supabaseTokenVerifier, withLiveSession } from "./auth.js";
import { createPool } from "./db.js";
import { httpEmbeddingProvider } from "./embeddings/http.js";
import { pgEmbeddingsRepo } from "./embeddings/repo.js";
import { noEmbeddingQueue, startEmbeddingQueue } from "./embeddings/queue.js";
import { loadEnv } from "./env.js";
import { fileLogStream } from "./logging.js";
import { pgPiecesRepo } from "./pieces/repo.js";
import { pgPicturesRepo } from "./pictures/repo.js";
import { pgRelatedRepo } from "./related/repo.js";
import { pgMeaningRepo } from "./search/meaning.js";
import { supabasePictureStore } from "./pictures/store.js";

const env = loadEnv();
const logFile = env.LOG_FILE ?? (env.NODE_ENV === "development" ? "logs/api.log" : undefined);
const warnings: string[] = [];
const pool = createPool(env, (message) => warnings.push(message));

// Meaning vectors are made in the background. Without an embedder nothing is queued and Related uses shared words.
const embeddings = env.EMBEDDER_URL
  ? await startEmbeddingQueue(pool, pgEmbeddingsRepo(pool), httpEmbeddingProvider(env.EMBEDDER_URL, undefined, undefined, env.EMBEDDER_SECRET), { warn: (m) => warnings.push(m) })
  : noEmbeddingQueue;

// Search by meaning embeds the typed words as the writer waits, so it gives up quickly and falls back to words.
const meaning = env.EMBEDDER_URL ? { repo: pgMeaningRepo(pool), embedder: httpEmbeddingProvider(env.EMBEDDER_URL, undefined, 5_000, env.EMBEDDER_SECRET) } : undefined;

const app = await buildApp({
  repo: pgPiecesRepo(pool),
  related: pgRelatedRepo(pool),
  pictures: { store: supabasePictureStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY), repo: pgPicturesRepo(pool) },
  verify: withLiveSession(supabaseTokenVerifier(env.SUPABASE_URL), pgSessionCheck(pool)),
  embeddings,
  meaning,
  logger: logFile ? fileLogStream(logFile) : true,
  docs: env.NODE_ENV === "development"
});
for (const message of warnings) app.log.warn(message);

app.addHook("onClose", async () => {
  await embeddings.stop();
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

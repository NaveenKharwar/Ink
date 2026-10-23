import { createPool } from "../db.js";
import { httpEmbeddingProvider } from "../embeddings/http.js";
import { rebuildEmbeddings } from "../embeddings/rebuild.js";
import { pgEmbeddingsRepo } from "../embeddings/repo.js";
import { loadEnv } from "../env.js";

// Makes every piece's vector again with the embedder as it is now. Run it after the way vectors are
// made changes, e.g. `pnpm --filter @ink/api embed:rebuild`. Needs EMBEDDER_URL. Logs ids, never words.
const env = loadEnv();
if (!env.EMBEDDER_URL) throw new Error("EMBEDDER_URL is not set: there is no embedder to ask.");
const pool = createPool(env, (message) => console.warn(message));
const provider = httpEmbeddingProvider(env.EMBEDDER_URL, undefined, undefined, env.EMBEDDER_SECRET);
const result = await rebuildEmbeddings(pgEmbeddingsRepo(pool), provider, (line) => console.warn(line));
console.log(`${result.done} of ${result.pieces} pieces embedded again${result.failed ? `, ${result.failed} failed (run it again)` : ""}.`);
await pool.end();

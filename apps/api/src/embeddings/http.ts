import { z } from "zod";
import { EMBEDDING_DIMENSIONS, type EmbeddingProvider } from "./provider.js";

const responseSchema = z.object({
  model: z.string(),
  vectors: z.array(z.array(z.number()).length(EMBEDDING_DIMENSIONS))
});

/** Calls the local embedder service (apps/embedder). */
export function httpEmbeddingProvider(baseUrl: string, model = "BAAI/bge-m3", timeoutMs = 60_000, secret?: string): EmbeddingProvider {
  const url = new URL("/embed", baseUrl);
  return {
    model,
    async embed(texts, signal) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(secret ? { "X-Embedder-Secret": secret } : {}) },
        body: JSON.stringify({ texts }),
        signal: signal ? AbortSignal.any([AbortSignal.timeout(timeoutMs), signal]) : AbortSignal.timeout(timeoutMs)
      });
      if (!res.ok) throw new Error(`Embedder answered ${res.status}.`);
      const { vectors } = responseSchema.parse(await res.json());
      if (vectors.length !== texts.length) throw new Error("Embedder returned the wrong number of vectors.");
      return vectors;
    }
  };
}

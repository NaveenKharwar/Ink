import { EMBEDDING_DIMENSIONS, type EmbeddingProvider } from "./provider.js";

/** For tests: the same words give the same vector, shared words give close vectors. No model needed. */
export function fakeEmbeddingProvider(): EmbeddingProvider & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    model: "fake",
    calls,
    async embed(texts) {
      calls.push(texts);
      return texts.map((text) => {
        const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
        for (const word of text.toLowerCase().match(/[\p{L}\p{M}]+/gu) ?? []) {
          let h = 0;
          for (const ch of word) h = (h * 31 + ch.codePointAt(0)!) % EMBEDDING_DIMENSIONS;
          v[h]! += 1;
        }
        const norm = Math.hypot(...v) || 1;
        return v.map((x) => x / norm);
      });
    }
  };
}

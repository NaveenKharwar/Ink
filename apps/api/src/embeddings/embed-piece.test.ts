import assert from "node:assert/strict";
import { test } from "node:test";
import { embedPiece } from "./embed-piece.js";
import { rebuildEmbeddings } from "./rebuild.js";
import { sweepStale } from "./queue.js";
import { fakeEmbeddingProvider } from "./fake.js";
import type { EmbeddableRow, EmbeddingsRepo } from "./repo.js";

function memoryRepo(pieces: Record<string, Omit<EmbeddableRow, "storedHash">>) {
  const stored = new Map<string, { userId: string; model: string; hash: string }>();
  const repo: EmbeddingsRepo = {
    async load(id) {
      const p = pieces[id];
      return p ? { ...p, storedHash: stored.get(id)?.hash ?? null } : null;
    },
    async save(id, userId, model, _vector, hash) {
      stored.set(id, { userId, model, hash });
    },
    async remove(id) {
      stored.delete(id);
    },
    async touch() {},
    async findStale() {
      return Object.keys(pieces).filter((id) => !stored.has(id));
    },
    async findAll() {
      return Object.keys(pieces).filter((id) => pieces[id]!.includeInMemory && pieces[id]!.text.trim() !== "");
    }
  };
  return { repo, stored, pieces };
}

const piece = { userId: "u1", title: "River", text: "quiet morning by the river", includeInMemory: true };

test("embeds a piece and stores it under its own writer", async () => {
  const { repo, stored } = memoryRepo({ a: piece });
  assert.equal(await embedPiece(repo, fakeEmbeddingProvider(), "a"), "embedded");
  assert.equal(stored.get("a")?.userId, "u1");
  assert.equal(stored.get("a")?.model, "fake");
});

test("skips a piece whose text has not changed", async () => {
  const { repo } = memoryRepo({ a: piece });
  const provider = fakeEmbeddingProvider();
  await embedPiece(repo, provider, "a");
  assert.equal(await embedPiece(repo, provider, "a"), "unchanged");
  assert.equal(provider.calls.length, 1);
});

test("embeds again when the text changes", async () => {
  const { repo, pieces } = memoryRepo({ a: { ...piece } });
  const provider = fakeEmbeddingProvider();
  await embedPiece(repo, provider, "a");
  pieces.a!.text = "a different evening";
  assert.equal(await embedPiece(repo, provider, "a"), "embedded");
  assert.equal(provider.calls.length, 2);
});

test("a piece kept out of memory has no vector and never reaches the model", async () => {
  const { repo, stored, pieces } = memoryRepo({ a: { ...piece } });
  const provider = fakeEmbeddingProvider();
  await embedPiece(repo, provider, "a");
  pieces.a!.includeInMemory = false;
  assert.equal(await embedPiece(repo, provider, "a"), "removed");
  assert.equal(stored.has("a"), false);
  assert.equal(provider.calls.length, 1);
});

test("an empty piece has no vector", async () => {
  const { repo } = memoryRepo({ a: { ...piece, title: null, text: "  " } });
  const provider = fakeEmbeddingProvider();
  assert.equal(await embedPiece(repo, provider, "a"), "removed");
  assert.equal(provider.calls.length, 0);
});

test("a deleted piece is ignored", async () => {
  const { repo } = memoryRepo({});
  assert.equal(await embedPiece(repo, fakeEmbeddingProvider(), "missing"), "gone");
});

test("a provider failure is thrown so the queue retries", async () => {
  const { repo, stored } = memoryRepo({ a: piece });
  const down = { model: "x", embed: async () => { throw new Error("down"); } };
  await assert.rejects(embedPiece(repo, down, "a"), /down/);
  assert.equal(stored.has("a"), false);
});

test("the sweep queues pieces that have no vector, and nothing once they do", async () => {
  const { repo } = memoryRepo({ a: piece, b: piece });
  const queued: string[] = [];
  assert.equal(await sweepStale(repo, async (id) => void queued.push(id)), 2);
  await embedPiece(repo, fakeEmbeddingProvider(), "a");
  await embedPiece(repo, fakeEmbeddingProvider(), "b");
  assert.equal(await sweepStale(repo, async (id) => void queued.push(id)), 0);
  assert.deepEqual(queued, ["a", "b"]);
});

test("rebuilding makes every vector again, even where the text has not changed", async () => {
  const { repo, stored } = memoryRepo({ a: piece, b: { ...piece, text: "evening rain" }, out: { ...piece, includeInMemory: false } });
  await embedPiece(repo, fakeEmbeddingProvider(), "a");
  let asked = 0;
  const counting = { model: "fake-2", embed: async (texts: string[]) => { asked += texts.length; return fakeEmbeddingProvider().embed(texts); } };
  const result = await rebuildEmbeddings(repo, counting);
  assert.deepEqual(result, { pieces: 2, done: 2, failed: 0 });
  assert.equal(asked, 2);
  assert.equal(stored.get("a")?.model, "fake-2");
  assert.equal(stored.has("out"), false);
});

test("a piece that fails while rebuilding is counted and the rest go on", async () => {
  const { repo, stored } = memoryRepo({ a: piece, b: { ...piece, text: "evening rain" } });
  const lines: string[] = [];
  const flaky = { model: "fake", embed: async (texts: string[]) => { if (texts[0]!.includes("evening")) throw new Error("Embedder answered 503."); return fakeEmbeddingProvider().embed(texts); } };
  const result = await rebuildEmbeddings(repo, flaky, (line) => lines.push(line));
  assert.deepEqual(result, { pieces: 2, done: 1, failed: 1 });
  assert.ok(stored.has("a"));
  assert.match(lines[0]!, /^Piece b could not be embedded: Embedder answered 503\.$/);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeEmbeddingProvider } from "./fake.js";
import { textHash } from "./hash.js";
import { EMBEDDING_DIMENSIONS } from "./provider.js";

const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i]!, 0);

test("fake provider gives one unit vector per text", async () => {
  const [a] = await fakeEmbeddingProvider().embed(["a quiet morning"]);
  assert.equal(a!.length, EMBEDDING_DIMENSIONS);
  assert.ok(Math.abs(dot(a!, a!) - 1) < 1e-9);
});

test("shared words are closer than unrelated words", async () => {
  const [a, b, c] = await fakeEmbeddingProvider().embed(["quiet morning river", "river morning light", "invoice spreadsheet budget"]);
  assert.ok(dot(a!, b!) > dot(a!, c!));
});

test("text hash changes only when the text changes", () => {
  assert.equal(textHash("same"), textHash("same"));
  assert.notEqual(textHash("same"), textHash("different"));
});

test("the embedder may only be on this machine or a private Tailscale address", async () => {
  const { isPrivateEmbedder } = await import("../env.js");
  for (const ok of ["http://127.0.0.1:8001", "http://localhost:8001", "http://[::1]:8001", "http://100.101.2.3:8001"]) assert.equal(isPrivateEmbedder(ok), true, ok);
  for (const bad of ["http://8.8.8.8:8001", "https://embed.example.com", "http://100.128.0.1", "http://10.0.0.5:8001"]) assert.equal(isPrivateEmbedder(bad), false, bad);
});

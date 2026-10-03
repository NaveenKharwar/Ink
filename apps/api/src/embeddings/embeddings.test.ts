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

test("the embedder may only be on this machine or a private Tailscale address or a listed private name", async () => {
  const { isPrivateEmbedder } = await import("../env.js");
  for (const ok of ["http://127.0.0.1:8001", "http://localhost:8001", "http://[::1]:8001", "http://100.101.2.3:8001"]) assert.equal(isPrivateEmbedder(ok), true, ok);
  for (const bad of ["http://8.8.8.8:8001", "https://embed.example.com", "http://100.128.0.1", "http://10.0.0.5:8001"]) assert.equal(isPrivateEmbedder(bad), false, bad);
});

test("private network names count only when listed in EMBEDDER_PRIVATE_HOSTS", async () => {
  const { isPrivateEmbedder, privateHostEntries, loadEnv } = await import("../env.js");
  const listed = privateHostEntries(" .Railway.internal, embedder.flycast ");
  for (const ok of ["http://embedder.railway.internal:8001", "http://embedder.flycast:8001"]) assert.equal(isPrivateEmbedder(ok, listed), true, ok);
  for (const bad of ["http://railway.internal.evil.com", "http://evil.com/.railway.internal", "http://embedderrailway.internal", "http://x.flycast"]) assert.equal(isPrivateEmbedder(bad, listed), false, bad);
  assert.equal(isPrivateEmbedder("http://embedder.railway.internal:8001"), false);
  const base = { DATABASE_URL: "postgres://x", SUPABASE_URL: "http://x.test", SUPABASE_SERVICE_ROLE_KEY: "k" };
  assert.throws(() => loadEnv({ ...base, EMBEDDER_URL: "http://embedder.railway.internal:8001" }), /EMBEDDER_URL/);
  assert.equal(loadEnv({ ...base, EMBEDDER_URL: "http://embedder.railway.internal:8001", EMBEDDER_PRIVATE_HOSTS: ".railway.internal" }).EMBEDDER_URL, "http://embedder.railway.internal:8001");
  assert.throws(() => loadEnv({ ...base, EMBEDDER_PRIVATE_HOSTS: "com" }), /two or more parts/);
});

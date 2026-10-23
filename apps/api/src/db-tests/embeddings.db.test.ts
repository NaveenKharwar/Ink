import assert from "node:assert/strict";
import { test } from "node:test";
import { embedPiece } from "../embeddings/embed-piece.js";
import { fakeEmbeddingProvider } from "../embeddings/fake.js";
import { rebuildEmbeddings } from "../embeddings/rebuild.js";
import { pgEmbeddingsRepo } from "../embeddings/repo.js";
import { pgPiecesRepo } from "../pieces/repo.js";
import { db, piece, writer } from "./setup.js";

const repo = pgEmbeddingsRepo(db);
const modelOf = async (id: string) => (await db.query("select model from piece_embeddings where piece_id = $1", [id])).rows[0]?.model ?? null;

test("the rebuild lists every piece that counts for memory, newest first, and nothing else", async () => {
  const asha = await writer();
  const older = await piece(asha, [["An older piece"]]);
  const newer = await piece(asha, [["A newer piece"]]);
  const keptOut = await piece(asha, [["Kept out of memory"]]);
  await pgPiecesRepo(db).update(asha, keptOut, { includeInMemory: false });
  const all = await repo.findAll();
  assert.ok(all.indexOf(newer) >= 0 && all.indexOf(newer) < all.indexOf(older));
  assert.ok(!all.includes(keptOut));
});

test("the rebuild makes a vector again even when the words have not changed", async () => {
  const asha = await writer();
  const id = await piece(asha, [["Rain on the tin roof, the whole house listening"]]);
  assert.equal(await embedPiece(repo, fakeEmbeddingProvider(), id), "embedded");
  assert.equal(await embedPiece(repo, fakeEmbeddingProvider(), id), "unchanged");
  assert.equal(await modelOf(id), "fake");

  const newer = { ...fakeEmbeddingProvider(), model: "fake-parts" };
  const result = await rebuildEmbeddings(repo, newer);
  assert.equal(result.failed, 0);
  assert.ok(result.done >= 1);
  assert.equal(await modelOf(id), "fake-parts");
  const { rows } = await db.query("select user_id from piece_embeddings where piece_id = $1", [id]);
  assert.deepEqual(rows, [{ user_id: asha }]);
});

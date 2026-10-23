import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { searchWords } from "../pieces/fold.js";
import { pgPiecesRepo } from "../pieces/repo.js";
import { db, piece, pieceUpdate, writer } from "./setup.js";

const repo = pgPiecesRepo(db);

test("a piece is created by its first sync and read back by its writer only", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  const id = await piece(asha, [["Rain on the tin roof,", "the whole house listening"]], { title: "Monsoon" });

  const mine = await repo.get(asha, id);
  assert.equal(mine?.title, "Monsoon");
  assert.equal(mine?.text, "Rain on the tin roof,\nthe whole house listening");
  assert.equal(await repo.get(ravi, id), null);
  assert.deepEqual((await repo.list(ravi, { limit: 50 })).items, []);
  assert.deepEqual(await repo.library(ravi), []);
  assert.equal((await repo.library(asha)).length, 1);
});

test("another writer can neither sync into a piece nor take its id", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  const id = await piece(asha, [["The kettle sang"]]);
  const theirs = await repo.sync(ravi, id, { update: pieceUpdate([["Ravi was here"]]), stateVector: new Uint8Array([0]) });
  assert.equal(theirs, null);
  assert.equal((await repo.get(asha, id))?.text, "The kettle sang");
  const { rows } = await db.query("select user_id from pieces where id = $1", [id]);
  assert.deepEqual(rows, [{ user_id: asha }]);
});

test("two devices' syncs merge, and a repeated sync changes nothing", async () => {
  const asha = await writer();
  const id = randomUUID();
  const first = pieceUpdate([["first line"]]);
  await repo.sync(asha, id, { update: first, stateVector: new Uint8Array([0]) });
  await repo.sync(asha, id, { update: pieceUpdate([["second device line"]]), stateVector: new Uint8Array([0]) });
  const once = (await repo.get(asha, id))?.text;
  await repo.sync(asha, id, { update: first, stateVector: new Uint8Array([0]) });
  assert.equal((await repo.get(asha, id))?.text, once);
  assert.ok(once?.includes("first line") && once.includes("second device line"));
});

test("search finds the writer's own words, never another writer's", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  const mine = await piece(asha, [["A heron waits by the canal"]]);
  await piece(ravi, [["A heron waits by the canal too"]]);
  const found = await repo.search(asha, searchWords("heron canal"), 20);
  assert.deepEqual(found.map((p) => p.id), [mine]);
  assert.deepEqual(await repo.search(asha, searchWords("nothingtofindhere"), 20), []);
  assert.deepEqual((await repo.nearPool(asha, 1000)).map((p) => p.id), [mine]);
});

test("a deleted piece is gone for good, and a device's old copy cannot bring it back", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  const id = await piece(asha, [["Delete me"]]);
  assert.equal(await repo.remove(ravi, id), false);
  assert.ok(await repo.get(asha, id));
  assert.equal(await repo.remove(asha, id), true);
  assert.equal(await repo.get(asha, id), null);
  const again = await repo.sync(asha, id, { update: pieceUpdate([["Delete me"]]), stateVector: new Uint8Array([0]) });
  assert.equal(again, null);
  assert.equal(await repo.get(asha, id), null);
});

test("flags change without touching last edited", async () => {
  const asha = await writer();
  const id = await piece(asha, [["Almost done"]]);
  const before = (await repo.get(asha, id))!.updatedAt;
  const after = await repo.update(asha, id, { status: "finished", includeInMemory: false });
  assert.equal(after?.status, "finished");
  assert.equal(after?.includeInMemory, false);
  assert.equal(after?.updatedAt, before);
  assert.equal(await repo.update(await writer(), id, { status: "draft" }), null);
});

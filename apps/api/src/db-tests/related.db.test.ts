import assert from "node:assert/strict";
import { test } from "node:test";
import { pgEmbeddingsRepo } from "../embeddings/repo.js";
import { pgPiecesRepo } from "../pieces/repo.js";
import { pgRelatedRepo } from "../related/repo.js";
import { pgMeaningRepo } from "../search/meaning.js";
import { db, piece, vector, writer } from "./setup.js";

const related = pgRelatedRepo(db);
const embeddings = pgEmbeddingsRepo(db);
const save = (id: string, userId: string, v: number[]) => embeddings.save(id, userId, "test", v, "hash");

test("Echoes look only at the writer's own pieces, with similarity worked out per writer", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  const current = await piece(asha, [["The river at dawn, mist on the water"]]);
  const close = await piece(asha, [["Morning fog over the slow river"]]);
  const far = await piece(asha, [["Tax forms and receipts on the desk"]]);
  const theirs = await piece(ravi, [["The river at dawn, mist on the water again"]]);
  await save(current, asha, vector(1));
  await save(close, asha, vector(1, 2, 0.3));
  await save(far, asha, vector(500));
  await save(theirs, ravi, vector(1));

  const found = await related.candidates(asha, current);
  assert.ok(found);
  const ids = found.others.map((o) => o.id);
  assert.ok(ids.includes(close) && ids.includes(far));
  assert.ok(!ids.includes(theirs), "another writer's piece is never a candidate");
  const score = (id: string) => found.others.find((o) => o.id === id)!.similarity!;
  assert.ok(score(close) > 0.9 && score(far) < 0.1);
  assert.equal(await related.candidates(ravi, current), null);
});

test("a piece kept out of memory has no Echoes and is never another's", async () => {
  const asha = await writer();
  const a = await piece(asha, [["One quiet line about the sea"]]);
  const b = await piece(asha, [["Another quiet line about the sea"]]);
  await pgPiecesRepo(db).update(asha, b, { includeInMemory: false });
  assert.deepEqual((await related.candidates(asha, a))!.others.map((o) => o.id), []);
  assert.equal((await related.candidates(asha, b))!.keptOut, true);
});

test("Not related needs both pieces to be the writer's, and Undo brings it back", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  const a = await piece(asha, [["Lanterns on the balcony"]]);
  const b = await piece(asha, [["Lanterns in the rain"]]);
  const theirs = await piece(ravi, [["Lanterns again"]]);
  assert.equal(await related.dismiss(ravi, a, b), false);
  assert.equal(await related.dismiss(asha, a, theirs), false);
  assert.equal(await related.dismiss(asha, a, b), true);
  assert.deepEqual((await related.candidates(asha, a))!.others.map((o) => o.id), []);
  assert.equal(await related.restore(asha, a, b), true);
  assert.deepEqual((await related.candidates(asha, a))!.others.map((o) => o.id), [b]);
});

test("Forgotten only records the writer's own pieces as shown", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  const a = await piece(asha, [["An old song"]]);
  const b = await piece(asha, [["Another old song"]]);
  const theirs = await piece(ravi, [["Their old song"]]);
  await related.markShown(asha, a, [b, theirs]);
  const { rows } = await db.query("select piece_id from forgotten_shown where user_id = $1", [asha]);
  assert.deepEqual(rows.map((r) => r.piece_id), [b]);
});

test("search by meaning returns only the writer's own close pieces", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  // The app always sets a language; meaning search leaves Hinglish pieces to the words.
  const mine = await piece(asha, [["Rain all night on the old tin roof"]], { language: "en" });
  const theirs = await piece(ravi, [["Rain all night on the old tin roof here too"]], { language: "en" });
  const hinglish = await piece(asha, [["Raat bhar tin ki chhat par baarish"]], { language: "hi-Latn" });
  await save(hinglish, asha, vector(7));
  await save(mine, asha, vector(7));
  await save(theirs, ravi, vector(7));
  const found = await pgMeaningRepo(db).closeTo(asha, vector(7), [], 0.53, 5);
  assert.deepEqual(found.map((p) => p.id), [mine]);
  assert.deepEqual(await pgMeaningRepo(db).closeTo(asha, vector(7), [mine], 0.53, 5), []);
});

test("a vector can only be saved under the piece's own writer", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  const id = await piece(asha, [["Mine"]]);
  await assert.rejects(save(id, ravi, vector(3)));
});

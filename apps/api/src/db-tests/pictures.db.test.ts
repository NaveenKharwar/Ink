import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { pgPicturesRepo } from "../pictures/repo.js";
import { pgPiecesRepo } from "../pieces/repo.js";
import { db, piece, writer } from "./setup.js";

const pictures = pgPicturesRepo(db);
const crop = { x: 0, y: 0, width: 100, height: 100 };

test("a writer's pictures are listed for them only", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  const id = randomUUID();
  await pictures.add(asha, id, { type: "image/jpeg", bytes: 1234, preview: null });
  assert.deepEqual((await pictures.list(asha)).map((p) => p.id), [id]);
  assert.deepEqual(await pictures.list(ravi), []);
});

test("deleting a picture takes it out of the writer's pieces, and another writer's delete does nothing", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  const picture = randomUUID();
  await pictures.add(asha, picture, { type: "image/webp", bytes: 50, preview: null });
  const covered = await piece(asha, [["Under the cover"]], { cover: { id: picture, crop } });
  assert.deepEqual((await pictures.uses(asha, picture)).map((u) => u.id), [covered]);
  assert.deepEqual(await pictures.uses(ravi, picture), []);

  assert.equal(await pictures.remove(ravi, picture), false);
  assert.equal((await pictures.list(asha)).length, 1);

  assert.equal(await pictures.remove(asha, picture), true);
  assert.deepEqual(await pictures.list(asha), []);
  const { rows } = await db.query("select picture_ids from pieces where id = $1", [covered]);
  assert.deepEqual(rows[0].picture_ids, []);
  assert.equal((await pgPiecesRepo(db).get(asha, covered))?.text, "Under the cover");
});

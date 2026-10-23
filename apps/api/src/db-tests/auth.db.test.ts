import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { pgSessionCheck } from "../auth.js";
import { db, writer } from "./setup.js";

test("a sign-in session counts only while it exists, has not ended, and is the writer's", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  const live = randomUUID();
  const ended = randomUUID();
  await db.query("insert into auth.sessions (id, user_id, created_at, not_after) values ($1, $2, now(), null), ($3, $2, now(), now() - interval '1 minute')", [live, asha, ended]);
  const isLive = pgSessionCheck(db);
  assert.equal(await isLive(live, asha), true);
  assert.equal(await isLive(live, ravi), false);
  assert.equal(await isLive(ended, asha), false);
  await db.query("delete from auth.sessions where id = $1", [live]);
  assert.equal(await isLive(live, asha), false);
});

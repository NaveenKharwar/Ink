import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { pgAccountRepo, type AccountAuth } from "../account/repo.js";
import { hashToken, newToken } from "../account/routes.js";
import { pgExportRepo } from "../export/repo.js";
import { pgPicturesRepo } from "../pictures/repo.js";
import { pgRateLimits } from "../rate-limit.js";
import { db, piece, writer } from "./setup.js";

const accounts = pgAccountRepo(db);
const crop = { x: 0, y: 0, width: 100, height: 100 };

// What Supabase's admin API does to the account: the row in auth.users goes, and every table that
// names the writer goes with it (on delete cascade).
const sqlAuth: AccountAuth = {
  async deleteUser(userId) {
    await db.query("delete from auth.users where id = $1", [userId]);
  }
};

/** Every public table that holds a writer's rows, so a table added later is checked too. */
async function writerTables(): Promise<string[]> {
  const { rows } = await db.query<{ table_name: string }>(
    "select table_name from information_schema.columns where table_schema = 'public' and column_name = 'user_id' order by table_name"
  );
  return rows.map((r) => r.table_name);
}

async function rowsOf(userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of await writerTables()) {
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from public.${table} where user_id = $1`, [userId]);
    counts[table] = rows[0]!.n;
  }
  return counts;
}

test("a link works for its own writer only while it is fresh, and a new one replaces it", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  await piece(asha, [["One"]]);
  const first = newToken();
  await accounts.saveDeletion(asha, hashToken(first), new Date(Date.now() + 60_000));
  const found = await accounts.findDeletion(hashToken(first));
  assert.equal(found?.userId, asha);
  assert.equal(found?.pieces, 1);
  assert.equal(found?.email, `${asha}@db-tests.test`);
  assert.equal(await accounts.findDeletion(hashToken(newToken())), null);

  const second = newToken();
  await accounts.saveDeletion(asha, hashToken(second), new Date(Date.now() + 60_000));
  assert.equal(await accounts.findDeletion(hashToken(first)), null, "the earlier link stops working");
  assert.equal((await accounts.findDeletion(hashToken(second)))?.userId, asha);

  const stale = newToken();
  await accounts.saveDeletion(ravi, hashToken(stale), new Date(Date.now() - 1000));
  assert.equal(await accounts.findDeletion(hashToken(stale)), null, "an expired link finds no one");
});

test("deleting an account leaves nothing of the writer's in any table, and another writer's things stay", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  const pictures = pgPicturesRepo(db);
  const picture = randomUUID();
  await pictures.add(asha, picture, { type: "image/jpeg", bytes: 10, preview: null });
  await piece(asha, [["A line of Asha's"]], { cover: { id: picture, crop } });
  await piece(ravi, [["A line of Ravi's"]]);
  await pgRateLimits(db).allow(asha, "searches");
  await accounts.saveDeletion(asha, hashToken(newToken()), new Date(Date.now() + 60_000));

  const before = await rowsOf(asha);
  // Positive controls: the check below would pass on an empty database.
  assert.ok(before.pieces! > 0 && before.pictures! > 0 && before.rate_limits! > 0 && before.account_deletions! > 0, JSON.stringify(before));
  const raviBefore = await rowsOf(ravi);

  await sqlAuth.deleteUser(asha);

  const after = await rowsOf(asha);
  assert.deepEqual(Object.values(after).filter((n) => n > 0), [], `left behind: ${JSON.stringify(after)}`);
  assert.equal(await accounts.emailOf(asha), null);
  const { rows } = await db.query("select 1 from auth.sessions where user_id = $1", [asha]);
  assert.equal(rows.length, 0, "no sign-in session is left");
  assert.deepEqual(await rowsOf(ravi), raviBefore);
});

test("the export pages through the writer's own pieces with their covers", async () => {
  const [asha, ravi] = [await writer(), await writer()];
  const cover = randomUUID();
  const ids: string[] = [];
  for (let i = 0; i < 55; i++) ids.push(await piece(asha, [[`Line ${i}`]], i === 0 ? { cover: { id: cover, crop }, title: "First" } : {}));
  await piece(ravi, [["Not Asha's"]]);

  const repo = pgExportRepo(db);
  const first = await repo.page(asha, { limit: 50 });
  assert.equal(first.items.length, 50);
  assert.ok(first.next);
  const second = await repo.page(asha, { limit: 50, after: first.next! });
  assert.equal(second.items.length, 5);
  assert.equal(second.next, null);

  const all = [...first.items, ...second.items];
  assert.deepEqual(new Set(all.map((p) => p.id)), new Set(ids));
  const titled = all.find((p) => p.title === "First");
  assert.equal(titled?.cover, cover);
  assert.equal(titled?.content.type, "doc");
  assert.ok(all.every((p) => p.id !== undefined && !JSON.stringify(p).includes("Not Asha's")));
});

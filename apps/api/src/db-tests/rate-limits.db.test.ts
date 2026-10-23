import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { buildApp } from "../app.js";
import type { PiecesRepo } from "../pieces/repo.js";
import { memoryPicturesRepo } from "../pictures/repo.js";
import { memoryPictureStore } from "../pictures/store.js";
import { LIMITS, pgRateLimits } from "../rate-limit.js";
import { memoryRelatedRepo } from "../related/repo.js";
import { db, writer } from "./setup.js";

test("the limits hold across two API machines counting at the same moment", async () => {
  // A second pool stands for a second API machine on the same database.
  const other = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  try {
    const [one, two] = [pgRateLimits(db), pgRateLimits(other)];
    const asha = await writer();
    const answers = await Promise.all(Array.from({ length: 200 }, (_, i) => (i % 2 ? one : two).allow(asha, "searches")));
    assert.equal(answers.filter(Boolean).length, LIMITS.searches.max);
  } finally {
    await other.end();
  }
});

test("each writer and each kind has its own allowance", async () => {
  const limits = pgRateLimits(db, { searches: { max: 1, windowMs: 60_000 }, looks: { max: 1, windowMs: 60_000 }, uploads: { max: 1, windowMs: 60_000 } });
  const [asha, ravi] = [await writer(), await writer()];
  assert.equal(await limits.allow(asha, "uploads"), true);
  assert.equal(await limits.allow(asha, "uploads"), false);
  assert.equal(await limits.allow(asha, "looks"), true);
  assert.equal(await limits.allow(ravi, "uploads"), true);
});

test("the allowance comes back when the window ends", async () => {
  const limits = pgRateLimits(db, { searches: { max: 2, windowMs: 1000 }, looks: LIMITS.looks, uploads: LIMITS.uploads });
  const asha = await writer();
  assert.deepEqual([await limits.allow(asha, "searches"), await limits.allow(asha, "searches"), await limits.allow(asha, "searches")], [true, true, false]);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(await limits.allow(asha, "searches"), true);
});

test("a deleted writer's counts go with them", async () => {
  const asha = await writer();
  await pgRateLimits(db).allow(asha, "looks");
  await db.query("delete from auth.users where id = $1", [asha]);
  const { rows } = await db.query("select count(*)::int as n from rate_limits where user_id = $1", [asha]);
  assert.equal(rows[0].n, 0);
});

test("two whole API apps on one database stop a writer's uploads at the allowance", async () => {
  const asha = await writer();
  const noPieces = {} as PiecesRepo;
  const make = () =>
    buildApp({
      repo: noPieces,
      related: memoryRelatedRepo(noPieces),
      pictures: { store: memoryPictureStore(), repo: memoryPicturesRepo() },
      verify: async (token) => ({ userId: token }),
      limits: pgRateLimits(db)
    });
  const [one, two] = [await make(), await make()];
  const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
  const codes: number[] = [];
  for (let i = 0; i < LIMITS.uploads.max + 2; i++) {
    const res = await (i % 2 ? one : two).inject({ method: "PUT", url: `/api/pictures/${randomUUID()}`, headers: { authorization: `Bearer ${asha}`, "content-type": "image/jpeg" }, payload: JPEG });
    codes.push(res.statusCode);
  }
  await one.close();
  await two.close();
  assert.equal(codes.filter((c) => c === 204).length, LIMITS.uploads.max);
  assert.deepEqual(codes.slice(LIMITS.uploads.max), [429, 429]);
});

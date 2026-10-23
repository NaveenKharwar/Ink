import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import { orderMigrations } from "./migrate.js";

test("migrations run in the order of their numbers, other files ignored", () => {
  assert.deepEqual(orderMigrations(["0002_b.sql", "README.md", "0001_a.sql"]), ["0001_a.sql", "0002_b.sql"]);
});

test("two migrations with one number are refused", () => {
  assert.throws(() => orderMigrations(["0001_a.sql", "0001_b.sql"]), /share the number 0001/);
});

test("a badly named migration is refused", () => {
  assert.throws(() => orderMigrations(["1_pieces.sql"]), /named like/);
});

test("the repository's own migrations are in order", () => {
  const names = readdirSync(new URL("../db/migrations", import.meta.url));
  assert.ok(orderMigrations(names).length > 0);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { perWriterLimit } from "./rate-limit.js";

test("each writer has their own allowance, and it comes back with the next window", () => {
  let t = 0;
  const limit = perWriterLimit(2, 1000, () => t);
  assert.deepEqual([limit.allow("a"), limit.allow("a"), limit.allow("a")], [true, true, false]);
  assert.equal(limit.allow("b"), true);
  t = 1000;
  assert.equal(limit.allow("a"), true);
});

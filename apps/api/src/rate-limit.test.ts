import assert from "node:assert/strict";
import { test } from "node:test";
import { LIMITS, memoryRateLimits } from "./rate-limit.js";

const small = { ...LIMITS, searches: { max: 2, windowMs: 1000 }, looks: { max: 1, windowMs: 1000 }, uploads: { max: 1, windowMs: 1000 } };

test("each writer has their own allowance for each kind, and it comes back with the next window", async () => {
  let t = 0;
  const limits = memoryRateLimits(() => t, small);
  assert.deepEqual([await limits.allow("a", "searches"), await limits.allow("a", "searches"), await limits.allow("a", "searches")], [true, true, false]);
  assert.equal(await limits.allow("b", "searches"), true);
  assert.equal(await limits.allow("a", "looks"), true);
  t = 999;
  assert.equal(await limits.allow("a", "searches"), false);
  t = 1000;
  assert.equal(await limits.allow("a", "searches"), true);
});

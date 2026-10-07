import assert from "node:assert/strict";
import { test } from "node:test";
import { KEPT_OUT_BODY, keepOutAction } from "./keepOut";

test("each state names what its action does", () => {
  assert.equal(keepOutAction(false), "Keep it out of Ink’s memory");
  assert.equal(keepOutAction(true), "Put it back in Ink’s memory");
});

test("the kept-out panel says what it means, without jargon", () => {
  assert.match(KEPT_OUT_BODY, /^Kept out of Ink’s memory\./);
  assert.doesNotMatch(KEPT_OUT_BODY + keepOutAction(true) + keepOutAction(false), /undo|embed|vector|index/i);
});

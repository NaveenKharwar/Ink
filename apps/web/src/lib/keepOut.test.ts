import assert from "node:assert/strict";
import { test } from "node:test";
import { KEPT_OUT_BODY, MEMORY_LABEL, memoryHint } from "./keepOut";

test("the switch says what each state means", () => {
  assert.equal(MEMORY_LABEL, "Ink remembers this");
  assert.equal(memoryHint(false), "Turn off to keep it private.");
  assert.equal(memoryHint(true), "Kept out of Ink’s memory.");
});

test("the kept-out panel says what it means, without jargon", () => {
  assert.match(KEPT_OUT_BODY, /^Kept out of Ink’s memory\./);
  assert.doesNotMatch(KEPT_OUT_BODY + MEMORY_LABEL + memoryHint(true) + memoryHint(false), /undo|embed|vector|index/i);
});

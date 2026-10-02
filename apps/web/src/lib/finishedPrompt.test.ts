import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_WORDS, spotFor } from "./finishedPrompt";

const draft = { finished: false, words: MIN_WORDS, saved: true };

test("a saved draft of some length carries Mark finished", () => {
  assert.equal(spotFor(draft), "mark");
});

test("a start, or writing that is not saved yet, carries nothing", () => {
  assert.equal(spotFor({ ...draft, words: MIN_WORDS - 1 }), "none");
  assert.equal(spotFor({ ...draft, saved: false }), "none");
});

test("a finished piece always shows Finished, whatever its length or save state", () => {
  assert.equal(spotFor({ finished: true, words: 3, saved: false }), "finished");
});

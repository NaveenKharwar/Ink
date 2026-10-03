import assert from "node:assert/strict";
import { test } from "node:test";
import { searchWords } from "./fold.js";
import { allowedTypos, describeNear, distance, nearest, nearScore } from "./typo.js";

test("a swap of two neighbouring letters is one mistake", () => {
  assert.equal(distance("moonlihgt", "moonlight", 2), 1);
  assert.equal(distance("kettle", "kettel", 2), 1);
  assert.equal(distance("rain", "ruin", 2), 1);
  assert.equal(distance("rain", "storm", 2), 3);
});

test("longer words are allowed more typos, short words none", () => {
  assert.deepEqual([3, 4, 7, 8, 12].map(allowedTypos), [0, 1, 1, 2, 2]);
});

test("every searched word must be there, give or take a typo", () => {
  const words = searchWords("moonlihgt rain");
  assert.equal(nearScore("Moonlight and rain", words), 1);
  assert.equal(nearScore("Moonlight only", words), null);
  assert.equal(nearScore("the cat sat", searchWords("cta")), null);
});

test("fewest typos first, then the order given", () => {
  const pieces = [{ text: "a kettel boiled" }, { text: "a kettle boiled" }, { text: "no match" }, { text: "kettle and kettel" }];
  const found = nearest(pieces, searchWords("kettle"), 10);
  assert.deepEqual(found.map((p) => p.text), ["a kettle boiled", "kettle and kettel", "a kettel boiled"]);
});

test("marks the words that are close", () => {
  const found = describeNear("Hello\nthe kettel is on", searchWords("kettle"));
  assert.deepEqual(found.match, { text: "the kettel is on", marks: [[4, 10]] });
});

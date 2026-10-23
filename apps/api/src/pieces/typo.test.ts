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

test("fewest typos first, then the order given", async () => {
  const pieces = [{ text: "a kettel boiled" }, { text: "a kettle boiled" }, { text: "no match" }, { text: "kettle and kettel" }];
  const found = await nearest(pieces, searchWords("kettle"), 10);
  assert.deepEqual(found.map((p) => p.text), ["a kettle boiled", "kettle and kettel", "a kettel boiled"]);
});

test("marks the words that are close", () => {
  const found = describeNear("Hello\nthe kettel is on", searchWords("kettle"));
  assert.deepEqual(found.match, { text: "the kettel is on", marks: [[4, 10]] });
});

test("a long search lets other work run while it reads", async () => {
  // A thousand long pieces of made-up words: slow enough to notice if the search held everything up.
  const syllables = ["ka", "ri", "mo", "sel", "ten", "dar", "vu", "lin", "op", "nor", "bel", "sun"];
  let n = 0;
  const word = () => syllables[n++ % 12]! + syllables[(n * 7) % 12]! + syllables[(n * 5) % 11]!;
  const pieces = Array.from({ length: 1000 }, () => ({ text: Array.from({ length: 1500 }, word).join(" ") }));
  let longestWait = 0;
  let last = performance.now();
  const ticker = setInterval(() => {
    const now = performance.now();
    longestWait = Math.max(longestWait, now - last);
    last = now;
  }, 1);
  const started = performance.now();
  await nearest(pieces, searchWords("zqxwvkpl"), 20);
  const took = performance.now() - started;
  // One more tick, so a search that held everything up is counted.
  await new Promise((resolve) => setTimeout(resolve, 5));
  clearInterval(ticker);
  assert.ok(took > 100, `the search should take a while here (took ${took.toFixed(0)} ms)`);
  assert.ok(longestWait < 60, `other work waited ${longestWait.toFixed(0)} ms`);
});

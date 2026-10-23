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

test("remembering pairs and pausing find the same pieces in the same order as scoring each piece alone", async () => {
  // Made-up words in Latin and Devanagari, some pieces with titles, some long.
  const syllables = ["ka", "ri", "mo", "sel", "ten", "dar", "vu", "lin", "op", "nor", "bel", "sun", "चा", "नी", "रा"];
  let seed = 11;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const word = () => Array.from({ length: 2 + Math.floor(rnd() * 3) }, () => syllables[Math.floor(rnd() * syllables.length)]).join("");
  const text = (words: number) => Array.from({ length: words }, () => word() + (rnd() < 0.1 ? "\n" : " ")).join("");
  const pieces = Array.from({ length: 300 }, (_, i) => ({ title: rnd() < 0.3 ? word() : null, text: text(i % 10 === 0 ? 1500 : 120) }));
  const typo = (w: string) => { const a = [...w]; a[Math.floor(rnd() * a.length)] = "x"; return a.join(""); };

  // The way the search worked before: every piece scored on its own, nothing remembered.
  const alone = (words: ReturnType<typeof searchWords>) =>
    pieces
      .map((piece, order) => ({ piece, order, score: nearScore(piece.title ? `${piece.title}\n${piece.text}` : piece.text, words) }))
      .filter((s): s is { piece: (typeof pieces)[number]; order: number; score: number } => s.score !== null)
      .sort((a, b) => a.score - b.score || a.order - b.order)
      .slice(0, 20)
      .map((s) => s.piece);

  let found = 0;
  for (let q = 0; q < 60; q++) {
    const from = pieces[Math.floor(rnd() * pieces.length)]!.text.split(/\s+/).filter((w) => [...w].length >= 4);
    const words = searchWords(Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => typo(from[Math.floor(rnd() * from.length)] ?? "zzzz")).join(" "));
    if (words.even.every((w) => allowedTypos([...w].length) === 0)) continue;
    const expected = alone(words);
    assert.deepEqual(await nearest(pieces, words, 20), expected);
    if (expected.length) found += 1;
  }
  assert.ok(found > 20, `most searches should find something (${found})`);
});

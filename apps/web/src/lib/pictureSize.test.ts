/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { fitWithin } from "./pictureSize.ts";

test("a big photo shrinks to 2400px on its longest side, keeping its shape", () => {
  assert.deepEqual(fitWithin(4032, 3024), { width: 2400, height: 1800 });
  assert.deepEqual(fitWithin(3024, 4032), { width: 1800, height: 2400 });
});

test("a small picture is never enlarged", () => {
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
});

test("a very thin picture keeps at least one pixel", () => {
  assert.deepEqual(fitWithin(10000, 2), { width: 2400, height: 1 });
});

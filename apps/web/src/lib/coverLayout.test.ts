/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { COVER_ASPECT, coverLayout, middleCrop } from "./coverLayout.ts";

const photo = { width: 2400, height: 1600 };
const desktop = { width: 820, height: 220 };
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.01, `${a} ≈ ${b}`);

test("on desktop the chosen crop fills the band exactly", () => {
  // A strip across the top third, in the cover's shape.
  const crop = { x: 0, y: 0, width: 100, height: ((2400 / COVER_ASPECT) / 1600) * 100 };
  const at = coverLayout(photo, crop, desktop);
  near(at.width, 820);
  near(at.top, 0);
  near(at.left, 0);
});

test("a zoomed-in crop is enlarged and centred", () => {
  const crop = { x: 25, y: 40, width: 50, height: ((1200 / COVER_ASPECT) / 1600) * 100 };
  const at = coverLayout(photo, crop, desktop);
  near(at.width, 1640);
  near(at.left, 410 - 0.5 * 1640);
});

test("a taller band (phone) shows more around the crop but never an empty edge", () => {
  const crop = { x: 0, y: 0, width: 100, height: 20 };
  const at = coverLayout(photo, crop, { width: 390, height: 150 });
  assert.ok(at.width >= 390 && at.height >= 150);
  assert.ok(at.left <= 0 && at.left >= 390 - at.width);
  assert.ok(at.top <= 0 && at.top >= 150 - at.height);
});

test("the starting crop is the cover's shape across the middle", () => {
  const wide = middleCrop(photo);
  assert.equal(wide.x, 0);
  near(wide.width, 100);
  near((wide.width / 100) * 2400 / ((wide.height / 100) * 1600), COVER_ASPECT);
  near(wide.y + wide.height / 2, 50);
  const panorama = middleCrop({ width: 6000, height: 1000 });
  near(panorama.height, 100);
  near(panorama.x + panorama.width / 2, 50);
});

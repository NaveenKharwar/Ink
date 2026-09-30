import assert from "node:assert/strict";
import { test } from "node:test";
import { blend, easeOut, hoverShape, isJoined, SHAPES, WOBBLE_PERIOD_MS, wobble } from "./connectionsMark";

const gap = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]);

test("at rest the dots sit well apart, joined by light threads, and nothing else; hovered, the threads strengthen", () => {
  const rest = SHAPES.rest;
  assert.deepEqual([rest.sa, rest.sb, rest.sc], [0, 0, 0]);
  assert.deepEqual([rest.ab, rest.ac, rest.bc], [1, 1, 1]);
  assert.ok(gap(rest.a, rest.b) > 12 && gap(rest.b, rest.c) > 12, "the dots have room between them");
  assert.ok(SHAPES.hover.tw > rest.tw, "the threads are stronger on hover");
  assert.deepEqual([SHAPES.hover.sa, SHAPES.hover.sb, SHAPES.hover.sc], [0, 0, 0]);
});

test("pressed and open keep the rest triangle", () => {
  assert.deepEqual(SHAPES.press, SHAPES.rest);
  assert.deepEqual(SHAPES.active, SHAPES.rest);
});

test("every state keeps the dots inside the 24-point mark", () => {
  for (const shape of Object.values(SHAPES)) {
    for (const [dot, r] of [[shape.a, shape.ra], [shape.b, shape.rb], [shape.c, shape.rc]] as const) {
      assert.ok(dot[0] - r >= 0.5 && dot[0] + r <= 23.5 && dot[1] - r >= 0.5 && dot[1] + r <= 23.5, JSON.stringify(dot));
    }
  }
});

test("while hovered the dots drift gently, endlessly, and stay inside the mark", () => {
  const start = wobble(0).flat();
  const end = wobble(WOBBLE_PERIOD_MS).flat();
  start.forEach((v, i) => assert.ok(Math.abs(v - end[i]!) < 1e-9, "it repeats exactly after one period"));
  let moved = 0;
  for (let ms = 0; ms < WOBBLE_PERIOD_MS * 2; ms += 50) {
    const shape = hoverShape(ms);
    for (const [dot, r] of [[shape.a, shape.ra], [shape.b, shape.rb], [shape.c, shape.rc]] as const) {
      assert.ok(dot[0] - r >= 0 && dot[0] + r <= 24 && dot[1] - r >= 0 && dot[1] + r <= 24);
    }
    moved = Math.max(moved, gap(shape.a, SHAPES.hover.a));
    assert.ok(gap(shape.a, SHAPES.hover.a) < 1, "a small drift, not a jump");
  }
  assert.ok(moved > 0.2, "it really moves");
});

test("blending goes from one shape to the other and back", () => {
  assert.deepEqual(blend(SHAPES.rest, SHAPES.active, 0), SHAPES.rest);
  assert.deepEqual(blend(SHAPES.rest, SHAPES.active, 1), SHAPES.active);
  const mid = blend(SHAPES.rest, SHAPES.hover, 0.5);
  assert.equal(mid.tw, (SHAPES.rest.tw + SHAPES.hover.tw) / 2);
});

test("the easing starts fast, ends at one, and never overshoots", () => {
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  assert.ok(easeOut(0.3) > 0.3);
  for (let t = 0; t <= 1; t += 0.05) assert.ok(easeOut(t) >= 0 && easeOut(t) <= 1);
});

test("only the joined states take the accent colour", () => {
  assert.deepEqual((["rest", "hover", "press", "active"] as const).map(isJoined), [false, false, true, true]);
});

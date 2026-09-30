/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { letGo, makeThread, stepThread } from "./thread";

const settle = (steps: number, pin = { x: 100, y: 50 }) => {
  const t = makeThread(pin.x, pin.y, 16, 6);
  for (let i = 0; i < steps; i++) stepThread(t, pin, i * 16, 0);
  return t;
};

test("a thread hangs straight down from its pin, about its full length", () => {
  const t = settle(400);
  const end = t.points.at(-1)!;
  assert.equal(t.points[0]!.x, 100);
  assert.equal(t.points[0]!.y, 50);
  assert.ok(Math.abs(end.x - 100) < 1);
  assert.ok(end.y - 50 > 15 * 6 * 0.95);
});

test("a thread drifts right when it lets go on desktop", () => {
  const t = settle(400);
  letGo(t, "drift");
  for (let i = 0; i < 120; i++) stepThread(t, { x: 0, y: 0 }, i * 16, 0);
  assert.ok(t.points[0]!.x > 130);
});

test("a thread falls when it lets go on a phone", () => {
  const t = settle(400);
  letGo(t, "fall");
  for (let i = 0; i < 60; i++) stepThread(t, { x: 0, y: 0 }, i * 16, 0);
  assert.ok(t.points[0]!.y > 200);
});

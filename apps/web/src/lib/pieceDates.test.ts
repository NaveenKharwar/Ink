import assert from "node:assert/strict";
import { test } from "node:test";
import { pieceDatesText } from "./pieceDates";

test("written and edited on different days in the same year", () => {
  assert.equal(pieceDatesText("2025-07-14T09:00:00Z", "2025-08-02T10:00:00Z", "Asia/Kolkata"), "14 July 2025 · edited 2 August");
});

test("the edit date keeps its year when the year differs", () => {
  assert.equal(pieceDatesText("2024-12-30T09:00:00Z", "2025-01-03T10:00:00Z", "UTC"), "30 December 2024 · edited 3 January 2025");
});

test("one date when it was only touched the day it was written", () => {
  assert.equal(pieceDatesText("2025-07-14T03:00:00Z", "2025-07-14T15:00:00Z", "UTC"), "14 July 2025");
});

test("days follow the writer's time zone", () => {
  // 20:00 UTC on 14 July is already 15 July in India.
  assert.equal(pieceDatesText("2025-07-14T10:00:00Z", "2025-07-14T20:00:00Z", "Asia/Kolkata"), "14 July 2025 · edited 15 July");
  assert.equal(pieceDatesText("2025-07-14T10:00:00Z", "2025-07-14T20:00:00Z", "UTC"), "14 July 2025");
});

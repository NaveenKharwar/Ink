import assert from "node:assert/strict";
import { test } from "node:test";
import { noteLabel, seasonColorVar } from "./related";

const NOW = new Date("2026-09-30T00:00:00Z");

test("a note's label is its season, then its title", () => {
  assert.equal(noteLabel({ createdAt: "2025-08-10T00:00:00Z", title: "Rain on the tin roof" }, "south-asia", NOW, "Asia/Kolkata"), "Monsoon 2025 · Rain on the tin roof");
  assert.equal(noteLabel({ createdAt: "2025-08-10T00:00:00Z", title: "  " }, "south-asia", NOW, "Asia/Kolkata"), "Monsoon 2025");
  assert.equal(noteLabel({ createdAt: "2026-09-10T00:00:00Z", title: null }, "south-asia", NOW, "Asia/Kolkata"), "Now");
});

test("a note's colour is its season's", () => {
  assert.equal(seasonColorVar("2025-08-10T00:00:00Z", "Asia/Kolkata", "south-asia"), "var(--season-monsoon)");
  assert.equal(seasonColorVar("2025-01-10T00:00:00Z", "Asia/Kolkata", "south-asia"), "var(--season-winter)");
});

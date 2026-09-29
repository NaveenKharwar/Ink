/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { seasonPlace, seasonSetFor, seasonText } from "./seasons.ts";

const d = (iso: string) => new Date(iso);
const place = (iso: string, tz: string) => {
  const p = seasonPlace(d(iso), tz);
  return `${p.name} ${p.year}`;
};

test("the time zone picks the season set", () => {
  assert.equal(seasonSetFor("Asia/Kolkata"), "south-asia");
  assert.equal(seasonSetFor("Australia/Sydney"), "south");
  assert.equal(seasonSetFor("America/Argentina/Buenos_Aires"), "south");
  assert.equal(seasonSetFor("Europe/London"), "north");
  assert.equal(seasonSetFor("UTC"), "north");
});

test("South Asia has a monsoon", () => {
  assert.equal(place("2025-08-10T12:00:00Z", "Asia/Kolkata"), "Monsoon 2025");
  assert.equal(place("2025-04-10T12:00:00Z", "Asia/Kolkata"), "Spring 2025");
  assert.equal(place("2025-06-10T12:00:00Z", "Asia/Kolkata"), "Summer 2025");
  assert.equal(place("2024-11-10T12:00:00Z", "Asia/Kolkata"), "Autumn 2024");
});

test("a winter across New Year belongs to the year it ends in", () => {
  assert.equal(place("2024-12-20T12:00:00Z", "Asia/Kolkata"), "Winter 2025");
  assert.equal(place("2025-02-10T12:00:00Z", "Asia/Kolkata"), "Winter 2025");
  assert.equal(place("2024-12-20T12:00:00Z", "Australia/Sydney"), "Summer 2025");
});

test("the southern hemisphere flips the seasons", () => {
  assert.equal(place("2025-07-10T12:00:00Z", "Australia/Sydney"), "Winter 2025");
  assert.equal(place("2025-07-10T12:00:00Z", "Europe/London"), "Summer 2025");
});

test("months are read on the writer's own clock", () => {
  // 30 Sep 20:00 UTC is already 1 October in India, still 30 September in London.
  assert.equal(place("2026-09-30T20:00:00Z", "Asia/Kolkata"), "Autumn 2026");
  assert.equal(place("2026-09-30T17:00:00Z", "Asia/Kolkata"), "Monsoon 2026");
  assert.equal(place("2026-08-31T23:30:00Z", "Europe/London"), "Autumn 2026");
});

test("a season reads Now, its name this year, or name and year before", () => {
  const now = d("2026-09-28T12:00:00Z");
  const text = (iso: string) => seasonText(d(iso), now, "Asia/Kolkata");
  assert.equal(text("2026-07-02T12:00:00Z"), "Now");
  assert.equal(text("2026-06-02T12:00:00Z"), "Summer");
  assert.equal(text("2025-12-15T12:00:00Z"), "Winter");
  assert.equal(text("2025-08-15T12:00:00Z"), "Monsoon 2025");
});

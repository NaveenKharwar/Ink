import assert from "node:assert/strict";
import { test } from "node:test";
import type { Noticed } from "@ink/schemas";
import { noticedLine, noticedSentence } from "./noticed";

const noticed = (lines: string[]): Noticed => ({
  kind: "returns",
  note: { id: "a", title: null, lines, language: "en", style: "poem", createdAt: "2025-08-10T00:00:00Z", updatedAt: "2025-08-10T00:00:00Z" }
});

test("the remark names the season the old line was written in", () => {
  assert.equal(noticedSentence(noticed(["Rain on the tin roof"]), "south-asia", "Asia/Kolkata"), "You wrote that in Monsoon 2025.");
  assert.equal(noticedSentence(noticed(["Rain on the tin roof"]), "north", "America/New_York"), "You wrote that in Summer 2025.");
});

test("the old line is the piece's first line, or nothing", () => {
  assert.equal(noticedLine(noticed(["  Rain on the tin roof ", "second"])), "Rain on the tin roof");
  assert.equal(noticedLine(noticed([])), null);
});

test("three of the same thing name the three seasons, oldest first", () => {
  const repeats: Noticed = { ...noticed(["I keep waiting at the station"]), kind: "repeats", dates: ["2024-12-10T00:00:00Z", "2025-08-10T00:00:00Z", "2026-03-10T00:00:00Z"] } as Noticed;
  assert.equal(noticedSentence(repeats, "south-asia", "Asia/Kolkata"), "You've written this three times: Winter 2025, Monsoon 2025, Spring 2026.");
});

test("the same idea in two languages says which came first", () => {
  const hindi = { ...noticed(["बारिश में टीन की छत बोलती रही"]).note, language: "hi" as const };
  assert.equal(
    noticedSentence({ kind: "crosses", note: hindi, other: { language: "en", createdAt: "2026-03-10T00:00:00Z" } }, "south-asia", "Asia/Kolkata"),
    "You wrote this in Hindi in Monsoon 2025, and in English in Spring 2026."
  );
  assert.equal(
    noticedSentence({ kind: "crosses", note: hindi, other: { language: "en", createdAt: "2024-03-10T00:00:00Z" } }, "south-asia", "Asia/Kolkata"),
    "You wrote this in English in Spring 2024, and in Hindi in Monsoon 2025."
  );
});

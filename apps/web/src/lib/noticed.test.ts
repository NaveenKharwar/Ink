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

import assert from "node:assert/strict";
import { test } from "node:test";
import type { PieceStyle } from "@ink/schemas";
import type { SeasonGroup } from "./seasons";
import { styleCounts, withStyle } from "./styleFilter";

type Item = { id: string; style: PieceStyle | null };
const group = (key: string, divider: string | null, items: Item[]): SeasonGroup<Item> => ({ key, label: key, text: key, divider, items });

const groups = [
  group("2026-Monsoon", null, [{ id: "a", style: null }, { id: "b", style: "notes" }]),
  group("2025-Winter", "— 2025 —", [{ id: "c", style: "poem" }]),
  group("2025-Autumn", null, [{ id: "d", style: "notes" }]),
  group("2024-Spring", "— 2024 —", [{ id: "e", style: "story" }])
];

test("counts each style the list holds, a piece without a style counting as a Poem, and leaves out styles with none", () => {
  assert.deepEqual(styleCounts(groups.flatMap((g) => g.items)), [
    { style: "poem", count: 2 },
    { style: "story", count: 1 },
    { style: "notes", count: 2 }
  ]);
  assert.deepEqual(styleCounts([{ style: "notes" }, { style: "notes" }]), [{ style: "notes", count: 2 }]);
});

test("no style keeps the list as it is", () => {
  assert.equal(withStyle(groups, null), groups);
});

test("one style keeps only its pieces and drops the seasons left empty", () => {
  const notes = withStyle(groups, "notes");
  assert.deepEqual(notes.map((g) => [g.key, g.items.map((i) => i.id)]), [
    ["2026-Monsoon", ["b"]],
    ["2025-Autumn", ["d"]]
  ]);
  // A Poem filter counts pieces without a style.
  assert.deepEqual(withStyle(groups, "poem").flatMap((g) => g.items.map((i) => i.id)), ["a", "c"]);
});

test("a dropped season's year divider moves to the next season of that year, and never to another year", () => {
  const notes = withStyle(groups, "notes");
  assert.equal(notes.find((g) => g.key === "2025-Autumn")?.divider, "— 2025 —");
  assert.equal(notes.find((g) => g.key === "2026-Monsoon")?.divider, null);
  const stories = withStyle(groups, "story");
  assert.deepEqual(stories.map((g) => [g.key, g.divider]), [["2024-Spring", "— 2024 —"]]);
  // Winter 2025 dropped with its divider, and nothing else of 2025 holds a Story: no 2025 divider anywhere.
  assert.ok(!stories.some((g) => g.divider === "— 2025 —"));
});

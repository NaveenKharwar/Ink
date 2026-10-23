import type { PieceStyle } from "@ink/schemas";
import type { SeasonGroup } from "./seasons";

// All writing can be narrowed to one writing style. A piece without a style is a Poem.
export const STYLE_ORDER: PieceStyle[] = ["poem", "story", "notes"];
export const STYLE_PLURAL: Record<PieceStyle, string> = { poem: "Poems", story: "Stories", notes: "Notes" };

const styleOf = (item: { style: PieceStyle | null }): PieceStyle => item.style ?? "poem";

/** How many pieces of each style the list holds, in the order the filter shows them; styles with none are left out. */
export function styleCounts(items: { style: PieceStyle | null }[]): { style: PieceStyle; count: number }[] {
  return STYLE_ORDER.map((style) => ({ style, count: items.filter((item) => styleOf(item) === style).length })).filter((s) => s.count > 0);
}

/**
 * The seasons with only the pieces of one style (all of them when `style` is null). A season left
 * empty is dropped, and its year divider ("— 2025 —") moves to the next season of the same year,
 * so each earlier year still starts with its divider.
 */
export function withStyle<T extends { style: PieceStyle | null }>(groups: SeasonGroup<T>[], style: PieceStyle | null): SeasonGroup<T>[] {
  if (!style) return groups;
  const out: SeasonGroup<T>[] = [];
  let carried: { year: string; divider: string } | null = null;
  for (const group of groups) {
    const year = group.key.split("-")[0] ?? "";
    if (carried && carried.year !== year) carried = null;
    const items = group.items.filter((item) => styleOf(item) === style);
    if (!items.length) {
      if (group.divider) carried = { year, divider: group.divider };
      continue;
    }
    out.push({ ...group, divider: group.divider ?? carried?.divider ?? null, items });
    carried = null;
  }
  return out;
}

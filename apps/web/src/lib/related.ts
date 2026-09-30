import type { RelatedNote } from "@ink/schemas";
import { deviceTimeZone, seasonPlace, seasonText, type SeasonSet } from "./seasons";

/** The colour token of the season a note was written in: "winter" … "autumn". */
export function seasonColorVar(createdAt: string, timeZone: string, set: SeasonSet): string {
  return `var(--season-${seasonPlace(new Date(createdAt), timeZone, set).name.toLowerCase()})`;
}

/** The small label above a note: its season, then its title when it has one ("Monsoon 2025 · Rain on the tin roof"). */
export function noteLabel(note: Pick<RelatedNote, "createdAt" | "title">, set: SeasonSet, now: Date = new Date(), timeZone: string = deviceTimeZone()): string {
  const season = seasonText(new Date(note.createdAt), now, timeZone, set);
  const title = note.title?.trim();
  return title ? `${season} · ${title}` : season;
}

import type { RelatedNote } from "@ink/schemas";
import { deviceTimeZone, seasonPlace, type SeasonSet } from "./seasons";

/** The colour token of the season a note was written in: "winter" … "autumn". */
export function seasonColorVar(createdAt: string, timeZone: string, set: SeasonSet): string {
  return `var(--season-${seasonPlace(new Date(createdAt), timeZone, set).name.toLowerCase()})`;
}

/**
 * The small label above a note: its season with the year, then its title when it has one
 * ("Monsoon 2025 · Rain on the tin roof"). Always the same shape, so notes read alike: only the
 * season we are in is "Now", every other season carries its year, even within this year.
 */
export function noteLabel(note: Pick<RelatedNote, "createdAt" | "title">, set: SeasonSet, now: Date = new Date(), timeZone: string = deviceTimeZone()): string {
  const place = seasonPlace(new Date(note.createdAt), timeZone, set);
  const current = seasonPlace(now, timeZone, set);
  const season = place.year === current.year && place.name === current.name ? "Now" : `${place.name} ${place.year}`;
  const title = note.title?.trim();
  return title ? `${season} · ${title}` : season;
}

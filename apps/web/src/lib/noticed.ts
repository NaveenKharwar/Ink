import type { Noticed } from "@ink/schemas";
import { deviceTimeZone, seasonPlace, type SeasonSet } from "./seasons";

/** What the remark says, from a small fixed set of patterns; the writer's own line does the talking. */
export function noticedSentence(noticed: Noticed, set: SeasonSet, timeZone: string = deviceTimeZone()): string {
  const season = (date: string) => {
    const place = seasonPlace(new Date(date), timeZone, set);
    return `${place.name} ${place.year}`;
  };
  switch (noticed.kind) {
    case "returns":
      return `You wrote that in ${season(noticed.note.createdAt)}.`;
    case "repeats":
      return `You've written this three times: ${noticed.dates.map(season).join(", ")}.`;
  }
}

/** The older line shown first: the piece's first line, in its own words. */
export function noticedLine(noticed: Noticed): string | null {
  return noticed.note.lines[0]?.trim() || null;
}

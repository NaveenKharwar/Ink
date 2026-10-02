import type { Noticed } from "@ink/schemas";
import { deviceTimeZone, seasonPlace, type SeasonSet } from "./seasons";

/** What the remark says, from a small fixed set of patterns; the writer's own line does the talking. */
export function noticedSentence(noticed: Noticed, set: SeasonSet, timeZone: string = deviceTimeZone()): string {
  const place = seasonPlace(new Date(noticed.note.createdAt), timeZone, set);
  switch (noticed.kind) {
    case "returns":
      return `You wrote that in ${place.name} ${place.year}.`;
  }
}

/** The older line shown first: the piece's first line, in its own words. */
export function noticedLine(noticed: Noticed): string | null {
  return noticed.note.lines[0]?.trim() || null;
}

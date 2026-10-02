// Writing is grouped by season, not date. Which seasons a writer lives through is
// read from the device's time zone, so nothing about location leaves the device,
// unless the writer picks a set themselves in Profile (only the choice is saved).

export type SeasonSet = "south-asia" | "north" | "south";
export type SeasonChoice = "auto" | SeasonSet;

type Season = { name: string; months: number[] };

// Months are 1–12. A season that crosses New Year belongs to the year it ends in,
// where most of its months fall (Dec 2024–Feb 2025 is 2025's Winter).
const SETS: Record<SeasonSet, Season[]> = {
  "south-asia": [
    { name: "Winter", months: [12, 1, 2] },
    { name: "Spring", months: [3, 4] },
    { name: "Summer", months: [5, 6] },
    { name: "Monsoon", months: [7, 8, 9] },
    { name: "Autumn", months: [10, 11] }
  ],
  north: [
    { name: "Winter", months: [12, 1, 2] },
    { name: "Spring", months: [3, 4, 5] },
    { name: "Summer", months: [6, 7, 8] },
    { name: "Autumn", months: [9, 10, 11] }
  ],
  south: [
    { name: "Summer", months: [12, 1, 2] },
    { name: "Autumn", months: [3, 4, 5] },
    { name: "Winter", months: [6, 7, 8] },
    { name: "Spring", months: [9, 10, 11] }
  ]
};

const SOUTH_ASIA = ["Asia/Kolkata", "Asia/Calcutta", "Asia/Dhaka", "Asia/Karachi", "Asia/Kathmandu", "Asia/Katmandu", "Asia/Colombo", "Asia/Thimphu"];

const SOUTH_PREFIXES = ["Australia/", "Antarctica/", "America/Argentina/"];
const SOUTH_ZONES = [
  "Pacific/Auckland", "Pacific/Chatham", "Pacific/Fiji", "Pacific/Tongatapu", "Pacific/Apia", "Pacific/Noumea",
  "America/Santiago", "America/Sao_Paulo", "America/Montevideo", "America/Asuncion", "America/Buenos_Aires",
  "Africa/Johannesburg", "Africa/Maputo", "Africa/Harare", "Africa/Windhoek", "Africa/Gaborone", "Africa/Maseru",
  "Africa/Mbabane", "Africa/Lusaka", "Indian/Mauritius", "Indian/Reunion", "Indian/Antananarivo"
];

export function seasonSetFor(timeZone: string): SeasonSet {
  if (SOUTH_ASIA.includes(timeZone)) return "south-asia";
  if (SOUTH_ZONES.includes(timeZone) || SOUTH_PREFIXES.some((p) => timeZone.startsWith(p))) return "south";
  return "north";
}

/** The set to use: the writer's own choice, else what the time zone says. */
export function resolveSeasonSet(choice: SeasonChoice, timeZone: string = deviceTimeZone()): SeasonSet {
  return choice === "auto" ? seasonSetFor(timeZone) : choice;
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Year and month (1–12) of a moment, as the clock reads in that time zone. */
function localYearMonth(date: Date, timeZone: string): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric" }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month") };
}

export type SeasonPlace = { name: string; year: number };

/** Which season, and which year's list, a moment belongs to. */
export function seasonPlace(date: Date, timeZone: string = deviceTimeZone(), set: SeasonSet = seasonSetFor(timeZone)): SeasonPlace {
  const { year, month } = localYearMonth(date, timeZone);
  const season = SETS[set].find((s) => s.months.includes(month))!;
  return { name: season.name, year: season.months[0] === 12 && month === 12 ? year + 1 : year };
}

/**
 * How a piece's season reads on its own (top bar, links): "Now" for the season we are in,
 * the season's name within this year, and name plus year for older years ("Winter 2024").
 * Lists group by year instead, so they show the name alone under a "— 2024 —" divider.
 */
export function seasonText(
  date: Date,
  now: Date = new Date(),
  timeZone: string = deviceTimeZone(),
  set: SeasonSet = seasonSetFor(timeZone)
): string {
  const place = seasonPlace(date, timeZone, set);
  const current = seasonPlace(now, timeZone, set);
  if (place.year === current.year && place.name === current.name) return "Now";
  return place.year === current.year ? place.name : `${place.name} ${place.year}`;
}

/** The painting for a season, by the name in a group key ("2025-Monsoon" → /seasons/monsoon.webp). */
export function seasonPainting(key: string): string {
  return `/seasons/${(key.split("-")[1] ?? "").toLowerCase()}.webp`;
}

export type SeasonGroup<T> = {
  /** Stable id, e.g. "2025-Monsoon". */
  key: string;
  /** How it reads in a list: "Now", or the season's name alone. */
  label: string;
  /** How it reads on its own (chip, top bar): "Now", "Summer", "Monsoon 2025". */
  text: string;
  /** "— 2025 —" before the first season of each earlier year; none for this year. */
  divider: string | null;
  items: T[];
};

/** Pieces grouped by the season they were written in, newest first. */
export function groupBySeason<T extends { createdAt: string }>(
  items: T[],
  now: Date = new Date(),
  timeZone: string = deviceTimeZone(),
  set: SeasonSet = seasonSetFor(timeZone)
): SeasonGroup<T>[] {
  const current = seasonPlace(now, timeZone, set);
  const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const groups: SeasonGroup<T>[] = [];
  for (const item of sorted) {
    const place = seasonPlace(new Date(item.createdAt), timeZone, set);
    const key = `${place.year}-${place.name}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.items.push(item);
      continue;
    }
    const isNow = place.year === current.year && place.name === current.name;
    const thisYear = place.year === current.year;
    const newYear = !groups.length || !groups[groups.length - 1]!.key.startsWith(`${place.year}-`);
    groups.push({
      key,
      label: isNow ? "Now" : place.name,
      text: isNow ? "Now" : thisYear ? place.name : `${place.name} ${place.year}`,
      divider: !thisYear && newYear ? `— ${place.year} —` : null,
      items: [item]
    });
  }
  return groups;
}

export type YearGroup<T> = { year: string; thisYear: boolean; items: T[] };

/**
 * The menu's seasons grouped by year. `groupBySeason` puts a divider before the first season of
 * each earlier year and none on this year's, so a divider starts a new year and the run before the
 * first divider is this year (when there is writing from this year at all).
 */
export function groupByYear<T extends { key: string; divider: string | null }>(seasons: T[]): YearGroup<T>[] {
  const years: YearGroup<T>[] = [];
  for (const season of seasons) {
    const year = season.key.split("-")[0] ?? "";
    const last = years[years.length - 1];
    if (last && last.year === year) {
      last.items.push(season);
      continue;
    }
    years.push({ year, thisYear: season.divider === null, items: [season] });
  }
  return years;
}

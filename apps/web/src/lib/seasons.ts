// Writing is grouped by season, not date. Which seasons a writer lives through is
// read from the device's time zone, so nothing about location leaves the device.

export type SeasonSet = "south-asia" | "north" | "south";

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
export function seasonPlace(date: Date, timeZone: string = deviceTimeZone()): SeasonPlace {
  const { year, month } = localYearMonth(date, timeZone);
  const season = SETS[seasonSetFor(timeZone)].find((s) => s.months.includes(month))!;
  return { name: season.name, year: season.months[0] === 12 && month === 12 ? year + 1 : year };
}

/**
 * How a piece's season reads on its own (top bar, links): "Now" for the season we are in,
 * the season's name within this year, and name plus year for older years ("Winter 2024").
 * Lists group by year instead, so they show the name alone under a "— 2024 —" divider.
 */
export function seasonText(date: Date, now: Date = new Date(), timeZone: string = deviceTimeZone()): string {
  const place = seasonPlace(date, timeZone);
  const current = seasonPlace(now, timeZone);
  if (place.year === current.year && place.name === current.name) return "Now";
  return place.year === current.year ? place.name : `${place.name} ${place.year}`;
}

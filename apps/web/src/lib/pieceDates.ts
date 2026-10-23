// The dates of a piece, as one quiet line: "14 July 2025 · edited 2 August". The edit date drops
// its year when it is the same year, and goes away when the piece was only touched the day it
// was written. Days are counted in the writer's own time zone.

function dayParts(date: Date, timeZone: string): { day: string; month: string; year: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: get("day"), month: get("month"), year: get("year") };
}

export function pieceDatesText(createdAt: string, updatedAt: string, timeZone: string): string {
  const written = dayParts(new Date(createdAt), timeZone);
  const edited = dayParts(new Date(updatedAt), timeZone);
  const writtenText = `${written.day} ${written.month} ${written.year}`;
  if (written.day === edited.day && written.month === edited.month && written.year === edited.year) return writtenText;
  const editedText = written.year === edited.year ? `${edited.day} ${edited.month}` : `${edited.day} ${edited.month} ${edited.year}`;
  return `${writtenText} · edited ${editedText}`;
}

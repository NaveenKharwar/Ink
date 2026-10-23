// Where the writer is: a blank page at `/`, one piece at `/p/<id>`, All writing at `/all`,
// their Pictures at `/pictures` (one picture open at `/pictures?id=<id>`), or their Profile at `/profile`.
// The address holds only random ids, season names, "draft" or "finished" and style names, never any writing.
import type { PieceStatus, PieceStyle } from "@ink/schemas";

export type Route = { kind: "new" } | { kind: "piece"; id: string } | { kind: "missing" } | { kind: "all" } | { kind: "pictures" } | { kind: "profile" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseRoute(pathname: string): Route {
  if (/^\/all\/?$/.test(pathname)) return { kind: "all" };
  if (/^\/pictures\/?$/.test(pathname)) return { kind: "pictures" };
  if (/^\/profile\/?$/.test(pathname)) return { kind: "profile" };
  const match = /^\/p\/([^/]+)\/?$/.exec(pathname);
  if (!match) return { kind: "new" };
  return UUID.test(match[1]!) ? { kind: "piece", id: match[1]!.toLowerCase() } : { kind: "missing" };
}

export const pieceAddress = (id: string) => `/p/${id}`;

export const ALL_WRITING = "/all";

export const PROFILE = "/profile";

export const PICTURES = "/pictures";

// What All writing is narrowed to, kept in the address so Back, refresh and links keep it:
// `/all?season=2025-winter`, `/all?filter=draft`, either with `&style=notes`. A season and
// Drafts or Finished are never on at once (the season wins). Anything unknown is left out.
export type AllQuery = { season: string | null; filter: PieceStatus | null; style: PieceStyle | null };

const SEASON = /^(\d{4})-([a-z]{3,12})$/i;
const STATUSES: PieceStatus[] = ["draft", "finished"];
const STYLES: PieceStyle[] = ["poem", "story", "notes"];

export function parseAllQuery(search: string): AllQuery {
  const params = new URLSearchParams(search);
  const season = SEASON.exec(params.get("season") ?? "");
  const filter = params.get("filter") as PieceStatus | null;
  const style = params.get("style") as PieceStyle | null;
  // The app's season keys are "2025-Winter": the year, then the name with a capital.
  const key = season ? `${season[1]}-${season[2]![0]!.toUpperCase()}${season[2]!.slice(1).toLowerCase()}` : null;
  return {
    season: key,
    filter: !key && filter && STATUSES.includes(filter) ? filter : null,
    style: style && STYLES.includes(style) ? style : null
  };
}

export function allAddress({ season = null, filter = null, style = null }: Partial<AllQuery> = {}): string {
  const params = new URLSearchParams();
  if (season) params.set("season", season.toLowerCase());
  else if (filter) params.set("filter", filter);
  if (style) params.set("style", style);
  const query = params.toString();
  return query ? `${ALL_WRITING}?${query}` : ALL_WRITING;
}

// One picture open on the Pictures page, in the query like the filters: `/pictures?id=<id>`.
export function parsePictureQuery(search: string): string | null {
  const id = new URLSearchParams(search).get("id");
  return id && UUID.test(id) ? id.toLowerCase() : null;
}

export const pictureAddress = (id: string) => `${PICTURES}?id=${id}`;

// Search open over any page: `search` is added to that page's address (no words, ever: what the
// writer types stays out of the address, history and logs), so a phone's Back closes it.
export const searchIsOpen = (search: string) => new URLSearchParams(search).has("search");

export function withSearch(search: string, open: boolean): string {
  const params = new URLSearchParams(search);
  params.delete("search");
  const rest = params.toString();
  if (!open) return rest ? `?${rest}` : "";
  return rest ? `?${rest}&search` : "?search";
}


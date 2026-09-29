// Where the writer is: a blank page at `/`, one piece at `/p/<id>`, or All writing at `/all`.
// The address holds only the piece's random id, never any writing.
export type Route = { kind: "new" } | { kind: "piece"; id: string } | { kind: "missing" } | { kind: "all" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseRoute(pathname: string): Route {
  if (/^\/all\/?$/.test(pathname)) return { kind: "all" };
  const match = /^\/p\/([^/]+)\/?$/.exec(pathname);
  if (!match) return { kind: "new" };
  return UUID.test(match[1]!) ? { kind: "piece", id: match[1]!.toLowerCase() } : { kind: "missing" };
}

export const pieceAddress = (id: string) => `/p/${id}`;

export const ALL_WRITING = "/all";

// Where the writer is: a blank page at `/`, or one piece at `/p/<id>`.
// The address holds only the piece's random id, never any writing.
export type Route = { kind: "new" } | { kind: "piece"; id: string } | { kind: "missing" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseRoute(pathname: string): Route {
  const match = /^\/p\/([^/]+)\/?$/.exec(pathname);
  if (!match) return { kind: "new" };
  return UUID.test(match[1]!) ? { kind: "piece", id: match[1]!.toLowerCase() } : { kind: "missing" };
}

export const pieceAddress = (id: string) => `/p/${id}`;

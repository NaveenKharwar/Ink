/** Where log lines go when not to standard output (tests read them back). */
export type LogStream = { write(line: string): void };

/**
 * What the log keeps of each request: the method and the path. Never the query string, because
 * a search carries the writer's own words there (`/api/search?q=…`).
 */
export const requestLog = (req: { method?: string; url?: string }) => ({
  method: req.method,
  url: req.url?.split("?")[0]
});

export function loggerOptions(logger: boolean | LogStream) {
  if (!logger) return false;
  return { serializers: { req: requestLog }, ...(logger === true ? {} : { stream: logger }) };
}

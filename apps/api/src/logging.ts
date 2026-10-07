import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";

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

/**
 * Lines go to the terminal and are appended to a plain `.log` file (like WordPress's debug.log), so
 * a failure can be read back later. The folder is made if it is missing. Never rotated: delete it when it grows.
 */
export function fileLogStream(path: string, echo: (line: string) => void = (line) => void process.stdout.write(line)): LogStream {
  mkdirSync(dirname(path), { recursive: true });
  const file = createWriteStream(path, { flags: "a" });
  return {
    write(line) {
      echo(line);
      file.write(line);
    }
  };
}

export function loggerOptions(logger: boolean | LogStream) {
  if (!logger) return false;
  return {
    serializers: { req: requestLog },
    // A readable time (2026-10-07T15:02:11.123Z) instead of a bare number, so the file reads like a log.
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    ...(logger === true ? {} : { stream: logger })
  };
}

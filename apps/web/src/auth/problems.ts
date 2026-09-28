import type { AuthProblem } from "./actions";

// Messages for failures that aren't the writer's typing: sending too often, no connection, a server fault.
export function problemText(problem: Exclude<AuthProblem, "wrong">, sending: boolean): string {
  switch (problem) {
    case "rate-limited":
      return sending
        ? "Ink can’t send another email just yet. Try again in a minute."
        : "Too many tries for now. Wait a minute, then try again.";
    case "offline":
      return "You seem to be offline. Check your connection and try again.";
    case "unknown":
      return "Something went wrong on our side. Your writing is safe. Try again in a moment.";
  }
}

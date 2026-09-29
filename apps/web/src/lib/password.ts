// What went wrong while setting a password, in terms Profile can speak about. Kept apart from
// account.ts (which talks to Supabase) so it can be tested on its own.
export type PasswordProblem = "wrong-code" | "same" | "rate-limited" | "offline" | "unknown";

type ErrorLike = { code?: string; status?: number; name?: string };

export function passwordProblemOf(error: ErrorLike): PasswordProblem {
  if (error.code === "same_password") return "same";
  // The email code was wrong, expired, or missing.
  if (error.code === "reauthentication_not_valid" || error.code === "reauthentication_needed") return "wrong-code";
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return "rate-limited";
  }
  if (!error.status || error.name === "AuthRetryableFetchError") return "offline";
  return "unknown";
}

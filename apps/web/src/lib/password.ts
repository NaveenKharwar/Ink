// What went wrong while setting a password, in terms the screens can speak about. Kept apart from
// account.ts (which talks to Supabase) so it can be tested on its own.
export type PasswordProblem = "link-expired" | "same" | "rate-limited" | "offline" | "unknown";

type ErrorLike = { code?: string; status?: number; name?: string };

export function passwordProblemOf(error: ErrorLike): PasswordProblem {
  if (error.code === "same_password") return "same";
  // The emailed link was already used, or is older than its two hours.
  if (error.code === "otp_expired") return "link-expired";
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return "rate-limited";
  }
  if (!error.status || error.name === "AuthRetryableFetchError") return "offline";
  return "unknown";
}

import type { AuthError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// What went wrong, in terms the screens can speak about.
export type AuthProblem = "wrong" | "rate-limited" | "offline" | "unknown";

export type Result = { ok: true } | { ok: false; problem: AuthProblem };

function problemOf(error: AuthError): AuthProblem {
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return "rate-limited";
  }
  if (!error.status || error.name === "AuthRetryableFetchError") return "offline";
  if (error.status >= 400 && error.status < 500) return "wrong";
  return "unknown";
}

function toResult(error: AuthError | null): Result {
  return error ? { ok: false, problem: problemOf(error) } : { ok: true };
}

export async function continueWithGoogle(): Promise<Result> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin }
  });
  return toResult(error);
}

// One flow for new and returning writers: Supabase creates the account on the first code.
export async function sendCode(email: string): Promise<Result> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  return toResult(error);
}

export async function checkCode(email: string, token: string): Promise<Result> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  return toResult(error);
}

export async function signInWithPassword(email: string, password: string): Promise<Result> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return toResult(error);
}

export const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

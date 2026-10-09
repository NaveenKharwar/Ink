import type { User } from "@supabase/supabase-js";
import { passwordProblemOf, type PasswordProblem } from "./password";
import { SET_PASSWORD } from "./passwordLink";
import type { SeasonChoice } from "./seasons";
import { supabase } from "./supabase";

// The writer's own settings live on their Supabase account (user metadata), so every
// device agrees. Only what the writer chose is kept: never a time zone or a location.
export type Account = {
  email: string;
  penName: string | null;
  seasons: SeasonChoice;
  hasPassword: boolean;
  via: "google" | "code";
  // How many visits have shown the thread to "Ink sees this too" (it stops after TETHER_VISITS).
  tetherVisits: number;
};

const CHOICES: SeasonChoice[] = ["auto", "south-asia", "north", "south"];

export function accountOf(user: User): Account {
  const meta = user.user_metadata ?? {};
  const penName = typeof meta.pen_name === "string" && meta.pen_name.trim() ? meta.pen_name.trim() : null;
  const providers: unknown = user.app_metadata?.providers;
  return {
    email: user.email ?? "",
    penName,
    seasons: CHOICES.includes(meta.seasons) ? meta.seasons : "auto",
    hasPassword: meta.has_password === true,
    via: Array.isArray(providers) && providers.includes("google") ? "google" : "code",
    tetherVisits: typeof meta.tether_visits === "number" && meta.tether_visits >= 0 ? meta.tether_visits : 0
  };
}

export const PEN_NAME_MAX = 60;

// The thread to "Ink sees this too" is shown on a writer's first visits only, then never again.
// Counted on the account, so phone and desktop share the count.
export const TETHER_VISITS = 3;

// Once per app load: this visit has shown the thread.
let tetherCounted = false;
export function countTetherVisit(visits: number) {
  if (tetherCounted) return;
  tetherCounted = true;
  void supabase.auth.updateUser({ data: { tether_visits: visits + 1 } });
}

export async function savePenName(name: string): Promise<boolean> {
  const { error } = await supabase.auth.updateUser({ data: { pen_name: name.trim().slice(0, PEN_NAME_MAX) || null } });
  return !error;
}

export async function saveSeasons(choice: SeasonChoice): Promise<boolean> {
  const { error } = await supabase.auth.updateUser({ data: { seasons: choice } });
  return !error;
}

type PasswordResult = { ok: true } | { ok: false; problem: PasswordProblem };

// Adding or changing a password starts with an email: a link that works for 2 hours and only once, and opens on
// any device. The link opens /set-password (auth/SetPasswordPage), which asks for the new password there.
export async function sendPasswordLink(email: string): Promise<PasswordResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${SET_PASSWORD}` });
  return error ? { ok: false, problem: passwordProblemOf(error) } : { ok: true };
}

// Opening the link signs this device in with a short-lived session that is only good for choosing the password.
export async function openPasswordLink(tokenHash: string): Promise<PasswordResult> {
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  return error ? { ok: false, problem: passwordProblemOf(error) } : { ok: true };
}

// Supabase keeps only a hash. has_password is our own note so Profile can say "Password added.";
// Supabase itself doesn't tell the app whether an account has a password. Other devices are
// signed out afterwards: if someone else was in, they're out.
export async function setPassword(password: string): Promise<PasswordResult> {
  const { error } = await supabase.auth.updateUser({ password, data: { has_password: true } });
  if (error) return { ok: false, problem: passwordProblemOf(error) };
  await supabase.auth.signOut({ scope: "others" });
  return { ok: true };
}

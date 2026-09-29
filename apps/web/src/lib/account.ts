import type { User } from "@supabase/supabase-js";
import { passwordProblemOf, type PasswordProblem } from "./password";
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
    via: Array.isArray(providers) && providers.includes("google") ? "google" : "code"
  };
}

export const PEN_NAME_MAX = 60;

export async function savePenName(name: string): Promise<boolean> {
  const { error } = await supabase.auth.updateUser({ data: { pen_name: name.trim().slice(0, PEN_NAME_MAX) || null } });
  return !error;
}

export async function saveSeasons(choice: SeasonChoice): Promise<boolean> {
  const { error } = await supabase.auth.updateUser({ data: { seasons: choice } });
  return !error;
}

type PasswordResult = { ok: true } | { ok: false; problem: PasswordProblem };

// Adding or changing a password needs a 6-digit code from the writer's email first, so someone
// at an unattended signed-in device can't take the account over.
export async function sendPasswordCode(): Promise<PasswordResult> {
  const { error } = await supabase.auth.reauthenticate();
  return error ? { ok: false, problem: passwordProblemOf(error) } : { ok: true };
}

// Supabase keeps only a hash. has_password is our own note so Profile can say "Password added.";
// Supabase itself doesn't tell the app whether an account has a password. Other devices are
// signed out afterwards: if someone else was in, they're out.
export async function setPassword(password: string, code: string): Promise<PasswordResult> {
  const { error } = await supabase.auth.updateUser({ password, nonce: code, data: { has_password: true } });
  if (error) return { ok: false, problem: passwordProblemOf(error) };
  await supabase.auth.signOut({ scope: "others" });
  return { ok: true };
}

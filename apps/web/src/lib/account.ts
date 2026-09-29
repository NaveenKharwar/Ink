import type { User } from "@supabase/supabase-js";
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

export type PasswordProblem = "same" | "sign-in-again" | "offline" | "unknown";

// Supabase keeps only a hash. has_password is our own note so Profile can say "Password added.";
// Supabase itself doesn't tell the app whether an account has a password.
export async function setPassword(password: string): Promise<{ ok: true } | { ok: false; problem: PasswordProblem }> {
  const { error } = await supabase.auth.updateUser({ password, data: { has_password: true } });
  if (!error) return { ok: true };
  if (error.code === "same_password") return { ok: false, problem: "same" };
  if (error.code === "reauthentication_needed") return { ok: false, problem: "sign-in-again" };
  if (!error.status || error.name === "AuthRetryableFetchError") return { ok: false, problem: "offline" };
  return { ok: false, problem: "unknown" };
}

import { useEffect, useState } from "react";

export const SCHEMES = [
  { value: "moss", label: "Moss" },
  { value: "paper", label: "Paper" },
  { value: "night", label: "Night" }
] as const;

export type Scheme = (typeof SCHEMES)[number]["value"];
/** "system" follows the device: Moss in light, Night in dark. */
export type SchemeChoice = Scheme | "system";

const KEY = "ink-scheme";
// The earlier Light / Dark choice, still read so a writer keeps what they picked.
const LEGACY_KEY = "ink-theme";

function isScheme(value: unknown): value is Scheme {
  return SCHEMES.some((s) => s.value === value);
}

/** The stored words turned into a choice: the scheme if it is one, else the earlier Light / Dark, else the device. */
export function schemeFromStored(scheme: string | null, legacy: string | null): SchemeChoice {
  if (isScheme(scheme)) return scheme;
  if (legacy === "dark") return "night";
  if (legacy === "light") return "moss";
  return "system";
}

/** What the device shows when the writer follows it. */
export function systemScheme(prefersDark: boolean): Scheme {
  return prefersDark ? "night" : "moss";
}

// Remembered on this device only; if storage is unavailable Ink simply follows the device.
export function readScheme(): SchemeChoice {
  try {
    return schemeFromStored(localStorage.getItem(KEY), localStorage.getItem(LEGACY_KEY));
  } catch {
    return "system";
  }
}

export function applyScheme(choice: SchemeChoice) {
  if (choice === "system") delete document.documentElement.dataset.scheme;
  else document.documentElement.dataset.scheme = choice;
}

export function useScheme(): [SchemeChoice, (choice: SchemeChoice) => void] {
  const [choice, setChoice] = useState<SchemeChoice>(readScheme);
  useEffect(() => applyScheme(choice), [choice]);
  const set = (next: SchemeChoice) => {
    setChoice(next);
    try {
      localStorage.removeItem(LEGACY_KEY);
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Not remembered, but still applied for this visit.
    }
  };
  return [choice, set];
}

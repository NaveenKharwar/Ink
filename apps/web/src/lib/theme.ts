import { useEffect, useState } from "react";

export const SCHEMES = [
  { value: "paper", label: "Paper" },
  { value: "night", label: "Night" },
  { value: "saffron", label: "Saffron" }
] as const;

export type Scheme = (typeof SCHEMES)[number]["value"];
/** "system" follows the device: Paper in light, Night in dark. Saffron is an extra, picked on purpose. */
export type SchemeChoice = Scheme | "system";

const KEY = "ink-scheme";
// The earlier Light / Dark choice, still read so a writer keeps what they picked.
const LEGACY_KEY = "ink-theme";
// A stored "moss" is read as Saffron.
const RENAMED: Record<string, Scheme> = { moss: "saffron" };

function isScheme(value: unknown): value is Scheme {
  return SCHEMES.some((s) => s.value === value);
}

/** The stored words turned into a choice: the scheme if it is one, else the earlier Light / Dark, else the device. */
export function schemeFromStored(scheme: string | null, legacy: string | null): SchemeChoice {
  if (isScheme(scheme)) return scheme;
  if (scheme && RENAMED[scheme]) return RENAMED[scheme];
  if (legacy === "dark") return "night";
  if (legacy === "light") return "paper";
  return "system";
}

/** What the device shows when the writer follows it. */
export function systemScheme(prefersDark: boolean): Scheme {
  return prefersDark ? "night" : "paper";
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
  // Safari keeps the old ground in the side column's layer until a repaint, so the switch asks for one.
  repaint();
  // The browser's bar follows the ground colour of the chosen scheme.
  const ground = getComputedStyle(document.documentElement).getPropertyValue("--ground").trim();
  if (ground) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", ground);
}

function repaint() {
  const root = document.documentElement;
  root.style.transform = "translateZ(0)";
  void root.offsetHeight;
  root.style.transform = "";
}

/** The choice and a setter. The setter applies the scheme at once and says whether this device could remember it. */
export function useScheme(): [SchemeChoice, (choice: SchemeChoice) => boolean] {
  const [choice, setChoice] = useState<SchemeChoice>(readScheme);
  useEffect(() => applyScheme(choice), [choice]);
  const set = (next: SchemeChoice) => {
    setChoice(next);
    try {
      localStorage.removeItem(LEGACY_KEY);
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
      return true;
    } catch {
      // Not remembered, but still applied for this visit.
      return false;
    }
  };
  return [choice, set];
}

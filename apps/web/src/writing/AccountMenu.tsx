import { useState } from "react";
import { Loader } from "../ui/Loader";
import { useTheme, type ThemeChoice } from "../lib/theme";

const THEMES: Array<{ value: ThemeChoice; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" }
];

type Props = { phone?: boolean; name: string; onProfile: () => void; onSignOut: () => Promise<void> };

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const link = `relative cursor-pointer border-0 border-b bg-transparent px-0 pt-0.5 pb-px text-[12px] ${focusRing}`;

// On a phone the buttons keep their look but get a 44px touch area (padding that overlaps nothing:
// the rows and the buttons are spaced to match).
const touch = "before:absolute before:-inset-x-2.5 before:-inset-y-[11px] before:content-['']";

// Who is signed in (pen name, else email), at the foot of the menu, always in view like a small
// paper slip: the name in serif, the look (System · Light · Dark), then Profile and Sign out.
export function AccountMenu({ phone = false, name, onProfile, onSignOut }: Props) {
  const [theme, setTheme] = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const reach = phone ? touch : "";
  // On a phone the links sit further apart so their 44px touch areas never overlap.
  const gap = phone ? "gap-2.5" : "gap-1.5";

  return (
    <div aria-label="Account" role="group" className="border-t border-line px-2 pt-3">
      <div className="mb-2 truncate font-serif text-[17px] leading-6 text-ink">{name}</div>
      <div role="radiogroup" aria-label="Look" className={`${phone ? "mb-6" : "mb-1.5"} flex items-center ${gap} text-[12px] text-ink-muted`}>
        {THEMES.map((t, i) => (
          <span key={t.value} className={`flex items-center ${gap}`}>
            {i > 0 && <span aria-hidden="true">·</span>}
            <button
              type="button"
              role="radio"
              aria-checked={theme === t.value}
              onClick={() => setTheme(t.value)}
              className={`${link} ${reach} ${theme === t.value ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
            >
              {t.label}
            </button>
          </span>
        ))}
      </div>
      <div className={`flex items-center ${gap} text-[12px] text-ink-muted`}>
        <button type="button" onClick={onProfile} className={`${link} ${reach} border-transparent text-ink hover:border-ink`}>
          Profile
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          disabled={signingOut}
          aria-busy={signingOut || undefined}
          onClick={() => {
            setSigningOut(true);
            void onSignOut().finally(() => setSigningOut(false));
          }}
          className={`${link} ${reach} border-transparent text-ink-muted hover:text-ink disabled:cursor-default`}
        >
          <span className={signingOut ? "opacity-0" : undefined}>Sign out</span>
          {signingOut && <Loader size={12} label="Signing out" className="absolute inset-0 items-center justify-center" />}
        </button>
      </div>
    </div>
  );
}

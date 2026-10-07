import { useState } from "react";
import { Loader } from "../ui/Loader";
import { useTheme, type ThemeChoice } from "../lib/theme";

const THEMES: Array<{ value: ThemeChoice; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" }
];

type Props = { name: string; onProfile: () => void; onSignOut: () => Promise<void> };

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
// Every row is 44px tall, like the rows above; the buttons share a row in equal parts.
const cell = `box-border flex h-11 cursor-pointer items-center justify-center rounded-md border-0 text-[14px] text-ink ${focusRing}`;

// Who is signed in (pen name, else email), at the foot of the menu, always in view: the name in
// serif, the look (System, Light, Dark) as three equal parts of one row, then Profile and Sign out
// as two equal parts of the next.
export function AccountMenu({ name, onProfile, onSignOut }: Props) {
  const [theme, setTheme] = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div aria-label="Account" role="group">
      <div className="mx-1 h-px bg-line" />
      <div className="flex h-11 items-center truncate px-3 font-serif text-[17px] text-ink">{name}</div>
      <div role="radiogroup" aria-label="Look" className="grid grid-cols-3">
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={theme === t.value}
            onClick={() => setTheme(t.value)}
            className={`${cell} ${theme === t.value ? "bg-surface-hover font-semibold" : "bg-transparent text-ink-muted hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2">
        <button type="button" onClick={onProfile} className={`${cell} relative bg-transparent text-ink-muted hover:text-ink`}>
          Profile
        </button>
        <button
          type="button"
          disabled={signingOut}
          aria-busy={signingOut || undefined}
          onClick={() => {
            setSigningOut(true);
            void onSignOut().finally(() => setSigningOut(false));
          }}
          className={`${cell} relative bg-transparent text-ink-muted hover:text-ink disabled:cursor-default`}
        >
          <span className={signingOut ? "opacity-0" : undefined}>Sign out</span>
          {signingOut && <Loader size={12} label="Signing out" className="absolute inset-0 items-center justify-center" />}
        </button>
      </div>
    </div>
  );
}

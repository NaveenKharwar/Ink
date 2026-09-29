import { useTheme, type ThemeChoice } from "../lib/theme";

const THEMES: Array<{ value: ThemeChoice; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" }
];

type Props = { name: string; onProfile: () => void; onSignOut: () => void };

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const link = `cursor-pointer border-0 border-b bg-transparent px-0 pt-0.5 pb-px text-[12px] ${focusRing}`;

// Who is signed in (pen name, else email), at the foot of the menu, always in view like a small
// paper slip: the name in serif, the look (System · Light · Dark), then Profile and Sign out.
export function AccountMenu({ name, onProfile, onSignOut }: Props) {
  const [theme, setTheme] = useTheme();

  return (
    <div aria-label="Account" role="group" className="border-t border-line px-2 pt-3">
      <div className="mb-2 truncate font-serif text-[17px] leading-6 text-ink">{name}</div>
      <div role="radiogroup" aria-label="Look" className="mb-1.5 flex items-center gap-1.5 text-[12px] text-ink-muted">
        {THEMES.map((t, i) => (
          <span key={t.value} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">·</span>}
            <button
              type="button"
              role="radio"
              aria-checked={theme === t.value}
              onClick={() => setTheme(t.value)}
              className={`${link} ${theme === t.value ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
            >
              {t.label}
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
        <button type="button" onClick={onProfile} className={`${link} border-transparent text-ink hover:border-ink`}>
          Profile
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={onSignOut} className={`${link} border-transparent text-ink-muted hover:text-ink`}>
          Sign out
        </button>
      </div>
    </div>
  );
}

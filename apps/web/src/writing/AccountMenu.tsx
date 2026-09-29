import { useEffect, useRef, useState } from "react";
import { useTheme, type ThemeChoice } from "../lib/theme";

const THEMES: Array<{ value: ThemeChoice; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" }
];

type Props = { name: string; onProfile: () => void; onSignOut: () => void };

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Who is signed in (pen name, else email), at the foot of the menu. Opens upward: the look
// (System, Light, Dark), Profile and Sign out.
export function AccountMenu({ name, onProfile, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => wrap.current?.contains(e.target as Node) || setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const initial = ([...name.trim()][0] ?? "?").toUpperCase();

  return (
    <div ref={wrap} className="relative" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2 text-left text-ink hover:bg-surface-hover ${focusRing}`}
      >
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[12px] font-semibold text-ink"
        >
          {initial}
        </span>
        <span className="min-w-0 truncate text-[13px] text-ink-muted">{name}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute bottom-11 left-0 z-20 w-[220px] rounded-md border border-line-strong bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
        >
          <div className="px-2.5 pt-2 pb-1.5 text-[12px] text-ink-muted">Look</div>
          <div role="group" aria-label="Look" className="mx-1.5 mb-1.5 flex gap-1 rounded-md bg-ground p-1">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="menuitemradio"
                aria-checked={theme === t.value}
                onClick={() => setTheme(t.value)}
                className={`h-7 flex-1 cursor-pointer rounded-[6px] border-0 text-[12px] ${focusRing} ${
                  theme === t.value ? "bg-surface font-semibold text-ink" : "bg-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onProfile();
            }}
            className={`block w-full cursor-pointer rounded-[6px] border-0 bg-transparent px-2.5 py-2 text-left text-[13px] text-ink hover:bg-surface-hover ${focusRing}`}
          >
            Profile
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            className={`block w-full cursor-pointer rounded-[6px] border-0 bg-transparent px-2.5 py-2 text-left text-[13px] text-ink hover:bg-surface-hover ${focusRing}`}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { SCHEMES, systemScheme, useScheme, type Scheme, type SchemeChoice } from "../lib/theme";
import { useMediaQuery } from "../lib/useMediaQuery";
import { MenuSwitch } from "../ui/MenuRow";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// How Ink is coloured on this device: one big preview, then a card for each scheme. Choosing a
// card colours the whole app at once and offers a quiet Undo. Remembered here, not on the account.
export function ColourSchemes() {
  const [choice, setChoice] = useScheme();
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const shown: Scheme = choice === "system" ? systemScheme(prefersDark) : choice;
  const [undo, setUndo] = useState<SchemeChoice | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const change = (next: SchemeChoice) => {
    if (next === choice) return;
    setUndo(choice);
    setChoice(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setUndo(null), 8000);
  };

  const undoChange = () => {
    if (undo === null) return;
    setChoice(undo);
    setUndo(null);
    window.clearTimeout(timer.current);
  };

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="p-0 text-[14px] leading-5 font-semibold">Colours</legend>
      <div className="mt-3 rounded-xl border border-line bg-surface px-4 py-4">
        <div className="text-[12px] leading-4 text-ink-muted">Monsoon 2026</div>
        <div className="mt-1 font-display text-[22px] leading-[1.25]">Rain on the tin roof</div>
        <p className="mt-2 mb-0 font-display text-[15px] leading-[1.7]">
          The first rain came in sideways and the street smelled of <span className="rounded-[3px] bg-accent-soft px-0.5">wet clay</span>. Maa stood at the window and said
          nothing.
        </p>
        <div className="mt-3 inline-block rounded-lg border border-line bg-ground px-3 py-2">
          <div className="text-[11px] leading-4 text-ink-muted">Summer 2025</div>
          <div className="font-display text-[13px] italic">“Dadi’s courtyard, the smell after the first rain.”</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-x-3 gap-y-4">
        {SCHEMES.map((s) => (
          <SchemeCard key={s.value} value={s.value} label={s.label} checked={shown === s.value} onChoose={() => change(s.value)} />
        ))}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={choice === "system"}
        onClick={() => change(choice === "system" ? shown : "system")}
        className={`mt-3 flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 rounded-md border-0 bg-transparent p-0 text-left ${focusRing}`}
      >
        <span className="font-medium">Follow my device</span>
        <MenuSwitch on={choice === "system"} />
      </button>

      <p className="m-0 mt-1 min-h-5 text-[13px] leading-5 text-ink-muted" role="status">
        {undo !== null && (
          <>
            Applied to the whole app now.{" "}
            <button type="button" onClick={undoChange} className={`cursor-pointer border-0 bg-transparent p-0 text-ink underline transition-colors duration-150 hover:text-ink/70 motion-reduce:transition-none ${focusRing}`}>
              Undo
            </button>
          </>
        )}
      </p>
    </fieldset>
  );
}

// One scheme drawn in its own colours (the inner box carries data-scheme), with the app's own
// colours around it for the label and the ring.
function SchemeCard({ value, label, checked, onChoose }: { value: Scheme; label: string; checked: boolean; onChoose: () => void }) {
  return (
    <label className="cursor-pointer text-center">
      <input type="radio" name="colours" value={value} checked={checked} onChange={onChoose} className="peer sr-only" />
      <span className="block rounded-lg border-[1.5px] border-line transition-colors duration-150 peer-checked:border-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent motion-reduce:transition-none">
        <span data-scheme={value} className="block rounded-[6px] bg-surface p-2 text-left text-ink">
          <span className="block font-display text-[11px] leading-4">Rain</span>
          <span className="mt-1 block h-[3px] rounded-sm bg-ink/25" />
          <span className="mt-1 block h-[3px] w-[70%] rounded-sm bg-ink/25" />
          <span className="mt-1 block h-[3px] w-[40%] rounded-sm bg-accent" />
        </span>
      </span>
      <span data-scheme={value} className="mx-auto mt-2 flex h-3.5 w-[52px] overflow-hidden rounded-full border border-line">
        <i className="flex-1 bg-ground" />
        <i className="flex-1 bg-accent" />
      </span>
      <span className={`mt-1 block text-[12px] leading-4 ${checked ? "font-medium" : "text-ink-muted"}`}>{label}</span>
    </label>
  );
}

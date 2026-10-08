import { useState } from "react";
import { SCHEMES, systemScheme, useScheme, type Scheme, type SchemeChoice } from "../lib/theme";
import { useMediaQuery } from "../lib/useMediaQuery";
import { MenuSwitch } from "../ui/MenuRow";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// How Ink is coloured on this device: a card for each scheme, each a small page in its own colours.
// Choosing a card colours the whole app, says it is saved, and offers a quiet Undo that stays until
// the next change or until the writer leaves. Remembered here, not on the account.
export function ColourSchemes() {
  const [choice, setChoice] = useScheme();
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const shown: Scheme = choice === "system" ? systemScheme(prefersDark) : choice;
  const [undo, setUndo] = useState<SchemeChoice | null>(null);
  const [remembered, setRemembered] = useState(true);

  const change = (next: SchemeChoice) => {
    if (next === choice) return;
    setUndo(choice);
    setRemembered(setChoice(next));
  };

  const undoChange = () => {
    if (undo === null) return;
    setChoice(undo);
    setUndo(null);
  };

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="p-0">
        <h2 className="m-0 text-[16px] leading-[22px] font-semibold">Colours</h2>
      </legend>
      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-x-3 gap-y-4">
        {SCHEMES.map((s) => (
          <SchemeCard
            key={s.value}
            value={s.value}
            label={s.label}
            checked={choice === s.value}
            following={choice === "system" && shown === s.value}
            onChoose={() => change(s.value)}
          />
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
        <span className="flex items-center gap-3">
          <span aria-hidden className="text-[13px] leading-5 text-ink-muted">
            {choice === "system" ? "On" : "Off"}
          </span>
          <MenuSwitch on={choice === "system"} />
        </span>
      </button>

      <p className={`m-0 flex items-start gap-1.5 text-[13px] leading-[18px] text-ink-muted ${undo !== null ? "mt-2" : ""}`} role="status">
        {undo !== null && (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.7 2.7L16 9.8" />
            </svg>
            <span>
              {remembered ? "Applied to the whole app and saved on this device." : "Applied to the whole app, but this device can’t remember it."}{" "}
              <button type="button" onClick={undoChange} className={`cursor-pointer border-0 bg-transparent p-0 text-ink underline transition-colors duration-150 hover:text-ink/70 motion-reduce:transition-none ${focusRing}`}>
                Undo
              </button>
            </span>
          </>
        )}
      </p>
    </fieldset>
  );
}

// One scheme drawn in its own colours (the inner box carries data-scheme), with the app's own
// colours around it for the label and the ring.
function SchemeCard({ value, label, checked, following, onChoose }: { value: Scheme; label: string; checked: boolean; following: boolean; onChoose: () => void }) {
  return (
    <label className="cursor-pointer text-center">
      <input type="radio" name="colours" value={value} checked={checked} onChange={onChoose} className="peer sr-only" />
      <span className={`block rounded-lg border-[1.5px] ${following ? "border-dashed border-accent" : "border-ink-subtle"} transition-colors duration-150 peer-checked:border-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent motion-reduce:transition-none`}>
        <span aria-hidden data-scheme={value} className="block rounded-[6px] bg-surface p-2 text-left text-ink">
          <span className="block font-display text-[11px] leading-4">Rain</span>
          <span className="mt-1 block h-[3px] rounded-sm bg-ink/25" />
          <span className="mt-1 block h-[3px] w-[70%] rounded-sm bg-ink/25" />
          <span className="mt-1 block h-[3px] w-[40%] rounded-sm bg-accent" />
        </span>
      </span>
      <span aria-hidden data-scheme={value} className="mx-auto mt-2 flex h-3.5 w-[52px] overflow-hidden rounded-full border border-line">
        <i className="flex-1 bg-ground" />
        <i className="flex-1 bg-accent" />
      </span>
      <span className={`mt-1 block text-[12px] leading-4 ${checked || following ? "font-medium" : "text-ink-muted"}`}>
        {label}
        {following && <span className="sr-only"> (following your device)</span>}
      </span>
    </label>
  );
}

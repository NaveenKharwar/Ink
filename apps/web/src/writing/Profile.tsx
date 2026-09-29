import { useEffect, useRef, useState, type ReactNode } from "react";
import { GoogleMark } from "../auth/parts";
import { PEN_NAME_MAX, savePenName, saveSeasons, setPassword, type Account, type PasswordProblem } from "../lib/account";
import { deviceTimeZone, seasonSetFor, type SeasonChoice, type SeasonSet } from "../lib/seasons";

type Props = { account: Account; wide: boolean; onBack: () => void; onSignOut: () => void };

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const plainButton = `h-11 cursor-pointer rounded-md border border-line-strong bg-surface px-[18px] font-medium text-ink hover:bg-surface-hover ${focusRing}`;

const SET_NAMES: Record<SeasonSet, string> = { "south-asia": "South Asia", north: "North of the equator", south: "South of the equator" };
const SEASON_OPTIONS: Array<{ value: SeasonChoice; label: string; sub: string }> = [
  { value: "auto", label: "Automatic", sub: `From this device’s time zone: ${SET_NAMES[seasonSetFor(deviceTimeZone())]}.` },
  { value: "south-asia", label: "South Asia", sub: "Winter, Spring, Summer, Monsoon, Autumn" },
  { value: "north", label: "North of the equator", sub: "Winter, Spring, Summer, Autumn" },
  { value: "south", label: "South of the equator", sub: "Summer, Autumn, Winter, Spring" }
];

const PASSWORD_TEXT: Record<PasswordProblem, string> = {
  same: "That’s already your password. Choose a new one.",
  "sign-in-again": "For your safety, sign out and sign in again, then change your password.",
  offline: "You seem to be offline. Check your connection and try again.",
  unknown: "Something went wrong on our side. Your writing is safe. Try again in a moment."
};

const SAVE_FAILED = "Ink couldn’t save that. Check your connection and try again.";

// The writer's account: pen name, seasons, how they sign in, an optional password, sign out.
// A password is a way back in, never a security score: no nagging, no progress bars.
export function Profile({ account, wide, onBack, onSignOut }: Props) {
  return (
    <>
      <div className={`flex h-14 shrink-0 items-center border-b border-line ${wide ? "px-5" : "px-3"}`}>
        <button
          type="button"
          onClick={onBack}
          className={`-ml-1 flex h-10 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2 text-ink hover:bg-surface-hover ${focusRing}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to writing
        </button>
      </div>

      <div className="grow overflow-y-auto">
        <div className={wide ? "mx-auto max-w-[560px] pt-12 pb-12" : "px-5 pt-7 pb-10"}>
          <h1 className={`m-0 font-serif font-normal leading-[1.2] ${wide ? "text-[30px]" : "text-[26px]"}`}>Profile</h1>
          <PenName initial={account.penName ?? ""} />
          <Section>
            <Seasons initial={account.seasons} />
          </Section>
          <Section>
            <h2 className="m-0 text-[14px] leading-5 font-semibold">How you sign in</h2>
            <div className="mt-3 flex items-center gap-3">
              {account.via === "google" ? (
                <GoogleMark />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                  <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
                  <path d="M4 7l8 6 8-6" />
                </svg>
              )}
              <div className="min-w-0">
                <div className="truncate font-medium">{account.email}</div>
                <div className="text-[13px] leading-[18px] text-ink-muted">
                  {account.via === "google" ? "You sign in with Google." : "You sign in with a code sent to this email."}
                </div>
              </div>
            </div>
          </Section>
          <Section>
            <Password hasPassword={account.hasPassword} />
          </Section>
          <Section>
            <button type="button" onClick={onSignOut} className={plainButton}>
              Sign out
            </button>
            <div className="mt-2 text-[13px] leading-[18px] text-ink-muted">Your writing stays saved. Sign in again any time.</div>
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <section className="mt-7 border-t border-line pt-6">{children}</section>;
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div aria-live="polite" className="mt-2.5 flex items-start gap-2 text-[13px] leading-[18px]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mt-px shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5v.01" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

type SaveState = "idle" | "saving" | "saved" | "failed";

// A quiet line under a setting: "Saving…", then a check and "Saved"; a plain message if it failed.
function SaveStatus({ state }: { state: SaveState }) {
  return (
    <div aria-live="polite" className="min-h-[18px]">
      {state === "saving" && <div className="mt-2 text-[13px] leading-[18px] text-ink-muted">Saving…</div>}
      {state === "saved" && (
        <div className="mt-2 flex items-center gap-1.5 text-[13px] leading-[18px] text-ink-muted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.7 2.7L16 9.8" />
          </svg>
          Saved
        </div>
      )}
      {state === "failed" && <Note>{SAVE_FAILED}</Note>}
    </div>
  );
}

// Saved quietly a moment after typing stops, and when the field loses focus.
function PenName({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");
  const saved = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const save = async (next: string) => {
    clearTimeout(timer.current);
    if (next.trim() === saved.current.trim()) return;
    setState("saving");
    const ok = await savePenName(next);
    if (ok) saved.current = next;
    setState(ok ? "saved" : "failed");
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <section className="mt-7">
      <label htmlFor="pen-name" className="block font-semibold">
        Pen name <span className="font-normal text-ink-muted">(optional)</span>
      </label>
      <input
        id="pen-name"
        type="text"
        autoComplete="nickname"
        maxLength={PEN_NAME_MAX}
        placeholder="The name you write under"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          setState("idle");
          clearTimeout(timer.current);
          timer.current = setTimeout(() => void save(next), 800);
        }}
        onBlur={() => void save(value)}
        aria-describedby="pen-name-help"
        className="mt-2 box-border h-12 w-full rounded-md border border-line-strong bg-surface px-3.5 font-serif text-[18px] text-ink placeholder:text-ink-muted"
      />
      <div id="pen-name-help" className="mt-1.5 text-[13px] leading-[18px] text-ink-muted">
        Only you see this for now. Hindi works too.
      </div>
      <SaveStatus state={state} />
    </section>
  );
}

function Seasons({ initial }: { initial: SeasonChoice }) {
  const [choice, setChoice] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");

  const pick = async (next: SeasonChoice) => {
    const before = choice;
    setChoice(next);
    setState("saving");
    const ok = await saveSeasons(next);
    if (!ok) setChoice(before);
    setState(ok ? "saved" : "failed");
  };

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" aria-describedby="seasons-help">
      <legend className="p-0 text-[14px] leading-5 font-semibold">Seasons</legend>
      <p id="seasons-help" className="mt-2 mb-0 max-w-[440px] text-ink-muted">
        Ink groups your writing by season. If they look wrong for where you write, choose another.
      </p>
      <div className="mt-3 flex flex-col gap-1">
        {SEASON_OPTIONS.map((o) => (
          <label
            key={o.value}
            className={`-mx-3 flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 ${choice === o.value ? "bg-surface-hover" : ""}`}
          >
            <input
              type="radio"
              name="seasons"
              value={o.value}
              checked={choice === o.value}
              onChange={() => void pick(o.value)}
              className={`mt-[3px] h-4 w-4 shrink-0 accent-ink ${focusRing}`}
            />
            <span>
              <span className="block font-medium">{o.label}</span>
              <span className="block text-[13px] leading-[18px] text-ink-muted">{o.sub}</span>
            </span>
          </label>
        ))}
      </div>
      <SaveStatus state={state} />
    </fieldset>
  );
}

function Password({ hasPassword }: { hasPassword: boolean }) {
  const [has, setHas] = useState(hasPassword);
  const [form, setForm] = useState(false);
  const [changed, setChanged] = useState(false);
  const [pw, setPw] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const long = pw.length >= 8;

  const open = () => {
    setForm(true);
    setPw("");
    setMessage(null);
  };
  const save = async () => {
    if (!long) return setMessage("Make it at least 8 characters.");
    setBusy(true);
    const result = await setPassword(pw);
    setBusy(false);
    if (!result.ok) return setMessage(PASSWORD_TEXT[result.problem]);
    setChanged(has);
    setHas(true);
    setForm(false);
    setPw("");
  };

  return (
    <>
      <h2 className="m-0 text-[14px] leading-5 font-semibold">Password</h2>
      {form ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label htmlFor="new-password" className="mt-3 block font-medium">
            {has ? "New password" : "Password"}
          </label>
          <div className="relative mt-1.5">
            <input
              id="new-password"
              type={shown ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                setMessage(null);
              }}
              aria-describedby="new-password-rule"
              className="box-border h-12 w-full rounded-md border border-line-strong bg-surface pr-16 pl-3.5 text-[16px] text-ink"
            />
            <button
              type="button"
              onClick={() => setShown(!shown)}
              aria-pressed={shown}
              className={`absolute top-1.5 right-1.5 h-9 cursor-pointer rounded-md border-0 bg-transparent px-2.5 text-[13px] text-ink ${focusRing}`}
            >
              {shown ? "Hide" : "Show"}
            </button>
          </div>
          <div id="new-password-rule" className={`mt-2 flex items-center gap-1.5 text-[13px] leading-[18px] ${long ? "text-ink" : "text-ink-muted"}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.7 2.7L16 9.8" strokeOpacity={long ? 1 : 0} />
            </svg>
            At least 8 characters
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy || undefined}
              className={`h-11 cursor-pointer rounded-md border-0 bg-ink px-[18px] font-medium text-on-ink disabled:cursor-default ${focusRing}`}
            >
              {busy ? "Saving…" : "Save password"}
            </button>
            <button
              type="button"
              onClick={() => setForm(false)}
              className={`h-11 cursor-pointer rounded-md border-0 bg-transparent px-3.5 text-ink hover:bg-surface-hover ${focusRing}`}
            >
              Cancel
            </button>
          </div>
          {message && <Note>{message}</Note>}
        </form>
      ) : has ? (
        <>
          <div className="mt-2.5 flex items-start gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.7 2.7L16 9.8" />
            </svg>
            <p className="m-0 max-w-[440px] text-ink-muted">
              <span className="font-medium text-ink">{changed ? "Password changed." : "Password added."}</span> If a code ever
              doesn’t arrive, you can sign in with it.
            </p>
          </div>
          <button type="button" onClick={open} className={`mt-3.5 ${plainButton}`}>
            Change password
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 mb-0 max-w-[440px] text-ink-muted">
            No password yet. Add one so you can always get back to your writing, even on a day you can’t open your email.
          </p>
          <button type="button" onClick={open} className={`mt-3.5 ${plainButton}`}>
            Add a password
          </button>
        </>
      )}
    </>
  );
}

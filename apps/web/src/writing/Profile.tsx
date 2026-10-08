import type { LibraryItem, PieceLanguage } from "@ink/schemas";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PEN_NAME_MAX, savePenName, saveSeasons, sendPasswordCode, setPassword, type Account } from "../lib/account";
import type { PasswordProblem } from "../lib/password";
import { deviceTimeZone, resolveSeasonSet, seasonPlace, seasonSetFor, type SeasonChoice, type SeasonSet } from "../lib/seasons";
import { Button } from "../ui/Button";
import { ColourSchemes } from "./ColourSchemes";
import { MenuIcon } from "./icons";
import { SeasonPainting } from "./SeasonPainting";
import { SideColumn } from "./SideColumn";
import { Signature } from "./Signature";
import { FadeScroll } from "../ui/FadeScroll";

type Props = {
  account: Account;
  /** The writer's pieces, for the few quiet facts beside the page (null while loading). */
  items: LibraryItem[] | null;
  wide: boolean;
  /** ☰: on every screen in the same corner; on desktop hidden while the menu is open. */
  showMenuButton: boolean;
  onMenu: () => void;
  onBack: () => void;
  onSignOut: () => Promise<void>;
};

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const SET_NAMES: Record<SeasonSet, string> = { "south-asia": "South Asia", north: "North of the equator", south: "South of the equator" };
const SEASON_OPTIONS: Array<{ value: SeasonChoice; label: string; sub: string }> = [
  { value: "auto", label: "Automatic", sub: `From this device’s time zone: ${SET_NAMES[seasonSetFor(deviceTimeZone())]}.` },
  { value: "south-asia", label: "South Asia", sub: "Winter, Spring, Summer, Monsoon, Autumn" },
  { value: "north", label: "North of the equator", sub: "Winter, Spring, Summer, Autumn" },
  { value: "south", label: "South of the equator", sub: "Summer, Autumn, Winter, Spring" }
];

const PASSWORD_TEXT: Record<PasswordProblem, string> = {
  "wrong-code": "That code doesn’t match. Check the newest email from Ink and try again.",
  same: "That’s already your password. Choose a new one.",
  "rate-limited": "Ink can’t send another email just yet. Try again in a minute.",
  offline: "You seem to be offline. Check your connection and try again.",
  unknown: "Something went wrong on our side. Your writing is safe. Try again in a moment."
};

const SAVE_FAILED = "Ink couldn’t save that. Check your connection and try again.";

// The writer's account: pen name, seasons, how they sign in, an optional password, sign out.
// A password is a way back in, never a security score: no nagging, no progress bars.
export function Profile({ account, items, wide, showMenuButton, onMenu, onBack, onSignOut }: Props) {
  // The seasons choice lives here so the painting beside the page follows it as it changes.
  const [seasons, setSeasons] = useState(account.seasons);
  const timeZone = deviceTimeZone();
  const set = resolveSeasonSet(seasons, timeZone);
  const now = seasonPlace(new Date(), timeZone, set);

  return (
    <>
      <div className={`flex shrink-0 items-center gap-1 border-b border-line ${wide ? "h-14 pr-4 pl-4" : "h-[52px] pr-1.5 pl-1"}`}>
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open menu"
            className={`touch-44 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink ${focusRing}`}
          >
            <MenuIcon />
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className={`touch-44 flex h-10 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2 text-ink/75 transition-colors duration-150 hover:text-ink motion-reduce:transition-none ${focusRing}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to writing
        </button>
      </div>

      <FadeScroll scrollbar="scrolling" className="grow">
        <div className={`mx-auto max-w-[560px] box-content px-[var(--page-gutter)] ${wide ? "pt-12 pb-12" : "pt-7 pb-10"}`}>
          <h1 className={`m-0 font-display font-normal leading-[1.2] ${wide ? "text-[30px]" : "text-[26px]"}`}>Profile</h1>
          <PenName initial={account.penName ?? ""} />
          <Section>
            <ColourSchemes />
          </Section>
          <Section>
            <Seasons initial={account.seasons} onChange={setSeasons} />
          </Section>
          <Section>
            <Memory />
          </Section>
          <Section>
            <SigningIn email={account.email} google={account.via === "google"} hasPassword={account.hasPassword} />
          </Section>
          <Section>
            <SignOutButton onSignOut={onSignOut} />
          </Section>
        </div>
      </FadeScroll>

      {/* Beside the paper: the painting of the season you're in (it changes with the Seasons
          choice, so the setting shows what it does), with a short note signed over its lower part. */}
      {wide && (
        <SideColumn>
          <SeasonPainting reading={`${now.year}-${now.name}`} frame="aspect-[4/5] max-h-[calc(100vh-80px)]">
            <About account={account} items={items} timeZone={timeZone} set={set} />
          </SeasonPainting>
          <div className="mt-2 shrink-0 text-[13px] text-ink-muted">
            {now.name} · {SET_NAMES[set]}
          </div>
        </SideColumn>
      )}
    </>
  );
}

const LANGUAGE_NAMES: Partial<Record<PieceLanguage, string>> = { en: "English", hi: "हिन्दी", "hi-Latn": "Hinglish" };

// Who is writing, in a few plain lines: name, email, since when, how many pieces, in which
// languages. Facts only: no charts, no "this month", nothing that reads like a score.
function About({ account, items, timeZone, set }: { account: Account; items: LibraryItem[] | null; timeZone: string; set: SeasonSet }) {
  const oldest = items?.reduce<string | null>((min, i) => (!min || i.createdAt < min ? i.createdAt : min), null) ?? null;
  const now = seasonPlace(new Date(), timeZone, set);
  const since = oldest ? seasonPlace(new Date(oldest), timeZone, set) : null;
  const byUse = new Map<string, number>();
  for (const i of items ?? []) {
    const name = i.language ? LANGUAGE_NAMES[i.language] : undefined;
    if (name) byUse.set(name, (byUse.get(name) ?? 0) + 1);
  }
  const languages = [...byUse.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);

  const sinceText = since
    ? since.year === now.year && since.name === now.name
      ? { before: "Started writing with Ink this ", fact: now.name, after: "." }
      : { before: "Writing with Ink since ", fact: `${since.name} ${since.year}`, after: "." }
    : { before: "Your first piece is ", fact: "one blank page away", after: "." };
  const count = items?.length ? (items.length === 1 ? "1 piece" : `${items.length} pieces`) : null;

  // A short note written over the lower part of the painting, on a soft shade that rises from
  // the bottom, then the pen name signed in white below it.
  return (
    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(16,18,34,0.78)_0%,rgba(16,18,34,0.55)_55%,rgba(16,18,34,0)_100%)] px-7 pt-24 pb-6 text-white [text-shadow:0_1px_8px_rgba(10,12,28,0.45)]">
      {items && (
        <div className="flex flex-col gap-3 font-serif text-[15px] leading-[24px] text-white/85">
          <p className="m-0">
            {sinceText.before}
            <span className="whitespace-nowrap text-white">{sinceText.fact}</span>
            {sinceText.after}
          </p>
          {count && (
            <p className="m-0">
              <span className="whitespace-nowrap text-white">{count}</span>
              {languages.length > 0 && <>, in {listOf(languages)}</>}.
            </p>
          )}
        </div>
      )}
      {account.penName ? (
        <div className="mt-5">
          <Signature name={account.penName} tone="light" align="left" size={24} />
        </div>
      ) : (
        <div className="mt-3 truncate text-[13px] text-white/85">{account.email}</div>
      )}
    </div>
  );
}

// "English", "English and हिन्दी", "English, हिन्दी and Hinglish".
function listOf(names: string[]): string {
  return names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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
        className="mt-2 box-border h-12 w-full rounded-md border border-line-strong bg-surface px-3.5 font-serif text-[18px] text-ink placeholder:text-ink-muted"
      />
      <SaveStatus state={state} />
    </section>
  );
}

function Seasons({ initial, onChange }: { initial: SeasonChoice; onChange: (choice: SeasonChoice) => void }) {
  const [choice, setChoice] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");

  const pick = async (next: SeasonChoice) => {
    const before = choice;
    setChoice(next);
    onChange(next);
    setState("saving");
    const ok = await saveSeasons(next);
    if (!ok) {
      setChoice(before);
      onChange(before);
    }
    setState(ok ? "saved" : "failed");
  };

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" aria-describedby="seasons-help">
      <legend className="p-0">
        <h2 className="m-0 text-[16px] leading-[22px] font-semibold">Seasons</h2>
      </legend>
      <p id="seasons-help" className="mt-2 mb-0 max-w-[440px] text-ink-muted">
        Ink groups your writing by season. If they look wrong for where you write, choose another.
      </p>
      <div className="mt-3 flex flex-col gap-1">
        {SEASON_OPTIONS.map((o) => (
          <ChoiceRow key={o.value} name="seasons" value={o.value} label={o.label} sub={o.sub} checked={choice === o.value} onChoose={() => void pick(o.value)} />
        ))}
      </div>
      <SaveStatus state={state} />
    </fieldset>
  );
}

// One choice among several (Seasons): a radio, its name and one line of what it means.
function ChoiceRow({ name, value, label, sub, checked, onChoose }: { name: string; value: string; label: string; sub: string; checked: boolean; onChoose: () => void }) {
  return (
    <label className={`-mx-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 ${checked ? "bg-surface-hover" : ""}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChoose} className={`mt-[3px] h-4 w-4 shrink-0 accent-ink ${focusRing}`} />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-[13px] leading-[18px] text-ink-muted">{sub}</span>
      </span>
    </label>
  );
}

// A plain note on what Ink does with the writing. No switches, no counts: the writer's choices
// are elsewhere or not needed yet; the privacy page has the full detail.
function Memory() {
  return (
    <>
      <h2 className="m-0 text-[16px] leading-[22px] font-semibold">Memory</h2>
      <p className="mt-2 mb-0 max-w-[440px] text-ink-muted">
        Ink reads what you write so it can bring old lines back and notice what you keep returning to. Each piece gets a private
        set of numbers so Ink can find the ones that are close. Only you can see them. Nothing is shared, and nothing is used
        to train anything.{" "}
        <a href="/privacy" className={`touch-44 font-medium text-ink underline underline-offset-2 ${focusRing}`}>
          Privacy
        </a>
      </p>
    </>
  );
}

// Seconds before "Send a new code" appears, as on the sign-in code screen.
const RESEND_AFTER = 20;

// The ways this writer can get in (not how they signed in this time, which Ink can't tell):
// Google once linked; a password once set; otherwise the email code. Adding or
// changing the password happens here, behind an email code.
function SigningIn({ email, google, hasPassword }: { email: string; google: boolean; hasPassword: boolean }) {
  const [has, setHas] = useState(hasPassword);
  const [form, setForm] = useState(false);
  const [changed, setChanged] = useState(false);
  const [saved, setSaved] = useState(false);
  const [code, setCode] = useState("");
  const [codeFocused, setCodeFocused] = useState(false);
  const [left, setLeft] = useState(RESEND_AFTER);
  const [pw, setPw] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [wrongCode, setWrongCode] = useState(false);
  const long = pw.length >= 8;

  useEffect(() => {
    if (!form || left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [form, left]);

  // One email per click: the code goes out when the writer opens the form (or asks again).
  const send = async (again: boolean) => {
    if (sending) return;
    setSending(true);
    const result = await sendPasswordCode();
    setSending(false);
    setCode("");
    setWrongCode(false);
    if (!result.ok) return setMessage(PASSWORD_TEXT[result.problem]);
    setLeft(RESEND_AFTER);
    setMessage(again ? "New code sent. Only the newest code works." : null);
  };
  const open = () => {
    setForm(true);
    setPw("");
    setMessage(null);
    void send(false);
  };
  const save = async () => {
    if (code.length < 6) return setMessage("Enter all 6 digits from the email.");
    if (!long) return setMessage("Make it at least 8 characters.");
    setBusy(true);
    const result = await setPassword(pw, code);
    setBusy(false);
    if (!result.ok) {
      setWrongCode(result.problem === "wrong-code");
      return setMessage(PASSWORD_TEXT[result.problem]);
    }
    setChanged(has);
    setSaved(true);
    setHas(true);
    setForm(false);
    setPw("");
    setCode("");
  };
  const active = Math.min(code.length, 5);

  return (
    <>
      <h2 className="m-0 text-[16px] leading-[22px] font-semibold">Signing in</h2>
      <div className="mt-1.5 truncate font-medium">{email}</div>
      {!has && !google && <p className="mt-1 mb-0 text-ink-muted">You sign in with a code from your email.</p>}
      <ul className="m-0 mt-3 list-none p-0">
        {google && <WayIn>Google</WayIn>}
        {has && (
          <WayIn
            action={
              !form && (
                <button type="button" onClick={open} className={linkButton}>
                  Change password
                </button>
              )
            }
          >
            Password
          </WayIn>
        )}
      </ul>
      {!has && !form && (
        <Button onClick={open} className="mt-3">
          Add a password
        </Button>
      )}
      {saved && !form && (
        <p className="mt-2 mb-0 text-[13px] leading-[18px] text-ink-muted">
          {changed ? "Password changed." : "Password added."} You’re signed out on your other devices.
        </p>
      )}
      {form && (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p className="mt-2 mb-0 max-w-[440px] text-ink-muted">
            {sending ? "Sending a code to " : "We sent a 6-digit code to "}
            <span className="font-medium text-ink">{email}</span>.
          </p>
          <label htmlFor="password-code" className="mt-3 block font-medium">
            Code
          </label>
          {/* One real numeric field, drawn as six cells (as on the sign-in code screen). */}
          <div className="relative mt-1.5 h-12 max-w-[320px]">
            <div aria-hidden="true" className="grid h-12 grid-cols-6 gap-1.5">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className={`box-border flex items-center justify-center rounded-md bg-surface text-[20px] font-medium ${
                    wrongCode
                      ? "border-[1.5px] border-ink"
                      : codeFocused && i === active
                        ? "border-2 border-accent"
                        : "border border-line-strong"
                  }`}
                >
                  {code[i] ?? ""}
                </div>
              ))}
            </div>
            <input
              id="password-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              aria-invalid={wrongCode || undefined}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setWrongCode(false);
                setMessage(null);
              }}
              onFocus={() => setCodeFocused(true)}
              onBlur={() => setCodeFocused(false)}
              className="absolute inset-0 h-full w-full cursor-text border-0 p-0 text-[16px] opacity-0"
            />
          </div>
          <div className="mt-2 text-[13px] leading-[18px] text-ink-muted">
            {left > 0 ? (
              <>It can take a minute. You can ask for a new code in 0:{String(left).padStart(2, "0")}.</>
            ) : (
              <>
                Didn’t get it? Check your spam folder too.{" "}
                <button
                  type="button"
                  onClick={() => void send(true)}
                  className={`cursor-pointer border-0 bg-transparent p-0 font-medium text-ink underline ${focusRing}`}
                >
                  Send a new code
                </button>
              </>
            )}
          </div>
          <label htmlFor="new-password" className="mt-5 block font-medium">
            {has ? "New password" : "Password"}
          </label>
          <div className="relative mt-1.5">
            <input
              id="new-password"
              type={shown ? "text" : "password"}
              autoComplete="new-password"
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
              className={`touch-44 absolute top-1.5 right-1.5 h-9 cursor-pointer rounded-md border-0 bg-transparent px-2.5 text-[13px] text-ink ${focusRing}`}
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
            <Button type="submit" look="main" busy={busy}>
              Save password
            </Button>
            <button
              type="button"
              onClick={() => setForm(false)}
              className={`h-11 cursor-pointer rounded-md border-0 bg-transparent px-3.5 text-ink/75 transition-colors duration-150 hover:text-ink motion-reduce:transition-none ${focusRing}`}
            >
              Cancel
            </button>
          </div>
          {message && <Note>{message}</Note>}
        </form>
      )}
    </>
  );
}

function SignOutButton({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      busy={busy}
      onClick={() => {
        setBusy(true);
        void onSignOut().finally(() => setBusy(false));
      }}
    >
      Sign out
    </Button>
  );
}

const linkButton = `touch-44 cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-ink underline underline-offset-2 ${focusRing}`;

function WayIn({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex min-h-8 items-center gap-2.5">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-muted" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      <span className="grow">{children}</span>
      {action}
    </li>
  );
}

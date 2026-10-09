import { useEffect, useState, type FormEvent } from "react";
import { openPasswordLink, setPassword } from "../lib/account";
import type { PasswordProblem } from "../lib/password";
import { readPasswordLink } from "../lib/passwordLink";
import { Heading, Eyebrow, Label, MainButton, Message, TextField } from "./parts";

type Step = "intro" | "form" | "done" | "expired";

const TEXT: Record<PasswordProblem, string> = {
  "link-expired": "This link has expired or was already used.",
  same: "That’s already your password. Choose a new one.",
  "rate-limited": "Too many tries for now. Wait a minute, then try again.",
  offline: "You seem to be offline. Check your connection and try again.",
  unknown: "Something went wrong on our side. Your writing is safe. Try again in a moment."
};

// Where the link in the password email lands, on any device. The link is only used when the writer presses
// Continue, so a mail scanner that opens it cannot use it up. It works for 2 hours and once.
export function SetPasswordPage() {
  // Read once, then taken out of the address bar.
  const [tokenHash] = useState(() => readPasswordLink(window.location.search));
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const [step, setStep] = useState<Step>(tokenHash ? "intro" : "expired");
  const [password, setPasswordValue] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const long = password.length >= 8;

  async function proceed() {
    if (busy || !tokenHash) return;
    setBusy(true);
    const result = await openPasswordLink(tokenHash);
    setBusy(false);
    if (result.ok) return setStep("form");
    if (result.problem === "link-expired") return setStep("expired");
    setMessage(TEXT[result.problem]);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!long) return setMessage("Make it at least 8 characters.");
    setBusy(true);
    const result = await setPassword(password);
    setBusy(false);
    if (!result.ok) return setMessage(TEXT[result.problem]);
    setPasswordValue("");
    setStep("done");
  }

  const toInk = () => window.location.assign("/");

  return (
    <div className="auth flex min-h-dvh flex-col items-center bg-auth-cream px-5 pt-16 pb-16 text-auth-ink">
      <main className="w-full max-w-[420px]">
        {step === "intro" && (
          <>
            <Eyebrow>NEW PASSWORD</Eyebrow>
            <Heading>Choose your new password</Heading>
            <p className="mt-2.5 mb-0 text-auth-muted">You asked to add or change the password on your Ink account.</p>
            <MainButton type="button" className="mt-6" busy={busy} onClick={() => void proceed()}>
              Continue
            </MainButton>
            {message && <Message>{message}</Message>}
          </>
        )}
        {step === "form" && (
          <form onSubmit={save} noValidate className="m-0">
            <Eyebrow>NEW PASSWORD</Eyebrow>
            <Heading>Choose your new password</Heading>
            <Label htmlFor="set-password" className="mt-6">
              Password
            </Label>
            <div className="relative">
              <TextField
                id="set-password"
                type={shown ? "text" : "password"}
                autoComplete="new-password"
                autoFocus
                value={password}
                aria-describedby="set-password-rule"
                className="pr-16"
                onChange={(e) => {
                  setPasswordValue(e.target.value);
                  setMessage(null);
                }}
              />
              <button
                type="button"
                aria-pressed={shown}
                onClick={() => setShown(!shown)}
                className="touch-44 absolute top-1.5 right-1.5 h-9 cursor-pointer rounded-md border-0 bg-transparent px-2.5 text-[13px] text-auth-ink"
              >
                {shown ? "Hide" : "Show"}
              </button>
            </div>
            <div id="set-password-rule" aria-live="polite" className={`mt-2 text-[13px] leading-[18px] ${long ? "text-auth-ink" : "text-auth-muted"}`}>
              At least 8 characters
            </div>
            {message && <Message>{message}</Message>}
            <MainButton type="submit" className="mt-4" busy={busy}>
              Save password
            </MainButton>
          </form>
        )}
        {step === "done" && (
          <>
            <Eyebrow>ALL SET</Eyebrow>
            <Heading>Your password is saved</Heading>
            <p className="mt-2.5 mb-0 text-auth-muted">You’re signed out on your other devices.</p>
            <MainButton type="button" className="mt-6" onClick={toInk}>
              Open Ink
            </MainButton>
          </>
        )}
        {step === "expired" && (
          <>
            <Eyebrow>LINK EXPIRED</Eyebrow>
            <Heading>This link can’t be used</Heading>
            <p className="mt-2.5 mb-0 text-auth-muted">
              A link works for 2 hours and only once. Ask for a new one in Profile, or sign in with a code.
            </p>
            <MainButton type="button" className="mt-6" onClick={toInk}>
              Go to Ink
            </MainButton>
          </>
        )}
      </main>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { continueWithGoogle, looksLikeEmail, sendCode, type AuthProblem } from "./actions";
import { GoogleMark, Label, MainButton, Message, TextField } from "./parts";
import { problemText } from "./problems";

type Props = {
  email: string;
  onEmailChange: (email: string) => void;
  onCodeSent: () => void;
};

export function EmailStep({ email, onEmailChange, onCodeSent }: Props) {
  const [invalid, setInvalid] = useState(false);
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const [googleFailed, setGoogleFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function google() {
    setGoogleFailed(false);
    const result = await continueWithGoogle();
    if (!result.ok) setGoogleFailed(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!looksLikeEmail(email)) return setInvalid(true);
    setBusy(true);
    setProblem(null);
    const result = await sendCode(email.trim());
    setBusy(false);
    if (result.ok) onCodeSent();
    else setProblem(result.problem);
  }

  return (
    <>
      <MainButton type="button" onClick={google}>
        <GoogleMark />
        Continue with Google
      </MainButton>
      <div aria-live="polite">
        {googleFailed && <Message>Ink couldn’t open Google sign-in. Try again, or use your email.</Message>}
      </div>

      <div className="my-[18px] flex items-center gap-4 text-[13px] text-auth-muted">
        <span className="h-px grow bg-auth-line" />
        or
        <span className="h-px grow bg-auth-line" />
      </div>

      <form onSubmit={submit} noValidate className="m-0 flex flex-col">
        <Label htmlFor="auth-email">Email</Label>
        <TextField
          id="auth-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="name@gmail.com"
          value={email}
          invalid={invalid}
          aria-describedby="auth-email-msg"
          onChange={(e) => {
            onEmailChange(e.target.value);
            setInvalid(false);
            setProblem(null);
          }}
        />
        <div id="auth-email-msg" aria-live="polite">
          {invalid && <Message>That doesn’t look like an email address. It should look like name@gmail.com.</Message>}
          {problem && problem !== "wrong" && <Message>{problemText(problem, true)}</Message>}
          {problem === "wrong" && <Message>Ink couldn’t send a code to that address. Check it and try again.</Message>}
        </div>
        <MainButton type="submit" className="mt-3" disabled={busy} aria-busy={busy}>
          Continue
        </MainButton>
      </form>

      <p className="mt-[18px] mb-0 text-center text-[13px] leading-[18px] text-auth-muted">
        Your writing is private. Only you can read it.{" "}
        <a href="#privacy" className="text-auth-ink underline underline-offset-2">
          Privacy
        </a>
      </p>
    </>
  );
}

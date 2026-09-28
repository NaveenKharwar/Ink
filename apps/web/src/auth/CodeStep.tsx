import { useEffect, useState, type FormEvent } from "react";
import { checkCode, sendCode, type AuthProblem } from "./actions";
import { Heading, Label, LinkButton, MainButton, Message } from "./parts";
import { problemText } from "./problems";

const RESEND_AFTER = 60;

type Note = "wrong" | "short" | "resent" | { problem: Exclude<AuthProblem, "wrong">; sending: boolean } | null;

type Props = {
  email: string;
  onUsePassword: () => void;
  onChangeEmail: () => void;
};

export function CodeStep({ email, onUsePassword, onChangeEmail }: Props) {
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [left, setLeft] = useState(RESEND_AFTER);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (code.length < 6) return setNote("short");
    setBusy(true);
    const result = await checkCode(email, code);
    setBusy(false);
    // On success the session changes and the app leaves this screen.
    if (!result.ok) setNote(result.problem === "wrong" ? "wrong" : { problem: result.problem, sending: false });
  }

  async function resend() {
    const result = await sendCode(email);
    if (result.ok) {
      setCode("");
      setLeft(RESEND_AFTER);
      setNote("resent");
    } else {
      setNote({ problem: result.problem === "wrong" ? "unknown" : result.problem, sending: true });
    }
  }

  const wrong = note === "wrong";
  const active = Math.min(code.length, 5);

  return (
    <form onSubmit={submit} noValidate className="m-0">
      <Heading>Check your email</Heading>
      <p className="mt-2.5 mb-0 text-auth-muted">
        We sent a 6-digit code to <span className="font-medium text-auth-ink">{email}</span>.
      </p>

      <Label htmlFor="auth-code" className="mt-6">
        Code
      </Label>
      {/* One real numeric field, drawn as six cells. */}
      <div className="relative h-14">
        <div aria-hidden="true" className="grid h-14 grid-cols-6 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className={`box-border flex items-center justify-center rounded-auth-control bg-white text-[22px] font-medium ${
                wrong
                  ? "border-[1.5px] border-auth-ink"
                  : focused && i === active
                    ? "border-2 border-auth-accent"
                    : "border border-auth-line"
              }`}
            >
              {code[i] ?? ""}
            </div>
          ))}
        </div>
        <input
          id="auth-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          aria-invalid={wrong || undefined}
          aria-describedby="auth-code-msg"
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
            setNote(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 h-full w-full cursor-text border-0 p-0 text-[16px] opacity-0"
        />
      </div>
      <div id="auth-code-msg" aria-live="polite">
        {wrong && <Message>That code doesn’t match. Check the newest email from Ink, or send a new code.</Message>}
        {note === "short" && <Message icon={false}>Enter all 6 digits from the email.</Message>}
        {note === "resent" && (
          <Message icon={false} muted>
            New code sent. Only the newest code works.
          </Message>
        )}
        {typeof note === "object" && note && <Message>{problemText(note.problem, note.sending)}</Message>}
      </div>

      <MainButton type="submit" className="mt-4" busy={busy}>
        Start writing
      </MainButton>

      <div className="mt-5 border-t border-auth-line pt-4 text-[13px] leading-[18px]">
        {left > 0 ? (
          <div className="text-auth-muted">
            It can take a minute. You can ask for a new code in 0:{String(left).padStart(2, "0")}.
          </div>
        ) : (
          <>
            <div className="text-auth-muted">Didn’t get it? Check your spam folder too.</div>
            <div className="mt-2 flex flex-wrap gap-5">
              <LinkButton strong onClick={resend}>
                Send a new code
              </LinkButton>
              <LinkButton onClick={onUsePassword}>Use your password instead</LinkButton>
            </div>
          </>
        )}
        <div className="mt-1.5">
          <LinkButton quiet onClick={onChangeEmail}>
            Wrong email? Change it
          </LinkButton>
        </div>
      </div>
    </form>
  );
}

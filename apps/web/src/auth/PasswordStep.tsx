import { useState, type FormEvent } from "react";
import { signInWithPassword, type AuthProblem } from "./actions";
import { Heading, Label, LinkButton, MainButton, Message, TextField } from "./parts";
import { problemText } from "./problems";

type Props = {
  email: string;
  onUseCode: () => Promise<AuthProblem | null>;
  onChangeEmail: () => void;
};

export function PasswordStep({ email, onUseCode, onChangeEmail }: Props) {
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const [sendProblem, setSendProblem] = useState<AuthProblem | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    const result = await signInWithPassword(email, password);
    setBusy(false);
    if (!result.ok) setProblem(result.problem);
  }

  async function useCode() {
    setSendProblem(await onUseCode());
  }

  const wrong = problem === "wrong";

  return (
    <form onSubmit={submit} noValidate className="m-0">
      <Heading>Your password</Heading>
      <p className="mt-2.5 mb-0 text-auth-muted">
        For <span className="font-medium text-auth-ink">{email}</span>. This works only if you added a password in your
        profile.
      </p>

      <Label htmlFor="auth-password" className="mt-6">
        Password
      </Label>
      <div className="relative">
        <TextField
          id="auth-password"
          type={shown ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          invalid={wrong}
          aria-describedby="auth-password-msg"
          className="pr-16"
          onChange={(e) => {
            setPassword(e.target.value);
            setProblem(null);
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
      <div id="auth-password-msg" aria-live="polite">
        {wrong && <Message>That password doesn’t match. Try again, or use a code instead.</Message>}
        {problem && problem !== "wrong" && <Message>{problemText(problem, false)}</Message>}
        {sendProblem && <Message>{problemText(sendProblem === "wrong" ? "unknown" : sendProblem, true)}</Message>}
      </div>

      <MainButton type="submit" className="mt-4" busy={busy}>
        Sign in
      </MainButton>

      <div className="mt-5 flex flex-wrap gap-5 border-t border-auth-line pt-4 text-[13px] leading-[18px]">
        <LinkButton strong onClick={useCode}>
          Send me a code instead
        </LinkButton>
        <LinkButton quiet onClick={onChangeEmail}>
          Wrong email? Change it
        </LinkButton>
      </div>
    </form>
  );
}

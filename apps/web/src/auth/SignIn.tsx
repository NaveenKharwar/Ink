import { useState, type ReactNode } from "react";
import { useMediaQuery } from "../lib/useMediaQuery";
import { usePageHidden } from "../lib/usePageHidden";
import { sendCode, type AuthProblem } from "./actions";
import { CodeStep } from "./CodeStep";
import { EmailStep } from "./EmailStep";
import { Eyebrow } from "./parts";
import { PasswordStep } from "./PasswordStep";
import { SkyScene } from "./SkyScene";

type Step = "email" | "code" | "password";

const isField = (el: EventTarget | null) => el instanceof HTMLInputElement;

export function SignIn() {
  const wide = useMediaQuery("(min-width: 1100px)");
  const hidden = usePageHidden();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [typing, setTyping] = useState(false);
  // Remounts the code step so its countdown restarts after a code is sent from elsewhere.
  const [codeRound, setCodeRound] = useState(0);

  const toCode = () => {
    setCodeRound((n) => n + 1);
    setStep("code");
  };

  async function sendCodeFromPassword(): Promise<AuthProblem | null> {
    const result = await sendCode(email.trim());
    if (!result.ok) return result.problem;
    toCode();
    return null;
  }

  const form = (
    <div
      className="relative"
      onFocus={(e) => isField(e.target) && setTyping(true)}
      onBlur={(e) => isField(e.target) && setTyping(false)}
    >
      {step === "email" && <EmailStep email={email} onEmailChange={setEmail} onCodeSent={toCode} />}
      {step === "code" && (
        <CodeStep
          key={codeRound}
          email={email.trim()}
          wide={wide}
          onUsePassword={() => setStep("password")}
          onChangeEmail={() => setStep("email")}
        />
      )}
      {step === "password" && (
        <PasswordStep
          email={email.trim()}
          wide={wide}
          onUseCode={sendCodeFromPassword}
          onChangeEmail={() => setStep("email")}
        />
      )}
    </div>
  );

  const eyebrow = step === "code" ? "ALMOST IN" : "SIGN IN";

  return wide ? (
    <Desktop still={typing || hidden} header={step === "email" ? <Welcome /> : <Eyebrow>{eyebrow}</Eyebrow>}>
      {form}
    </Desktop>
  ) : (
    <Phone step={step} eyebrow={eyebrow}>
      {form}
    </Phone>
  );
}

function Welcome() {
  return (
    <>
      <Eyebrow>WELCOME TO</Eyebrow>
      <h1 className="mt-1.5 mb-0 font-serif text-[76px] leading-[80px] font-normal tracking-[-0.01em]">Ink</h1>
      <Eyebrow className="mt-3">A PRIVATE MEMORY FOR YOUR WRITING.</Eyebrow>
      <div className="h-14" />
    </>
  );
}

function Desktop({ still, header, children }: { still: boolean; header: ReactNode; children: ReactNode }) {
  return (
    <div className="auth fixed inset-0 overflow-hidden bg-auth-backdrop text-auth-ink">
      <img
        src="/sign-in/sky-blur.jpg"
        alt=""
        aria-hidden="true"
        className="absolute -inset-[60px] h-[calc(100%+120px)] w-[calc(100%+120px)] object-cover opacity-85 blur-[18px] saturate-[0.9]"
      />
      <div className="absolute inset-9 flex overflow-hidden rounded-auth-card shadow-[0_30px_80px_rgba(70,45,20,0.22)]">
        <SkyScene still={still} />
        <main className="relative box-border flex w-[560px] shrink-0 flex-col justify-center overflow-y-auto bg-auth-cream px-[clamp(56px,7vw,100px)] pt-12 pb-[180px]">
          <img
            src="/sign-in/mist.webp"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 w-full opacity-90"
          />
          <div className="relative">{header}</div>
          {children}
        </main>
      </div>
    </div>
  );
}

function Phone({ step, eyebrow, children }: { step: Step; eyebrow: string; children: ReactNode }) {
  return (
    <div className="auth relative min-h-dvh bg-auth-cream text-auth-ink">
      <div className={`relative overflow-hidden ${step === "email" ? "h-[250px]" : "h-[170px]"}`}>
        <img src="/sign-in/sky-1200.webp" alt="" aria-hidden="true" className="h-full w-full object-cover object-[20%_50%]" />
        <div className="absolute top-10 left-5 text-white [text-shadow:0_1px_12px_rgba(25,45,90,0.3)]">
          <div className="font-serif text-[52px] leading-[56px]" aria-hidden="true">
            Ink
          </div>
          <div className="mt-2 text-[11px] leading-[14px] tracking-[0.22em]">Write. Remember. Rediscover.</div>
        </div>
      </div>
      <img
        src="/sign-in/mist.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 left-0 w-full opacity-75"
      />
      <main className="relative mx-auto box-border max-w-[430px] px-5 pt-[22px] pb-10">
        {step === "email" ? (
          <>
            <h1 className="sr-only">Welcome to Ink</h1>
            <div
              aria-hidden="true"
              className="origin-top-left -rotate-2 font-hand text-[20px] leading-8 whitespace-pre-line text-auth-on-sky"
            >
              {"Same sky, same you,\nbut a different story every time."}
            </div>
            <div className="h-5" />
          </>
        ) : (
          <Eyebrow className="text-[11px] leading-[14px]">{eyebrow}</Eyebrow>
        )}
        {children}
      </main>
    </div>
  );
}

import { useState } from "react";
import { usePageHidden } from "../lib/usePageHidden";
import { sendCode, type AuthProblem } from "./actions";
import { CodeStep } from "./CodeStep";
import { EmailStep } from "./EmailStep";
import { Eyebrow } from "./parts";
import { PasswordStep } from "./PasswordStep";
import { SkyScene } from "./SkyScene";

type Step = "email" | "code" | "password";

const isField = (el: EventTarget | null) => el instanceof HTMLInputElement;

// One layout for every screen size: the sky above the form on narrow screens,
// beside it in a card from the `wide` breakpoint up. Only CSS changes between them.
export function SignIn() {
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

  return (
    <div className="auth flex min-h-dvh flex-col bg-auth-cream text-auth-ink wide:fixed wide:inset-0 wide:overflow-hidden wide:bg-auth-backdrop">
      <img
        src="/sign-in/sky-blur.jpg"
        alt=""
        aria-hidden="true"
        className="absolute -inset-[60px] hidden h-[calc(100%+120px)] w-[calc(100%+120px)] object-cover opacity-85 blur-[18px] saturate-[0.9] wide:block"
      />
      <div className="flex grow flex-col wide:absolute wide:inset-9 wide:flex-row wide:overflow-hidden wide:rounded-auth-card wide:shadow-[0_30px_80px_rgba(70,45,20,0.22)]">
        <SkyScene
          still={typing || hidden}
          className={`shrink-0 wide:h-auto wide:shrink wide:grow ${
            step === "email" ? "h-[clamp(200px,32dvh,320px)]" : "h-[170px]"
          }`}
        />
        <main className="relative box-border flex grow flex-col bg-auth-cream px-5 pt-6 pb-[120px] wide:w-[640px] wide:shrink-0 wide:grow-0 wide:justify-center wide:overflow-y-auto wide:px-[clamp(56px,7vw,100px)] wide:pt-12 wide:pb-[60px]">
          <img
            src="/sign-in/mist.webp"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 w-full opacity-75 wide:opacity-90"
          />
          <div className="relative">
            {step === "email" ? (
              <>
                <Eyebrow>WELCOME TO</Eyebrow>
                <h1 className="mt-1.5 mb-0 font-serif text-[52px] leading-[56px] font-normal tracking-[-0.01em] wide:text-[76px] wide:leading-[80px]">
                  Ink
                </h1>
                <p className="mt-4 mb-0 max-w-[420px] font-serif text-[22px] leading-[30px] wide:text-[28px] wide:leading-[36px]">
                  A home for everything you write.
                </p>
                <div className="h-8 wide:h-14" />
              </>
            ) : (
              <Eyebrow>{step === "code" ? "ALMOST IN" : "SIGN IN"}</Eyebrow>
            )}
          </div>
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
                onUsePassword={() => setStep("password")}
                onChangeEmail={() => setStep("email")}
              />
            )}
            {step === "password" && (
              <PasswordStep
                email={email.trim()}
                onUseCode={sendCodeFromPassword}
                onChangeEmail={() => setStep("email")}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

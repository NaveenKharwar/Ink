import type { Trouble } from "../lib/trouble";
import { Button } from "./Button";

const WORDS: Record<Trouble, { title: string; body: string; action: string }> = {
  "signed-out": {
    title: "You’ve been signed out",
    body: "Probably from another device. What you wrote on this device is kept.",
    action: "Sign in"
  },
  offline: {
    title: "Can’t reach Ink right now",
    body: "Check your connection. What you write is kept on this device and sent when Ink is back.",
    action: "Try again"
  },
  broken: {
    title: "Something went wrong",
    body: "It’s not you, and your writing is safe. Try again in a moment.",
    action: "Try again"
  }
};

// The one screen for anything that goes wrong with Ink or the connection. It covers the app, says
// what happened in a line, and offers one way forward. Nothing else in the app shows its own
// complaint for these, so the writer never sees two different messages for one problem.
export function BrokenScreen({ trouble, onAction }: { trouble: Trouble; onAction: () => void }) {
  const words = WORDS[trouble];

  return (
    <div role="alert" className="fixed inset-0 z-[100] flex items-center justify-center bg-ground px-[var(--page-gutter)] text-center">
      <div className="max-w-[360px]">
        <h1 className="m-0 font-display text-[24px] leading-[1.25] font-normal text-ink">{words.title}</h1>
        <p className="mt-3 mb-6 text-[14px] leading-[1.5] text-ink-muted">{words.body}</p>
        <Button autoFocus look="main" onClick={onAction}>
          {words.action}
        </Button>
      </div>
    </div>
  );
}

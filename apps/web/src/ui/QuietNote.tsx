import { useEffect } from "react";

const SHOWN_MS = 4500;

// A short plain sentence about something that just happened ("Piece deleted"). Plain grey words only:
// no box, no border, no icon, nothing to press, so it never looks like a button. It sits under the top
// bar, takes no room from the page, fades in and out by itself, and is read out politely. The host
// keeps the sentence in state and clears it when `onDone` is called.
export function QuietNote({ children, onDone }: { children: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, SHOWN_MS);
    return () => clearTimeout(timer);
  }, [children, onDone]);

  return (
    <div role="status" className="pointer-events-none absolute inset-x-0 top-[60px] z-20 flex justify-center px-6">
      <span key={children} className="quiet-note font-sans text-[13px] leading-5 text-ink-muted">
        {children}
      </span>
    </div>
  );
}

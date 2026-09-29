import { useEffect, useState } from "react";

const LINES = [
  "Write in Hindi, English, or somewhere between.",
  "Ink remembers what you wrote last monsoon.",
  "It quietly finds the pieces that belong together.",
  "An old line can still answer a new one.",
  "Your old lines find their way back.",
  "Clean editor.",
  "No streaks, no scores. Just writing.",
  "Write a line, or a whole story.",
  "Machines can fold the laundry. The poems are yours."
];

const SHOW_MS = 4000;

// One sentence at a time in the corner of the sky: the current one rolls down and
// out while the next rolls in from above. Stops while the writer types.
export function SkyRoller({ still }: { still: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (still) return;
    const t = setInterval(() => setStep((n) => n + 1), SHOW_MS);
    return () => clearInterval(t);
  }, [still]);

  const current = LINES[step % LINES.length];
  const previous = step > 0 ? LINES[(step - 1) % LINES.length] : null;

  return (
    <>
      {/* A soft dusk shade in the corner so white text reads over any part of the painting. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 bottom-0 h-[160px] w-full wide:h-[260px] wide:w-[720px] bg-[radial-gradient(ellipse_at_bottom_right,rgba(22,24,44,0.62)_0%,rgba(22,24,44,0.35)_40%,rgba(22,24,44,0)_72%)]"
      />
    <div className="absolute right-5 bottom-4 text-right font-serif text-[16px] leading-[22px] text-white wide:right-10 wide:bottom-10 wide:text-[20px] wide:leading-7 [text-shadow:0_1px_12px_rgba(25,45,90,0.45)]">
      <ul className="sr-only">
        {LINES.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div aria-hidden="true" className="relative h-11 w-[calc(100vw-40px)] overflow-hidden wide:h-14 wide:w-[min(520px,calc(100vw-840px))]">
        {previous && (
          <div key={`out-${step}`} className="sky-roll-out absolute inset-0 flex items-end justify-end">
            {previous}
          </div>
        )}
        <div key={`in-${step}`} className={`absolute inset-0 flex items-end justify-end ${step > 0 ? "sky-roll-in" : ""}`}>
          {current}
        </div>
      </div>
    </div>
    </>
  );
}

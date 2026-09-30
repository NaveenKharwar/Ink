import { useEffect, useRef, useState } from "react";
import { blend, easeOut, hoverShape, isJoined, MARK_MS, SHAPES, SPOKE_WIDTH, type MarkShape, type MarkState } from "../lib/connectionsMark";
import { prefersReducedMotion } from "../lib/motion";

type Props = {
  state: MarkState;
  size?: number;
};

// The mark for "Ink sees this too" three ink dots joined by threads, still at rest. Ink in colour at rest and on hover;
// the accent once pressed or open, because that is what the accent means: this leads to other writing.
// It moves only when the writer hovers, presses or opens it, never on its own, and not at all with
// reduced motion.
export function ConnectionsMark({ state, size = 28 }: Props) {
  const [shape, setShape] = useState<MarkShape>(SHAPES[state]);
  const current = useRef<MarkShape>(SHAPES[state]);

  useEffect(() => {
    const from = current.current;
    const to = SHAPES[state];
    if (prefersReducedMotion()) {
      current.current = to;
      setShape(to);
      return;
    }
    let frame = 0;
    let start: number | null = null;
    let hoverStart: number | null = null;
    const step = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / MARK_MS);
      if (t < 1) {
        current.current = blend(from, to, easeOut(t));
      } else if (state === "hover") {
        // Hovered: once the dots are in place they keep drifting gently, until the pointer leaves.
        hoverStart ??= now;
        current.current = hoverShape(now - hoverStart);
      } else {
        current.current = to;
      }
      setShape(current.current);
      if (t < 1 || state === "hover") frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [state]);

  const { a, b, c, hub } = shape;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      // Pressed and open: the whole triangle tilts a little about its middle.
      style={{ transformOrigin: "50% 58%", transform: isJoined(state) ? "rotate(-14deg)" : "rotate(0deg)" }}
      className={`transition-[color,transform] duration-500 ease-out motion-reduce:transition-none ${isJoined(state) ? "text-accent" : "text-ink"}`}
    >
      <polygon
        points={`${a[0]},${a[1]} ${b[0]},${b[1]} ${c[0]},${c[1]}`}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
        className={`transition-opacity duration-300 motion-reduce:transition-none ${isJoined(state) ? "opacity-20" : "opacity-0"}`}
      />
      <g stroke="currentColor" strokeWidth={SPOKE_WIDTH} strokeLinecap="round" fill="none">
        <line x1={a[0]} y1={a[1]} x2={hub[0]} y2={hub[1]} opacity={shape.sa} />
        <line x1={b[0]} y1={b[1]} x2={hub[0]} y2={hub[1]} opacity={shape.sb} />
        <line x1={c[0]} y1={c[1]} x2={hub[0]} y2={hub[1]} opacity={shape.sc} />
        <g strokeWidth={shape.tw}>
          <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} opacity={shape.ab} />
          <line x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]} opacity={shape.ac} />
          <line x1={b[0]} y1={b[1]} x2={c[0]} y2={c[1]} opacity={shape.bc} />
        </g>
      </g>
      <g fill="currentColor">
        <circle cx={a[0]} cy={a[1]} r={shape.ra} />
        <circle cx={b[0]} cy={b[1]} r={shape.rb} />
        <circle cx={c[0]} cy={c[1]} r={shape.rc} />
      </g>
    </svg>
  );
}

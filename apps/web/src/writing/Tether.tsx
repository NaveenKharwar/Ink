import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../lib/motion";
import { letGo, makeThread, stepThread, type Thread } from "../lib/thread";

export type TetherState = "hang" | "drift" | "fall";

// A thread hanging from something on screen (found by its data-tether name) with a short
// handwritten note tied to its free end. It sways a little, never loops; when `state` turns to
// "drift" or "fall" it lets go, fades, and calls onGone. Still with reduced motion, and paused
// while the tab is hidden. It never takes a click: everything under it stays usable.
export function Tether({
  anchor,
  side,
  note,
  state,
  pointerWind = false,
  onGone
}: {
  anchor: string;
  // Where on the anchor the thread is pinned: its left edge (the panel) or its bottom (✦).
  side: "left" | "bottom";
  note: string;
  state: TetherState;
  // Desktop: moving the mouse stirs the air. The more it moves, the more the thread floats, a
  // little at a time; it calms down again when the mouse rests.
  pointerWind?: boolean;
  onGone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const goneRef = useRef(onGone);
  stateRef.current = state;
  goneRef.current = onGone;

  useEffect(() => {
    const canvas = canvasRef.current;
    const noteEl = noteRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !noteEl || !context) return;

    const pinOf = () => {
      const el = document.querySelector(`[data-tether="${anchor}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return side === "left" ? { x: r.left, y: r.top + 96 } : { x: r.left + r.width / 2, y: r.bottom - 4 };
    };

    const still = prefersReducedMotion();
    let thread: Thread | null = null;
    let let_go = false;
    let alpha = 0;
    const start = performance.now();
    let frame = 0;

    // Stirred air: grows with every mouse movement (up to a limit), fades slowly on its own.
    let stir = 0;
    let stirDirection = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      stir = Math.min(1, stir + Math.hypot(e.movementX, e.movementY) * 0.0008);
      stirDirection = stirDirection * 0.9 + Math.sign(e.movementX) * 0.1;
    };
    if (pointerWind && !still) window.addEventListener("pointermove", onMove);

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, w, h);
      if (!thread) return;
      const points = thread.points;
      const colour = getComputedStyle(canvas).color;
      context.strokeStyle = colour;
      context.fillStyle = colour;
      context.lineWidth = 1.2;
      context.lineCap = "round";
      context.globalAlpha = 0.8 * alpha;
      context.beginPath();
      context.moveTo(points[0]!.x, points[0]!.y);
      for (let i = 1; i < points.length - 1; i++) {
        const p = points[i]!;
        const q = points[i + 1]!;
        context.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
      }
      const end = points[points.length - 1]!;
      context.lineTo(end.x, end.y);
      context.stroke();
      context.globalAlpha = alpha;
      const dots = thread.pinned ? [points[0]!, end] : [end];
      for (const d of dots) {
        context.beginPath();
        context.arc(d.x, d.y, 2.3, 0, Math.PI * 2);
        context.fill();
      }
      // The note hangs from the thread's end, turned with its last stretch.
      const before = points[points.length - 3]!;
      const angle = Math.max(-0.5, Math.min(0.5, Math.atan2(end.x - before.x, end.y - before.y)));
      noteEl.style.opacity = String(alpha);
      noteEl.style.transform = `translate(${end.x - noteEl.offsetWidth + 10}px, ${end.y + 2}px) rotate(${-angle}rad)`;
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden) return;
      const pin = pinOf();
      if (!thread) {
        if (!pin) return;
        const phone = side === "bottom";
        thread = makeThread(pin.x, pin.y, phone ? 18 : 16, phone ? 7 : 6);
        // A still thread is settled at once, then only drawn.
        if (still) for (let i = 0; i < 400; i++) stepThread(thread, pin, 0, 0);
      }
      if (!let_go && stateRef.current !== "hang") {
        let_go = true;
        if (still) {
          cancelAnimationFrame(frame);
          goneRef.current();
          return;
        }
        letGo(thread, stateRef.current);
      }
      // Hidden anchor (the panel closed, the page slid away): the thread waits out of sight.
      const hidden = !pin && !let_go;
      stir *= 0.992;
      if (!still || let_go) stepThread(thread, pin ?? thread.points[0]!, now, 1 + stir * 5, stirDirection * stir * 0.08);
      else if (pin) {
        // A still thread just moves with what it hangs from.
        const dx = pin.x - thread.points[0]!.x;
        const dy = pin.y - thread.points[0]!.y;
        for (const p of thread.points) {
          p.x += dx;
          p.px += dx;
          p.y += dy;
          p.py += dy;
        }
      }
      if (let_go) {
        alpha = Math.max(0, alpha - 0.012);
        if (alpha === 0) {
          draw();
          cancelAnimationFrame(frame);
          goneRef.current();
          return;
        }
      } else {
        // Appears after a short pause, not with the page's first paint.
        alpha = hidden ? 0 : Math.min(1, Math.max(0, (now - start - 600) / 700));
      }
      draw();
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, [anchor, side, pointerWind]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden text-ink">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div
        ref={noteRef}
        className="absolute top-0 left-0 origin-[calc(100%-10px)_0] font-hand text-[19px] leading-none whitespace-nowrap opacity-0"
      >
        {note}
      </div>
    </div>
  );
}

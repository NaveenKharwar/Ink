import { useLayoutEffect, useRef, useState } from "react";

// The painting's layers are all 1672 × 941.
const ART_W = 1672;
const ART_H = 941;
// How far from the left the cover crop is anchored, so the rooftop and cat stay in view.
const ANCHOR_X = 0.2;

type Stage = { width: number; height: number; left: number; top: number };

// The desktop sky: still plate, two cloud layers drifting one way, the rooftop in front.
export function SkyScene({ still }: { still: boolean }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage | null>(null);

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const fit = () => {
      const w = scene.clientWidth;
      const h = scene.clientHeight;
      const s = Math.max(w / ART_W, h / ART_H);
      const width = ART_W * s;
      const height = ART_H * s;
      setStage({ width, height, left: -(width - w) * ANCHOR_X, top: -(height - h) / 2 });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sceneRef} className={`relative grow overflow-hidden ${still ? "sky-still" : ""}`}>
      <div aria-hidden="true" className="absolute" style={stage ?? { inset: 0 }}>
        <img src="/sign-in/sky-plate-matched.webp" alt="" className="absolute inset-0 h-full w-full" />
        <div className="sky-track sky-clouds-far">
          <img src="/sign-in/clouds-far-loop.webp" alt="" />
          <img src="/sign-in/clouds-far-loop.webp" alt="" />
        </div>
        <div className="sky-track sky-clouds-main">
          <img src="/sign-in/clouds-main-loop.webp" alt="" />
          <img src="/sign-in/clouds-main-loop.webp" alt="" />
        </div>
        <img src="/sign-in/rooftop.webp" alt="" className="absolute inset-0 h-full w-full" />
      </div>
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full opacity-[0.09] mix-blend-multiply">
        <filter id="sky-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#sky-grain)" />
      </svg>

      <div className="absolute top-14 left-[72px] text-white [text-shadow:0_1px_14px_rgba(25,45,90,0.28)]">
        <div className="font-serif text-[76px] leading-[80px] tracking-[-0.01em]" aria-hidden="true">
          Ink
        </div>
        <div className="mt-3.5 text-[14px] leading-[18px] tracking-[0.24em]">Write. Remember. Rediscover.</div>
      </div>

      <div
        aria-hidden="true"
        className="absolute top-[300px] left-24 w-[340px] origin-top-left -rotate-4 font-hand text-[24px] leading-[46px] whitespace-pre-line text-auth-on-sky"
      >
        {"Same sky,\nsame you,\nbut a different story\nevery time."}
      </div>
      <div className="absolute top-[470px] left-[clamp(96px,calc(100%-340px),272px)] h-10 w-px bg-auth-on-sky" />
      <p className="absolute top-[530px] left-[clamp(96px,calc(100%-340px),272px)] m-0 w-[300px] font-serif text-[18px] leading-[27px] text-auth-on-sky">
        Ink keeps everything you write, and quietly shows you which pieces belong together.
      </p>
    </div>
  );
}

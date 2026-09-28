import { useLayoutEffect, useRef, useState } from "react";
import { SkyRoller } from "./SkyRoller";

// The painting's layers are all 1672 × 941.
const ART_W = 1672;
const ART_H = 941;
// How far from the left the cover crop is anchored, so the rooftop and cat stay in view.
const ANCHOR_X = 0.2;

type Stage = { width: number; height: number; left: number; top: number };

// The sky: still plate, two cloud layers drifting one way, the rooftop in front.
export function SkyScene({ still, className = "" }: { still: boolean; className?: string }) {
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
    <div ref={sceneRef} className={`relative overflow-hidden ${still ? "sky-still" : ""} ${className}`}>
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

      <SkyRoller still={still} />
    </div>
  );
}

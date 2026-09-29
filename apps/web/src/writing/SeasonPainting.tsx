import { useEffect, useRef, type ReactNode } from "react";
import { prefersReducedMotion } from "../lib/motion";
import { seasonPainting } from "../lib/seasons";

const DURATION = 1400;
// The mask is drawn small and scaled up, which gives the cloud edges their softness.
const MASK_W = 96;
const MASK_H = 64;

// Soft value noise in 0–1: a few octaves of smoothed random grids, like cloud shapes.
function cloudNoise(seed: number) {
  const grid = (size: number) => {
    const values = new Float32Array((size + 1) * (size + 1));
    let s = seed * 9301 + size * 49297;
    for (let i = 0; i < values.length; i++) {
      s = (s * 9301 + 49297) % 233280;
      values[i] = s / 233280;
    }
    return { size, values };
  };
  const octaves = [grid(4), grid(8), grid(16)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    let total = 0;
    let weight = 0;
    octaves.forEach(({ size, values }, o) => {
      const gx = (((x % 1) + 1) % 1) * size;
      const gy = Math.min(Math.max(y, 0), 0.999) * size;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = smooth(gx - x0);
      const fy = smooth(gy - y0);
      const at = (cx: number, cy: number) => values[(cy % (size + 1)) * (size + 1) + (cx % size)]!;
      const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
      const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
      const w = 1 / 2 ** o;
      total += (top * (1 - fy) + bottom * fy) * w;
      weight += w;
    });
    return total / weight;
  };
}

// Draw an image like object-fit: cover.
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

const images = new Map<string, Promise<HTMLImageElement>>();
function load(src: string) {
  let p = images.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    images.set(src, p);
  }
  return p;
}

// The painting of the season being read. When the season changes, the next painting rolls in
// through soft drifting cloud shapes, like the weather turning, rather than a flat fade.
// The first painting on a page appears at once; a season's painting loads the first time it's
// needed. Reduced motion: a quick plain fade.
export function SeasonPainting({
  reading,
  frame: frameClass = "aspect-[3/2]",
  children
}: {
  reading: string;
  /** Shape of the frame (the painting fills it, cropped from the centre). */
  frame?: string;
  /** Anything laid over the painting, like Profile's signed note. */
  children?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const shown = useRef<HTMLImageElement | null>(null);
  const frame = useRef(0);
  const src = seasonPainting(reading);

  // Keep the canvas sharp at its size; redraw the current painting after a resize.
  useEffect(() => {
    const el = box.current;
    const c = canvas.current;
    if (!el || !c) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(el.clientWidth * dpr);
      c.height = Math.round(el.clientHeight * dpr);
      const ctx = c.getContext("2d");
      if (ctx && shown.current) drawCover(ctx, shown.current, c.width, c.height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    load(src)
      .then((next) => {
        const c = canvas.current;
        const ctx = c?.getContext("2d");
        if (cancelled || !c || !ctx) return;
        cancelAnimationFrame(frame.current);

        // What is on screen now (possibly mid-change) is what the new weather rolls over.
        const before = document.createElement("canvas");
        before.width = c.width;
        before.height = c.height;
        const hadPainting = !!shown.current;
        if (hadPainting) before.getContext("2d")!.drawImage(c, 0, 0);
        shown.current = next;

        // The first painting on a page just appears; only a change of season rolls in.
        if (!hadPainting) {
          ctx.clearRect(0, 0, c.width, c.height);
          drawCover(ctx, next, c.width, c.height);
          return;
        }

        const reduce = prefersReducedMotion();
        const noise = cloudNoise(Math.floor(Math.random() * 1000));
        const mask = document.createElement("canvas");
        mask.width = MASK_W;
        mask.height = MASK_H;
        const mctx = mask.getContext("2d")!;
        const maskData = mctx.createImageData(MASK_W, MASK_H);
        const field = new Float32Array(MASK_W * MASK_H);
        const layer = document.createElement("canvas");
        layer.width = c.width;
        layer.height = c.height;
        const lctx = layer.getContext("2d")!;
        const start = performance.now();
        const duration = reduce ? 300 : DURATION;

        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.drawImage(before, 0, 0);

          lctx.globalCompositeOperation = "source-over";
          lctx.globalAlpha = 1;
          lctx.clearRect(0, 0, layer.width, layer.height);
          drawCover(lctx, next, layer.width, layer.height);

          if (reduce) {
            ctx.globalAlpha = eased;
            ctx.drawImage(layer, 0, 0);
            ctx.globalAlpha = 1;
          } else {
            // Cloud shapes drift sideways while they open; each point turns once the change
            // passes its noise value, with a soft band so edges stay misty.
            const drift = eased * 0.25;
            for (let y = 0; y < MASK_H; y++) {
              for (let x = 0; x < MASK_W; x++) {
                const i = y * MASK_W + x;
                field[i] = noise(x / MASK_W + drift, y / MASK_H);
              }
            }
            const edge = 0.18;
            const reach = eased * (1 + edge);
            for (let i = 0; i < field.length; i++) {
              const a = Math.min(1, Math.max(0, (reach - field[i]!) / edge));
              maskData.data[i * 4 + 3] = a * 255;
            }
            mctx.putImageData(maskData, 0, 0);
            lctx.globalCompositeOperation = "destination-in";
            lctx.imageSmoothingEnabled = true;
            lctx.drawImage(mask, 0, 0, layer.width, layer.height);
            ctx.drawImage(layer, 0, 0);
          }
          if (t < 1) frame.current = requestAnimationFrame(step);
          else {
            ctx.clearRect(0, 0, c.width, c.height);
            drawCover(ctx, next, c.width, c.height);
          }
        };
        frame.current = requestAnimationFrame(step);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <div ref={box} className={`relative w-full shrink-0 overflow-hidden rounded-md bg-surface-hover ${frameClass}`}>
      <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 h-full w-full" />
      {children}
    </div>
  );
}

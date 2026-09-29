import { useEffect, useId, useRef } from "react";
import Vara from "vara";
import { prefersReducedMotion } from "../lib/motion";

// Single-stroke handwriting (Shadows Into Light, OFL), drawn by Vara stroke by stroke like a pen.
const FONT = "/fonts/signature.json";
const DEVANAGARI = /[ऀ-ॿ]/;

// Vara lays text out itself and wraps at spaces by a rough measure, with no option to turn that
// off. Giving the line far more room than any name needs keeps it on one line; the drawing is
// then measured and scaled to fit the box exactly.
const ONE_LINE = 100_000;
const PAD = 4;

// The pen name signed at the end of the note: written out letter by letter, as if by hand.
// The stroke font has Latin letters only, so a Hindi name is set in Kalam and revealed left to
// right instead. Reduced motion: the finished signature, no drawing.
export function Signature({
  name,
  tone = "ink",
  align = "right",
  size = 36
}: {
  name: string;
  tone?: "ink" | "light";
  align?: "left" | "right";
  /** Letter size; the drawing scales down when the name wouldn't fit the width. */
  size?: number;
}) {
  const colour = tone === "light" ? "text-white" : "text-ink";
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const hindi = DEVANAGARI.test(name);

  useEffect(() => {
    const el = box.current;
    if (!el || hindi) return;
    const reduce = prefersReducedMotion();
    let svg: SVGSVGElement | null = null;
    let natural = { width: 0, height: 0 };

    // Scale the drawing (never up) so the whole name fits the box's width.
    const fit = () => {
      if (!svg || !natural.width) return;
      const scale = Math.min(1, el.clientWidth / natural.width);
      svg.setAttribute("width", String(natural.width * scale));
      svg.setAttribute("height", String(natural.height * scale));
    };

    const draw = () => {
      const vara = new Vara(`#${CSS.escape(id)}`, FONT, [
        {
          text: name,
          fontSize: size,
          strokeWidth: 1.6,
          color: "currentColor",
          textAlign: "left",
          width: ONE_LINE,
          // Longer names take a little longer to write; wait for the note to settle first.
          duration: reduce ? 1 : Math.min(2600, 700 + name.length * 180),
          delay: reduce ? 0 : 500
        }
      ]);
      // Once laid out: crop the drawing to the name itself, then fit it to the box.
      vara.ready(() => {
        svg = el.querySelector("svg");
        if (!svg) return;
        const b = svg.getBBox();
        natural = { width: b.width + PAD * 2, height: b.height + PAD * 2 };
        svg.setAttribute("viewBox", `${b.x - PAD} ${b.y - PAD} ${natural.width} ${natural.height}`);
        svg.style.display = "block";
        svg.style.marginLeft = align === "right" ? "auto" : "0";
        fit();
      });
    };

    // Vara needs the box laid out before it can measure, so draw once it has a width; after
    // that a change of width only rescales the finished drawing.
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === 0) return;
      if (svg) fit();
      else if (!el.firstChild) draw();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      el.replaceChildren();
    };
  }, [id, name, hindi, align, size]);

  if (hindi) {
    return (
      <div className={`flex pr-2 ${align === "right" ? "justify-end" : "justify-start"}`}>
        <div
          style={{ fontSize: Math.round(size * 0.85), lineHeight: `${Math.round(size * 1.5)}px` }}
          className={`signature-in max-w-full -rotate-3 truncate py-2 font-hand ${align === "right" ? "origin-right" : "origin-left"} ${colour}`}
        >
          {name}
        </div>
      </div>
    );
  }
  return (
    <div
      id={id}
      ref={box}
      aria-label={name}
      role="img"
      style={{ minHeight: Math.round(size * 1.4) }}
      className={`w-full -rotate-3 [&_svg]:overflow-visible ${align === "right" ? "origin-right" : "origin-left"} ${colour}`}
    />
  );
}

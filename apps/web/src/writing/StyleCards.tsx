import type { PieceStyle } from "@ink/schemas";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Each style's art, in layers of the same size so they line up: the still `painting`, and an
 * optional cut-out `piece` (the flower, the lamp's flame, the cup) that moves on hover. `at` is
 * where the moving part sits, in % of the picture (the flower's stem base, the flame, the cup's
 * rim). Motion on hover: Poem's flower sways in the air, Story's lamp flickers and glows,
 * Notes' cup lets out steam. The painting under a moving cut-out is painted without it (the
 * empty pot, the unlit lamp), so nothing is doubled.
 */
type Art = { painting: string; piece?: string; motion: "sway" | "flicker" | "steam"; at: { x: number; y: number } };
export const STYLES: Array<{ value: PieceStyle; label: string; hint: string; art: Art }> = [
  {
    value: "poem",
    label: "Poem",
    hint: "Lines and stanzas",
    art: { painting: "/styles/poem.webp", piece: "/styles/poem-flower.webp", motion: "sway", at: { x: 51, y: 61 } }
  },
  {
    value: "story",
    label: "Story",
    hint: "Paragraphs, like a book",
    art: { painting: "/styles/story.webp", piece: "/styles/story-flame.webp", motion: "flicker", at: { x: 49.5, y: 58 } }
  },
  { value: "notes", label: "Notes", hint: "Headings, lists, links", art: { painting: "/styles/notes.webp", motion: "steam", at: { x: 50, y: 58 } } }
];

// The picture on a card: the painting, the moving cut-out, and what code adds on top (the
// lamp's glow, the cup's steam). Everything moves only while the card is hovered or focused.
function StyleArt({ art }: { art: Art }) {
  const at = { "--at-x": `${art.at.x}%`, "--at-y": `${art.at.y}%` } as React.CSSProperties;
  return (
    <span aria-hidden="true" className={`style-card-art motion-${art.motion}`} style={at}>
      <img src={art.painting} alt="" />
      {art.piece && <img src={art.piece} alt="" className="style-card-piece" />}
      {art.motion === "flicker" && <span className="style-card-glow" />}
      {art.motion === "steam" && (
        <svg className="style-card-steam" viewBox="0 0 60 90" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M22 88c-6-12 8-18 2-30s6-18 0-30" />
          <path d="M32 88c-6-12 8-18 2-30s6-18 0-30" />
          <path d="M42 88c-6-12 8-18 2-30s6-18 0-30" />
        </svg>
      )}
    </span>
  );
}

// How long the cards take to fade once the writer starts (instant with reduced motion).
const FADE_MS = 300;

type Props = {
  shown: boolean;
  wide: boolean;
  /** Writes in this style now (a tapped card, or the tapped stage). */
  onPick: (style: PieceStyle) => void;
  /** Narrow rows: the style the stage shows, and so the one typing makes. */
  selected: PieceStyle;
  onSelect: (style: PieceStyle) => void;
};

// Under "Start writing…" on a blank page: the three ways to write. Picking one sets the
// piece's style; typing straight away writes in the selected one (a poem until another is
// chosen). The cards fade out after the first word. Each is tall and unboxed: its frame melts
// into the page toward the top, and it stays quiet until hovered, when it shows fully and its
// painting moves gently (see .style-card).
export function StyleCards({ shown, wide, onPick, selected, onSelect }: Props) {
  // Stay in the page while fading out, then leave it.
  const [present, setPresent] = useState(shown);
  useEffect(() => {
    if (shown) return setPresent(true);
    const t = setTimeout(() => setPresent(false), FADE_MS);
    return () => clearTimeout(t);
  }, [shown]);
  // Three cards in a row need room; where there isn't enough (a phone up to about 500px wide)
  // they become one painting on a stage with three small windows. Decided by measuring the
  // space, not by screen size.
  const box = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(!wide);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setNarrow(el.clientWidth < ROW_MIN_PX);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [present]);
  if (!present) return null;

  const fade = `transition-opacity duration-300 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`;
  return (
    <div ref={box} role="group" aria-label="How do you want to write?" inert={!shown} className={`${wide ? "mt-12" : "mt-8"} ${fade}`}>
      {narrow ? (
        <StyleStage selected={selected} onSelect={onSelect} onPick={onPick} />
      ) : (
        <div className={`grid grid-cols-3 ${wide ? "gap-5" : "gap-3"}`}>
          {STYLES.map((s) => (
            <button key={s.value} type="button" onClick={() => onPick(s.value)} className={`${cardClass} relative bg-transparent ${wide ? "h-[320px]" : "h-[280px]"}`}>
              <StyleCardFace style={s} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The narrowest the three cards may sit side by side: about a 500px screen less the page's
// margins. Anything narrower gets the stage and windows.
const ROW_MIN_PX = 460;

const cardClass =
  "style-card flex cursor-pointer flex-col rounded-md border-0 p-0 text-left text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function StyleCardFace({ style }: { style: (typeof STYLES)[number] }) {
  return (
    <>
      <StyleArt art={style.art} />
      <span className="style-card-label block px-4 pb-4">
        <span className="block font-display text-[20px] leading-[26px]">{style.label}</span>
        <span className="mt-0.5 block text-[13px] leading-[18px] text-ink-muted">{style.hint}</span>
      </span>
    </>
  );
}

// Narrow rows: today's card is the stage, one painting whole with its own motion playing; the
// three styles sit under it as small arched windows, each a whole painting, always in view.
// Tapping a window crossfades the stage to that style; tapping the stage writes in it.
function StyleStage({ selected, onSelect, onPick }: Pick<Props, "selected" | "onSelect" | "onPick">) {
  return (
    <div>
      <div className="relative h-[320px]">
        {STYLES.map((s) => {
          const on = s.value === selected;
          return (
            <button
              key={s.value}
              type="button"
              tabIndex={on ? 0 : -1}
              aria-hidden={!on || undefined}
              aria-label={`Write a ${s.label.toLowerCase()}: ${s.hint}`}
              onClick={() => onPick(s.value)}
              className={`${cardClass} absolute inset-0 transition-opacity duration-[420ms] motion-reduce:transition-none ${
                on ? "is-live opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <StyleCardFace style={s} />
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-3">
        {STYLES.map((s) => {
          const on = s.value === selected;
          return (
            <button
              key={s.value}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(s.value)}
              className={`flex min-h-11 cursor-pointer flex-col items-center gap-2 border-0 bg-transparent px-0 pt-1 pb-0 font-display text-[15px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                on ? "text-ink" : "text-ink-muted"
              }`}
            >
              <span
                aria-hidden="true"
                className={`block h-[90px] w-[72px] overflow-hidden rounded-t-[36px] rounded-b-lg outline-accent transition-[opacity,outline-width] duration-200 motion-reduce:transition-none ${
                  on ? "opacity-100 outline-2 outline-offset-[3px]" : "opacity-[.72] outline-0"
                }`}
              >
                <img src={s.art.painting} alt="" className="block h-full w-full object-cover" />
              </span>
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import type { PieceStyle } from "@ink/schemas";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/motion";

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

// Under "Start writing…" on a blank page: the three ways to write. Picking one sets the
// piece's style; typing straight away makes a poem. The cards fade out after the first word.
// Each is tall and unboxed: its frame melts into the page toward the top, and it stays quiet
// until hovered, when it shows fully and its painting moves gently (see .style-card).
export function StyleCards({ shown, wide, onPick }: { shown: boolean; wide: boolean; onPick: (style: PieceStyle) => void }) {
  // Stay in the page while fading out, then leave it.
  const [present, setPresent] = useState(shown);
  useEffect(() => {
    if (shown) return setPresent(true);
    const t = setTimeout(() => setPresent(false), FADE_MS);
    return () => clearTimeout(t);
  }, [shown]);
  // Three cards in a row need room; where there isn't enough (a phone up to about 500px wide)
  // they become a stack to swipe. Decided by measuring the space, not by screen size.
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
        <StyleDeck onPick={onPick} />
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
// margins. Anything narrower gets the swipeable stack.
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

// How far a card must be dragged to count as a swipe, and how long it takes to fly away.
const SWIPE_PX = 70;
const FLY_MS = 260;

// Phone: the three styles as a stack of cards, like the dating apps. The top card is full size
// with its painting moving; the other two peek out behind it. Swipe it either way and it flies
// off to the back of the stack; tap it to write in that style. Arrow keys do the same.
function StyleDeck({ onPick }: { onPick: (style: PieceStyle) => void }) {
  const [top, setTop] = useState(0);
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState<0 | 1 | -1>(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const moved = useRef(false);

  const next = (direction: 1 | -1) => {
    if (flying) return;
    setFlying(direction);
    setTimeout(() => {
      setTop((t) => (t + 1) % STYLES.length);
      setFlying(0);
      setDx(0);
    }, prefersReducedMotion() ? 0 : FLY_MS);
  };

  // The page underneath slides between menu, page and panel on a swipe too; the deck keeps its
  // own swipes to itself.
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current || flying) return;
    const x = e.clientX - start.current.x;
    if (Math.abs(x) > 6) moved.current = true;
    setDx(x);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    if (Math.abs(dx) > SWIPE_PX) next(dx > 0 ? 1 : -1);
    else setDx(0);
  };

  const order = STYLES.map((_, i) => STYLES[(top + i) % STYLES.length]!);
  return (
    <div>
      <div className="relative h-[320px]">
        {[...order].reverse().map((s) => {
          const depth = order.indexOf(s);
          const isTop = depth === 0;
          const x = isTop ? (flying ? flying * 420 : dx) : 0;
          // Like the dating apps: the next card waits right under the top one, a little smaller,
          // and grows to full size as the top card is dragged away, so there's never a gap.
          const pull = flying ? 1 : Math.min(1, Math.abs(dx) / SWIPE_PX);
          const size = depth === 0 ? 1 : depth === 1 ? 0.94 + 0.06 * pull : 0.94;
          return (
            <button
              key={s.value}
              type="button"
              tabIndex={isTop ? 0 : -1}
              aria-hidden={!isTop || undefined}
              aria-label={isTop ? `${s.label}: ${s.hint}. Swipe for another style.` : undefined}
              onClick={() => {
                if (isTop && !moved.current) onPick(s.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  next(e.key === "ArrowRight" ? 1 : -1);
                }
              }}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? onPointerUp : undefined}
              style={{
                translate: `${x}px 0px`,
                rotate: `${isTop ? x * 0.05 : 0}deg`,
                scale: `${size}`,
                opacity: isTop && flying ? 0 : 1,
                zIndex: STYLES.length - depth,
                // Following the finger: no easing. The card that just flew off jumps straight to the
                // back of the stack (hidden behind the others) instead of sliding back across.
                transition:
                  dragging || depth === STYLES.length - 1
                    ? "none"
                    : `translate ${FLY_MS}ms ease, rotate ${FLY_MS}ms ease, scale ${FLY_MS}ms ease, opacity ${FLY_MS}ms ease`
              }}
              // A solid page-coloured base: the painting fades out at the top, and the card underneath
              // must not show through there.
              className={`${cardClass} absolute inset-x-0 top-0 h-[320px] origin-center touch-pan-y bg-surface ${isTop ? "is-live" : ""}`}
            >
              <StyleCardFace style={s} />
            </button>
          );
        })}
      </div>
      <div aria-hidden="true" className="mt-3 flex justify-center gap-1.5">
        {STYLES.map((s, i) => (
          <span key={s.value} className={`h-1.5 w-1.5 rounded-full ${i === top ? "bg-ink" : "bg-line-strong"}`} />
        ))}
      </div>
    </div>
  );
}

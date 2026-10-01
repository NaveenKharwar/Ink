import type { Piece } from "@ink/schemas";
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { writingExtensions } from "../editor/extensions";
import { Picture } from "../editor/picture";
import { pieces } from "../lib/api";
import type { BesideTab } from "../lib/reading";
import { prefersReducedMotion } from "../lib/motion";
import { noteLabel } from "../lib/related";
import type { SeasonSet } from "../lib/seasons";
import { ScreenLoader } from "../ui/Loader";
import { ChevronSideIcon, CloseIcon } from "./icons";
import { PictureView } from "./PictureView";
import { FadeScroll } from "../ui/FadeScroll";

type Props = {
  tabs: BesideTab[];
  active: string;
  seasonSet: SeasonSet;
  /** Phone: one piece at a time, as its own screen; desktop: tabs beside the page. */
  phone?: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onOpenPiece: (id: string) => void;
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// The ‹ › buttons at the ends of the tab strip.
const stepButton =
  "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center self-center rounded-md border-0 bg-transparent p-0 text-ink hover:text-accent disabled:cursor-default disabled:text-ink-subtle disabled:hover:text-ink-subtle";

type Load = { status: "loading" } | { status: "ready"; piece: Piece } | { status: "error" };

function usePiece(id: string): Load {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    pieces.get(id).then(
      (piece) => !cancelled && setLoad({ status: "ready", piece }),
      () => !cancelled && setLoad({ status: "error" })
    );
    return () => {
      cancelled = true;
    };
  }, [id]);
  return load;
}

// An older piece, read only: the same look as the page (its own writing style), nothing to edit.
function Reader({ piece, tab, seasonSet, phone }: { piece: Piece; tab: BesideTab; seasonSet: SeasonSet; phone: boolean }) {
  const extensions = useMemo(
    () =>
      writingExtensions.map((extension) =>
        extension === Picture ? Picture.configure({ view: ReactNodeViewRenderer(PictureView), onFiles: () => {} }) : extension
      ),
    []
  );
  const editor = useEditor({ extensions, content: piece.content, editable: false, editorProps: { attributes: { "aria-label": tab.title } } }, [piece.id]);
  return (
    <FadeScroll className={`ink-editor style-${piece.style ?? "poem"} grow pb-8 ${phone ? "px-6 pt-8" : "px-10 pt-9"}`}>
      {/* The same reading column as the page, so a wide screen never makes very long lines. */}
      <div className="mx-auto max-w-[640px]">
        <span className="mb-5 block truncate text-[11px] leading-4 font-medium tracking-[0.08em] text-ink-muted uppercase">
          {noteLabel({ createdAt: piece.createdAt, title: piece.title }, seasonSet)}
        </span>
        <EditorContent editor={editor} />
      </div>
    </FadeScroll>
  );
}

// A second paper next to the page (desktop), or the next screen after the panel (phone): an older
// piece to read while writing. Browser-style tabs on top, one per piece, each with its own ✕;
// closing the last one closes the paper. Never opens by itself.
export function BesidePaper({ tabs, active, seasonSet, phone = false, onSelect, onClose, onOpenPiece }: Props) {
  const current = tabs.find((t) => t.id === active) ?? tabs[0]!;
  const load = usePiece(current.id);

  // Tabs share the strip and shrink to a minimum; past that the strip scrolls sideways, and the
  // tab in use always scrolls into view.
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current?.querySelector("[data-active]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current.id, tabs.length]);
  // When there are more tabs than fit, ‹ › buttons show at the two ends; each moves the strip one
  // step and is muted when there is nothing more that way. Nothing depends on a hidden gesture.
  const [edge, setEdge] = useState({ overflowing: false, atStart: true, atEnd: true });
  const measure = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    setEdge({
      overflowing: el.scrollWidth > el.clientWidth + 1,
      atStart: el.scrollLeft <= 1,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
    });
  }, []);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure, tabs.length]);
  const step = (direction: 1 | -1) =>
    strip.current?.scrollBy({ left: direction * strip.current.clientWidth * 0.6, behavior: prefersReducedMotion() ? "auto" : "smooth" });

  return (
    <section
      aria-label="Older writing, read only"
      className={`box-border flex h-full flex-col bg-surface ${phone ? "w-screen shrink-0 border-l border-line" : "w-full border-x border-line"}`}
    >
      <div className={`flex h-14 shrink-0 items-stretch border-b border-line ${phone ? "pl-6" : "pr-3 pl-2"}`}>
        {!phone && edge.overflowing && (
          <button type="button" onClick={() => step(-1)} disabled={edge.atStart} aria-label="Show earlier tabs" className={`${stepButton} ${focus}`}>
            <ChevronSideIcon dir="left" />
          </button>
        )}
        <div
          ref={strip}
          className="flex min-w-0 grow items-stretch gap-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {(phone ? [current] : tabs).map((tab) => {
            const on = tab.id === current.id;
            return (
              <div
                key={tab.id}
                data-active={on ? "" : undefined}
                className={`box-border flex items-center gap-1 border-0 border-b-2 border-solid ${on ? "border-ink text-ink" : "border-transparent text-ink-muted"} ${
                  phone ? "max-w-[220px] grow" : "max-w-[200px] min-w-[128px] flex-1"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(tab.id)}
                  aria-current={on}
                  title={tab.title}
                  className={`flex h-full min-w-0 flex-1 cursor-pointer items-center border-0 bg-transparent p-0 text-left text-[14px] font-medium text-inherit hover:text-ink ${
                    phone ? "" : "pl-4"
                  } ${focus}`}
                >
                  <span className="truncate">{tab.title}</span>
                </button>
                {!phone && (
                  <button
                    type="button"
                    onClick={() => onClose(tab.id)}
                    aria-label={`Close ${tab.title}`}
                    className={`flex h-[26px] w-[26px] shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink-muted hover:text-ink ${focus}`}
                  >
                    <CloseIcon size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {!phone && edge.overflowing && (
          <button type="button" onClick={() => step(1)} disabled={edge.atEnd} aria-label="Show later tabs" className={`${stepButton} ${focus}`}>
            <ChevronSideIcon dir="right" />
          </button>
        )}
        {phone && (
          <button
            type="button"
            onClick={() => onClose(current.id)}
            aria-label="Close and go back"
            className={`mr-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center self-center rounded-md border-0 bg-transparent p-0 text-ink ${focus}`}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {load.status === "ready" && <Reader key={load.piece.id} piece={load.piece} tab={current} seasonSet={seasonSet} phone={phone} />}
      {load.status === "loading" && (
        <div className="flex grow items-center justify-center">
          <ScreenLoader label="Opening" />
        </div>
      )}
      {load.status === "error" && (
        <p className="m-0 grow px-6 py-8 text-ink-muted">Couldn’t open this piece. Check your connection.</p>
      )}

      <div className={`flex h-14 shrink-0 items-center justify-between border-t border-line text-[13px] text-ink-muted ${phone ? "px-6" : "px-10"}`}>
        <span>Read only</span>
        <button
          type="button"
          onClick={() => onOpenPiece(current.id)}
          className={`cursor-pointer border-0 border-b-[1.5px] border-dotted border-accent bg-transparent p-0 text-[13px] text-accent ${focus}`}
        >
          Open piece
        </button>
      </div>
    </section>
  );
}

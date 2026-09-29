import type { PieceLanguage } from "@ink/schemas";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Dropdown } from "./Dropdown";
import { CheckCircleIcon, ChevronIcon, IndentIcon, NoteIcon, QuoteIcon, SceneBreakIcon } from "./icons";
import type { SaveState } from "./usePieceSave";

export const LANGUAGES: Array<{ value: PieceLanguage; label: string }> = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "hi-Latn", label: "Hinglish" }
];

type Props = {
  editor: Editor;
  wide: boolean;
  words: number;
  language: PieceLanguage;
  onLanguage: (language: PieceLanguage) => void;
  save: SaveState;
};

// The same slide as Ink's side sheets (360ms, same curve); with reduced motion it moves at once.
// Room kept between the tools and the words/save group when they share one line.
const GROUP_GAP = 24;
// The gap between the save icon and its word (gap-2).
const SAVE_GAP = 8;

const SLIDE = "transition-[translate,opacity] duration-[360ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none";

function Tool({
  label,
  active,
  onClick,
  wide,
  children
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  wide: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      // Keep the writer's selection in the page.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 p-0 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        wide ? "w-10" : "w-[34px]"
      } ${active ? "bg-surface-hover" : "bg-transparent"}`}
    >
      {children}
    </button>
  );
}

const SAVE_SHORT = { idle: "", saving: "Saving", saved: "Saved", device: "On this device", refused: "Not saved" } as const;

// The one floating tool bar: a little formatting, then word count, language and save state.
export function Toolbar({ editor, wide, words, language, onLanguage, save }: Props) {
  // The writer can slide the bar down with the tab on its top edge; it stays down until they
  // tap the tab left at the bottom. Nothing hides it on its own.
  const [tucked, setTucked] = useState(false);
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      heading: e.isActive("heading", { level: 1 }),
      quote: e.isActive("blockquote")
    })
  });
  const run = () => editor.chain().focus();

  // When the tools and the words/save group don't fit on one line (a narrow phone), the bar
  // becomes two rows: the tools spread evenly on top, then a thin line, then word count and
  // save state at either end. Decided by measuring what the groups need, not by screen size.
  const bar = useRef<HTMLDivElement>(null);
  const tools = useRef<HTMLDivElement>(null);
  const meta = useRef<HTMLDivElement>(null);
  const [twoRows, setTwoRows] = useState(false);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const measure = () => {
      if (!tools.current || !meta.current) return;
      // Natural widths: the buttons and texts themselves (spreading them doesn't change these),
      // as they are on one line: the save word that only two rows show is left out.
      const widthOf = (group: HTMLElement) =>
        [...group.children].reduce((w, c) => {
          const extra = [...c.querySelectorAll<HTMLElement>("[data-two-rows-only]")].reduce((x, e) => x + e.offsetWidth + SAVE_GAP, 0);
          return w + (c as HTMLElement).offsetWidth - extra;
        }, 0);
      const style = getComputedStyle(el);
      const room = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setTwoRows(widthOf(tools.current) + widthOf(meta.current) + GROUP_GAP > room);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [words, save, wide]);

  // Word count, language (desktop; on phone it is in the top bar) and save state. Every gap is
  // the same, and the language button's own padding is pulled in so its text lines up with the
  // gap like the others.
  const metaItems: Array<{ key: string; node: ReactNode }> = [
    {
      key: "words",
      node: (
        <span className="whitespace-nowrap text-ink-muted">
          {words} {words === 1 ? "word" : "words"}
        </span>
      )
    }
  ];
  if (wide) {
    metaItems.push({
      key: "language",
      node: (
        <div className="-mx-2.5">
          <Dropdown label="Language" value={language} options={LANGUAGES} onChange={onLanguage} placement="up" align="end" />
        </div>
      )
    });
  }
  if (save !== "idle") {
    metaItems.push({
      key: "save",
      node: (
        <span className="flex items-center gap-2 whitespace-nowrap text-ink-muted">
          {save === "refused" ? <NoteIcon /> : <CheckCircleIcon saving={save === "saving"} />}
          {wide ? (
            <span>{SAVE_SHORT[save]}</span>
          ) : twoRows ? (
            <span data-two-rows-only="">{SAVE_SHORT[save]}</span>
          ) : (
            <span className="sr-only">{SAVE_SHORT[save]}</span>
          )}
        </span>
      )
    });
  }

  return (
    <>
      <div
        ref={bar}
        role="toolbar"
        aria-label="Formatting"
        inert={tucked}
        className={`absolute box-border flex flex-wrap items-center rounded-bar border border-line bg-surface ${SLIDE} ${
          wide
            ? "right-3.5 bottom-3 left-3.5 min-h-14 px-3"
            : `right-2 bottom-2 left-2 min-h-[52px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] ${twoRows ? "px-2 py-1" : "pr-3 pl-1.5"}`
        } ${tucked ? "pointer-events-none translate-y-[calc(100%+16px)] opacity-0" : "translate-y-0 opacity-100"}`}
      >
        <button
          type="button"
          onClick={() => setTucked(true)}
          aria-label="Hide the tool bar"
          className="absolute -top-[15px] left-1/2 flex h-4 w-11 -translate-x-1/2 cursor-pointer items-center justify-center rounded-t-md border border-b-0 border-line bg-surface p-0 text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronIcon size={12} />
        </button>
        <div ref={tools} className={`flex items-center ${twoRows ? "w-full justify-between" : ""}`}>
          <Tool label="Bold" wide={wide} active={active.bold} onClick={() => run().toggleBold().run()}>
            <span className="font-serif text-[19px] font-semibold">B</span>
          </Tool>
          <Tool label="Italic" wide={wide} active={active.italic} onClick={() => run().toggleItalic().run()}>
            <span className="font-serif text-[19px] italic">I</span>
          </Tool>
          <Tool label="Heading" wide={wide} active={active.heading} onClick={() => run().toggleHeading({ level: 1 }).run()}>
            <span className="text-[16px] font-semibold">H</span>
          </Tool>
          <Tool label="Quote" wide={wide} active={active.quote} onClick={() => run().toggleBlockquote().run()}>
            <QuoteIcon />
          </Tool>
          <Tool label="Scene break" wide={wide} onClick={() => run().setHorizontalRule().run()}>
            <SceneBreakIcon />
          </Tool>
          <Tool label="Indent line" wide={wide} onClick={() => run().indentLines().run()}>
            <IndentIcon />
          </Tool>
        </div>
        {!twoRows && <div className="grow" />}
        <div
          ref={meta}
          className={`flex items-center ${twoRows ? "mt-1 h-10 w-full justify-between border-t border-line px-1.5" : wide ? "gap-4" : "gap-3 pl-2"}`}
        >
          {metaItems.map((item, i) => (
            <Fragment key={item.key}>
              {/* On one line, a thin divider sits between neighbours (never at the ends). */}
              {i > 0 && wide && !twoRows && <div aria-hidden="true" className="h-6 w-px shrink-0 bg-line" />}
              {item.node}
            </Fragment>
          ))}
        </div>
      </div>
      {/* Slid down by the writer: a small tab at the bottom edge brings the bar back. */}
      {tucked && (
        <button
          type="button"
          onClick={() => setTucked(false)}
          aria-label="Show the tool bar"
          className="absolute bottom-0 left-1/2 flex h-7 w-14 -translate-x-1/2 cursor-pointer items-center justify-center rounded-t-lg border border-b-0 border-line bg-surface p-0 text-ink-muted shadow-[0_-2px_10px_rgba(0,0,0,0.05)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronIcon size={14} up />
        </button>
      )}
    </>
  );
}

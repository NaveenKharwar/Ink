import type { PieceLanguage, PieceStyle } from "@ink/schemas";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Dropdown } from "./Dropdown";
import {
  BulletListIcon,
  CheckCircleIcon,
  ChevronIcon,
  IndentIcon,
  KeyboardDownIcon,
  LinkIcon,
  NoteIcon,
  NumberedListIcon,
  PictureIcon,
  QuoteIcon,
  SceneBreakIcon
} from "./icons";
import { LinkField } from "./LinkField";
import { Loader } from "../ui/Loader";
import type { PictureAdder } from "./usePictureAdder";
import type { SaveState } from "./usePieceSave";

export const LANGUAGES: Array<{ value: PieceLanguage; label: string }> = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "hi-Latn", label: "Hinglish" }
];

type Props = {
  editor: Editor;
  style: PieceStyle;
  wide: boolean;
  words: number;
  language: PieceLanguage;
  onLanguage: (language: PieceLanguage) => void;
  save: SaveState;
  /** Phone: how much of the screen the keyboard covers (0 when it's closed). */
  keyboardInset?: number;
  /** Adds pictures to a Notes piece. */
  pictures: PictureAdder;
};

// The same slide as Ink's side sheets (360ms, same curve); with reduced motion it moves at once.
// Room kept between the tools and the words/save group when they share one line.
const GROUP_GAP = 24;

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

// The tool bar: the style's formatting tools, then word count, language (desktop) and save state.
export function Toolbar({ editor, style, wide, words, language, onLanguage, save, keyboardInset = 0, pictures }: Props) {
  // The writer can slide the bar down with the tab on its top edge; it stays down until they
  // tap the tab left at the bottom. Nothing hides it on its own.
  const [tucked, setTucked] = useState(false);
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      quote: e.isActive("blockquote"),
      bullets: e.isActive("bulletList"),
      numbers: e.isActive("orderedList"),
      link: e.isActive("link")
    })
  });
  const run = () => editor.chain().focus();
  const [linking, setLinking] = useState(false);

  // Each writing style has its own tools (see WritingStyles in the design system).
  const bold = { key: "bold", label: "Bold", active: active.bold, onClick: () => run().toggleBold().run(), icon: <span className="font-serif text-[19px] font-semibold">B</span> };
  const italic = { key: "italic", label: "Italic", active: active.italic, onClick: () => run().toggleItalic().run(), icon: <span className="font-serif text-[19px] italic">I</span> };
  const heading = (level: 1 | 2 | 3, label: string, text: string) => ({
    key: `h${level}`,
    label,
    active: active[`h${level}` as const],
    onClick: () => run().toggleHeading({ level }).run(),
    icon: <span className="text-[15px] font-semibold">{text}</span>
  });
  const quote = { key: "quote", label: "Quote", active: active.quote, onClick: () => run().toggleBlockquote().run(), icon: <QuoteIcon /> };
  const scene = { key: "scene", label: "Scene break", active: false, onClick: () => run().setHorizontalRule().run(), icon: <SceneBreakIcon /> };
  const indent = { key: "indent", label: "Indent line", active: false, onClick: () => run().indentLines().run(), icon: <IndentIcon /> };
  type ToolDef = { key: string; label: string; active: boolean; onClick: () => void; icon: ReactNode };
  const toolsFor: Record<PieceStyle, ToolDef[]> = {
    poem: [bold, italic, quote, scene, indent],
    story: [bold, italic, heading(1, "Chapter heading", "H"), quote, scene],
    notes: [
      heading(1, "Heading 1", "H1"),
      heading(2, "Heading 2", "H2"),
      heading(3, "Heading 3", "H3"),
      bold,
      italic,
      { key: "bullets", label: "Bullet list", active: active.bullets, onClick: () => run().toggleBulletList().run(), icon: <BulletListIcon /> },
      { key: "numbers", label: "Numbered list", active: active.numbers, onClick: () => run().toggleOrderedList().run(), icon: <NumberedListIcon /> },
      { key: "link", label: "Link", active: active.link || linking, onClick: () => setLinking(!linking), icon: <LinkIcon /> },
      {
        key: "picture",
        label: "Picture",
        active: false,
        onClick: () => !pictures.busy && void pictures.choose(),
        icon: pictures.busy ? <Loader size={14} label="Adding the picture" /> : <PictureIcon />
      },
      quote,
      scene
    ]
  };

  // Desktop: when the tools and the words/save group don't fit on one line (Notes on a narrow paper), the bar
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
      // Natural widths: the buttons and texts themselves (spreading them doesn't change these).
      const widthOf = (group: HTMLElement) => [...group.children].reduce((w, c) => w + (c as HTMLElement).offsetWidth, 0);
      const style = getComputedStyle(el);
      const room = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setTwoRows(widthOf(tools.current) + widthOf(meta.current) + GROUP_GAP > room);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [words, save, wide, style]);

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
          {wide || save === "refused" ? <span>{SAVE_SHORT[save]}</span> : <span className="sr-only">{SAVE_SHORT[save]}</span>}
        </span>
      )
    });
  }

  // A message about a picture that couldn't be added: beside the tool bar, gone after a moment.
  const pictureNotice = pictures.notice && (
    <p
      role="status"
      className={`absolute z-10 m-0 flex max-w-[360px] items-center gap-2 rounded-md border border-line-strong bg-surface px-3 py-2 font-sans text-[13px] leading-5 text-ink shadow-[0_4px_16px_rgba(0,0,0,0.10)] ${
        wide ? "bottom-[calc(100%+8px)] left-3" : "top-[calc(100%+8px)] left-2"
      }`}
    >
      <NoteIcon size={16} />
      {pictures.notice}
    </p>
  );

  const scrollRow =
    "overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-20px),transparent)] [&::-webkit-scrollbar]:hidden";
  const toolButtons = toolsFor[style].map((t) => (
    <Tool key={t.key} label={t.label} wide={wide} active={t.active} onClick={t.onClick}>
      {t.icon}
    </Tool>
  ));

  // Phone: one row right under the top bar, always in the same place, so the keyboard never
  // covers it. The tools scroll sideways; at the end, word count and save state, or, while the
  // keyboard is up, a button to put it away (phone browsers have no key for that).
  if (!wide) {
    const typing = keyboardInset > 0;
    return (
      <div role="toolbar" aria-label="Formatting" className="relative flex h-12 shrink-0 items-center border-b border-line bg-surface pr-2 pl-1">
        <div className={`flex min-w-0 flex-1 items-center ${scrollRow}`}>{toolButtons}</div>
        <div aria-hidden="true" className="mx-1.5 h-6 w-px shrink-0 bg-line" />
        {typing ? (
          <Tool label="Hide keyboard" wide={false} onClick={() => editor.commands.blur()}>
            <KeyboardDownIcon />
          </Tool>
        ) : (
          <div className="flex shrink-0 items-center gap-2.5 text-[13px]">
            {metaItems.map((item) => (
              <Fragment key={item.key}>{item.node}</Fragment>
            ))}
          </div>
        )}
        {linking && style === "notes" && (
          <LinkField editor={editor} className="absolute top-[calc(100%+8px)] right-2 left-2 max-w-[360px]" onDone={() => setLinking(false)} />
        )}
        {pictureNotice}
      </div>
    );
  }

  // Desktop: the floating bar at the bottom of the paper.
  return (
    <>
      <div
        ref={bar}
        role="toolbar"
        aria-label="Formatting"
        inert={tucked}
        className={`absolute bottom-3 box-border flex min-h-14 flex-wrap items-center rounded-bar border border-line bg-surface px-3 ${SLIDE} ${
          wide ? "right-[calc(var(--scrollbar-w)+16px)] left-[calc(var(--scrollbar-w)+16px)]" : "right-3.5 left-3.5"
        } ${
          tucked ? "pointer-events-none translate-y-[calc(100%+16px)] opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={() => setTucked(true)}
          aria-label="Hide the tool bar"
          className="absolute -top-[15px] left-1/2 flex h-4 w-11 -translate-x-1/2 cursor-pointer items-center justify-center rounded-t-md border border-b-0 border-line bg-surface p-0 text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronIcon size={12} />
        </button>
        {/* In two rows (Notes' many tools on a narrow paper) the tools spread across the top and
            scroll sideways if even that is too narrow. */}
        <div ref={tools} className={`flex items-center ${twoRows ? `w-full justify-between ${scrollRow}` : ""}`}>
          {toolButtons}
        </div>
        {linking && style === "notes" && <LinkField editor={editor} onDone={() => setLinking(false)} />}
        {pictureNotice}
        {!twoRows && <div className="grow" />}
        <div ref={meta} className={`flex items-center ${twoRows ? "mt-1 h-10 w-full justify-between border-t border-line px-1.5" : "gap-4"}`}>
          {metaItems.map((item, i) => (
            <Fragment key={item.key}>
              {/* On one line, a thin divider sits between neighbours (never at the ends). */}
              {i > 0 && !twoRows && <div aria-hidden="true" className="h-6 w-px shrink-0 bg-line" />}
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

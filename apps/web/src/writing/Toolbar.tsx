import type { PieceLanguage } from "@ink/schemas";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import type { ReactNode } from "react";
import { CheckCircleIcon, IndentIcon, QuoteIcon, SceneBreakIcon } from "./icons";
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

// The one floating tool bar: a little formatting, then word count, language and save state.
export function Toolbar({ editor, wide, words, language, onLanguage, save }: Props) {
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

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className={`absolute box-border flex items-center rounded-bar border border-line bg-surface ${
        wide ? "right-3.5 bottom-3 left-3.5 h-14 pr-3.5 pl-3" : "right-2 bottom-2 left-2 h-[52px] pr-3 pl-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
      }`}
    >
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
      <div className="grow" />
      <span className={`whitespace-nowrap text-ink-muted ${wide ? "px-5" : "px-2"}`}>
        {words} {words === 1 ? "word" : "words"}
      </span>
      {wide && (
        <>
          <div className="h-6 w-px bg-line" />
          <label htmlFor="piece-language" className="sr-only">
            Language
          </label>
          <select
            id="piece-language"
            value={language}
            onChange={(e) => onLanguage(e.target.value as PieceLanguage)}
            className="h-9 cursor-pointer rounded-md border-0 bg-transparent px-4 font-sans text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <div className="h-6 w-px bg-line" />
        </>
      )}
      {save !== "idle" && (
        <span className={`flex items-center gap-2.5 whitespace-nowrap ${wide ? "pl-5" : "pl-2"}`}>
          <CheckCircleIcon saving={save === "saving"} />
          {wide && <span>{save === "saving" ? "Saving" : "Saved"}</span>}
          {!wide && <span className="sr-only">{save === "saving" ? "Saving" : "Saved"}</span>}
        </span>
      )}
    </div>
  );
}

import { docToPlainText, META_FIELD, type EditorDoc } from "@ink/schemas";
import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useState } from "react";
import * as Y from "yjs";
import { countWords } from "../editor/counts";
import { writingExtensions } from "../editor/extensions";
import type { OpenedPiece } from "../lib/openPiece";
import { pieceAddress } from "../lib/route";
import { Toolbar } from "./Toolbar";
import { TopBar } from "./TopBar";
import { usePieceMeta } from "./usePieceMeta";
import { usePieceSave } from "./usePieceSave";

type Props = {
  pieceId: string;
  userId: string;
  /** A piece that already exists (loaded before this page is shown); none for a new piece. */
  opened: OpenedPiece | null;
  wide: boolean;
  /** Where the piece lives: "Now", "Summer", "Monsoon 2025". */
  season: string;
  showMenuButton: boolean;
  showSparkle: boolean;
  onSparkle: () => void;
  onMenu: () => void;
};

// The page panel: where the piece lives, the writing itself, and the tool bar.
export function Page({ pieceId, userId, opened, wide, season, showMenuButton, showSparkle, onSparkle, onMenu }: Props) {
  // The piece is a Yjs document: it merges with what other devices write.
  // Loaded before the editor exists, so the editor starts from the piece and adds nothing on top.
  const [ydoc] = useState(() => {
    const doc = new Y.Doc();
    if (opened) Y.applyUpdate(doc, opened.state);
    // A new piece starts in English until the writer says otherwise.
    else doc.getMap(META_FIELD).set("language", "en");
    return doc;
  });
  // A new piece gets its address when it first has words; reloading then opens it.
  const onStart = useCallback(() => window.history.replaceState(null, "", pieceAddress(pieceId)), [pieceId]);
  const save = usePieceSave(pieceId, userId, ydoc, { initial: opened ?? undefined, onStart });
  const [words, setWords] = useState(0);
  const { title, language, setTitle, setLanguage } = usePieceMeta(ydoc);
  const [firstLine, setFirstLine] = useState("");

  const refresh = (doc: EditorDoc) => {
    const text = docToPlainText(doc);
    setWords(countWords(text));
    setFirstLine(openingLine(text));
  };

  const editor = useEditor({
    extensions: [...writingExtensions, Collaboration.configure({ document: ydoc })],
    autofocus: "end",
    editorProps: { attributes: { "aria-label": "Your writing", spellcheck: "false" } },
    onCreate: ({ editor: e }) => refresh(e.getJSON() as EditorDoc),
    onUpdate: ({ editor: e }) => refresh(e.getJSON() as EditorDoc)
  });

  return (
    <>
      <TopBar
        wide={wide}
        season={season}
        title={title}
        firstLine={firstLine}
        onRename={setTitle}
        language={language}
        onLanguage={setLanguage}
        save={save.state}
        showSparkle={showSparkle}
        onSparkle={onSparkle}
        showMenuButton={showMenuButton}
        onMenu={onMenu}
      />
      <div className={`ink-editor grow overflow-y-auto ${wide ? "pt-9 pr-10 pb-[110px] pl-[72px]" : "pt-5 pr-5 pb-[140px] pl-[33px]"}`}>
        <div className="mx-auto max-w-[640px]">
          <EditorContent editor={editor} />
        </div>
      </div>
      <Toolbar
        editor={editor}
        wide={wide}
        words={words}
        language={language}
        onLanguage={setLanguage}
        save={save.state}
      />
    </>
  );
}

// The first line with words in it, used as the piece's name until the writer gives one.
function openingLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim() && l.trim() !== "* * *") ?? "";
  return line.trim().slice(0, 80);
}

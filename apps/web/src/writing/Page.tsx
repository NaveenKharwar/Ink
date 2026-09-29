import { docToPlainText, type EditorDoc, type PieceLanguage } from "@ink/schemas";
import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent, useEditor } from "@tiptap/react";
import { useState } from "react";
import * as Y from "yjs";
import { countWords } from "../editor/counts";
import { writingExtensions } from "../editor/extensions";
import { Toolbar } from "./Toolbar";
import { TopBar } from "./TopBar";
import { usePieceSave } from "./usePieceSave";

type Props = {
  pieceId: string;
  userId: string;
  wide: boolean;
  showSparkle: boolean;
  onSparkle: () => void;
  onMenu: () => void;
};

// The page panel: where the piece lives, the writing itself, and the tool bar.
export function Page({ pieceId, userId, wide, showSparkle, onSparkle, onMenu }: Props) {
  // The piece is a Yjs document: it merges with what other devices write.
  const [ydoc] = useState(() => new Y.Doc());
  const save = usePieceSave(pieceId, userId, ydoc);
  const [words, setWords] = useState(0);
  const [language, setLanguage] = useState<PieceLanguage>("en");
  const [title, setTitle] = useState<string | null>(null);
  const [firstLine, setFirstLine] = useState("");

  const editor = useEditor({
    extensions: [...writingExtensions, Collaboration.configure({ document: ydoc })],
    autofocus: "end",
    editorProps: { attributes: { "aria-label": "Your writing", spellcheck: "false" } },
    onUpdate: ({ editor: e }) => {
      const doc = e.getJSON() as EditorDoc;
      const text = docToPlainText(doc);
      setWords(countWords(text));
      setFirstLine(openingLine(text));
    }
  });

  return (
    <>
      <TopBar
        wide={wide}
        season="Now"
        title={title}
        firstLine={firstLine}
        onRename={(next) => {
          setTitle(next);
          save.changeTitle(next);
        }}
        save={save.state}
        showSparkle={showSparkle}
        onSparkle={onSparkle}
        onMenu={onMenu}
      />
      <div className={`ink-editor grow overflow-y-auto ${wide ? "pt-9 pr-10 pb-[110px] pl-[72px]" : "pt-5 pr-5 pb-[90px] pl-[33px]"}`}>
        <div className="max-w-[640px]">
          <EditorContent editor={editor} />
        </div>
      </div>
      <Toolbar
        editor={editor}
        wide={wide}
        words={words}
        language={language}
        onLanguage={(next) => {
          setLanguage(next);
          save.changeLanguage(next);
        }}
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

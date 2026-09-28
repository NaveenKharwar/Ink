import { docToPlainText, type EditorDoc, type PieceLanguage } from "@ink/schemas";
import { EditorContent, useEditor } from "@tiptap/react";
import { useState } from "react";
import { countWords } from "../editor/counts";
import { writingExtensions } from "../editor/extensions";
import { Toolbar } from "./Toolbar";
import { TopBar } from "./TopBar";
import { usePieceSave } from "./usePieceSave";

type Props = {
  pieceId: string;
  wide: boolean;
  showSparkle: boolean;
  onSparkle: () => void;
  onMenu: () => void;
};

// The page panel: where the piece lives, the writing itself, and the tool bar.
export function Page({ pieceId, wide, showSparkle, onSparkle, onMenu }: Props) {
  const save = usePieceSave(pieceId);
  const [words, setWords] = useState(0);
  const [language, setLanguage] = useState<PieceLanguage>("en");

  const editor = useEditor({
    extensions: writingExtensions,
    autofocus: "end",
    editorProps: { attributes: { "aria-label": "Your writing", spellcheck: "false" } },
    onUpdate: ({ editor: e }) => {
      const doc = e.getJSON() as EditorDoc;
      setWords(countWords(docToPlainText(doc)));
      save.changeDoc(doc);
    }
  });

  return (
    <>
      <TopBar
        wide={wide}
        season="Now"
        title={null}
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

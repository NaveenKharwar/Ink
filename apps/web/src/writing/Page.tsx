import { docToPlainText, META_FIELD, type EditorDoc, type PieceStyle } from "@ink/schemas";
import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { countWords } from "../editor/counts";
import { setEditorStyle, writingExtensions } from "../editor/extensions";
import { Picture } from "../editor/picture";
import { useVisibleArea } from "../lib/visibleArea";
import { Cover } from "./Cover";
import { LinkCard } from "./LinkCard";
import { PicturePicker } from "./PicturePicker";
import { PictureView } from "./PictureView";
import { StyleCards } from "./StyleCards";
import type { OpenedPiece } from "../lib/openPiece";
import { pieceAddress } from "../lib/route";
import { Toolbar } from "./Toolbar";
import { TopBar } from "./TopBar";
import { usePictureAdder } from "./usePictureAdder";
import { usePieceMeta } from "./usePieceMeta";
import { usePieceSave } from "./usePieceSave";
import { FadeScroll } from "../ui/FadeScroll";
import { FinishedPrompt } from "./FinishedPrompt";
import { useFinishedPrompt } from "./useFinishedPrompt";

type Props = {
  pieceId: string;
  userId: string;
  /** A piece that already exists (loaded before this page is shown); none for a new piece. */
  opened: OpenedPiece | null;
  wide: boolean;
  /** Where the piece lives: "Now", "Summer", "Monsoon 2025". */
  season: string;
  showMenuButton: boolean;
  panelOpen: boolean;
  onPanelToggle: () => void;
  onMenu: () => void;
};

const EDITOR_ATTRIBUTES = { "aria-label": "Your writing", spellcheck: "false" };

// The page panel: where the piece lives, the writing itself, and the tool bar.
export function Page({ pieceId, userId, opened, wide, season, showMenuButton, panelOpen, onPanelToggle, onMenu }: Props) {
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
  const [empty, setEmpty] = useState(true);
  const finishing = useFinishedPrompt(pieceId, ydoc, { finished: opened?.finished ?? false, words, save: save.state });
  const { title, language, style: chosen, cover, setTitle, setLanguage, setStyle, setCover } = usePieceMeta(ydoc);
  // A piece nobody has given a style reads as a poem.
  const style: PieceStyle = chosen ?? "poem";
  const [firstLine, setFirstLine] = useState("");

  // Typing on the blank page without picking a style makes the piece a poem. (An older piece
  // with words but no style just reads as one; opening it writes nothing.)
  const chosenRef = useRef(chosen);
  useEffect(() => {
    chosenRef.current = chosen;
  }, [chosen]);
  const wasEmpty = useRef(false);
  const refresh = (doc: EditorDoc, typed: boolean) => {
    const text = docToPlainText(doc);
    const hasWords = Boolean(text.trim());
    setWords(countWords(text));
    setFirstLine(openingLine(text));
    setEmpty(!hasWords);
    if (typed && hasWords && wasEmpty.current && !chosenRef.current) setStyle("poem");
    wasEmpty.current = !hasWords;
  };

  // Pictures pasted or dropped into a Notes piece go to the picture adder (made after the editor).
  const onPictureFiles = useRef<(files: File[]) => void>(() => {});
  const editor = useEditor({
    extensions: [
      ...writingExtensions.map((extension) =>
        extension === Picture
          ? Picture.configure({ view: ReactNodeViewRenderer(PictureView), onFiles: (files) => onPictureFiles.current(files) })
          : extension
      ),
      Collaboration.configure({ document: ydoc })
    ],
    autofocus: "end",
    editorProps: { attributes: EDITOR_ATTRIBUTES },
    onCreate: ({ editor: e }) => refresh(e.getJSON() as EditorDoc, false),
    onUpdate: ({ editor: e }) => refresh(e.getJSON() as EditorDoc, true)
  });

  const pictures = usePictureAdder(editor);
  useEffect(() => {
    onPictureFiles.current = (files) => void pictures.addFiles(files);
  }, [pictures]);

  // The editor's keys and input rules follow the style, including a change from another device.
  useEffect(() => {
    setEditorStyle(editor, style);
  }, [editor, style]);

  // The writer picks or switches a style. Only the look, the keys and the tool bar change: what
  // is written stays exactly as it is (a list in a poem is still a list), so switching back
  // loses nothing.
  const changeStyle = (next: PieceStyle) => {
    setEditorStyle(editor, next);
    setStyle(next);
    editor.commands.focus();
  };
  const showCards = chosen === null && empty;

  // Phone keyboard: the app screen shrinks to the part still showing (see WritingScreen), so the
  // writing ends where the keyboard begins; bring the cursor back into view when it opens.
  const keyboard = useVisibleArea(!wide)?.keyboard ?? 0;
  useEffect(() => {
    if (keyboard && editor.isFocused) editor.commands.scrollIntoView();
  }, [editor, keyboard]);

  // The tool bar: under the top bar on phones (clear of the keyboard), floating at the bottom of
  // the paper on desktop.
  const toolbar = (
    <Toolbar
      editor={editor}
      style={style}
      wide={wide}
      keyboardInset={keyboard}
      words={words}
      language={language}
      onLanguage={setLanguage}
      save={save.state}
      pictures={pictures}
    />
  );

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
        style={showCards ? null : style}
        onStyle={changeStyle}
        save={save.state}
        panelOpen={panelOpen}
        onPanelToggle={onPanelToggle}
        showMenuButton={showMenuButton}
        onMenu={onMenu}
      />
      {!wide && toolbar}
      <FadeScroll scrollbar="visible" className={`ink-editor style-${style} ${showCards ? "is-blank" : ""} grow ${wide ? "pb-[110px]" : "pb-12"}`}>
        {/* The cover sits across the whole paper, above the writing, and scrolls away with it. */}
        <Cover cover={cover} onCover={setCover} wide={wide} />
        <div className={`px-[var(--page-gutter)] ${cover ? "pt-3 wide:pt-3" : "pt-3 wide:pt-4"}`}>
          <div className="mx-auto max-w-[640px]">
            <EditorContent editor={editor} />
            <LinkCard editor={editor} />
            <FinishedPrompt spot={finishing.spot} failed={finishing.failed} onToggle={finishing.toggle} />
            <StyleCards shown={showCards} wide={wide} onPick={changeStyle} />
          </div>
        </div>
      </FadeScroll>
      {wide && toolbar}
      {pictures.picking && (
        <PicturePicker wide={wide} purpose="notes" onClose={pictures.closePicker} onPick={(id) => pictures.insert(id)} />
      )}
    </>
  );
}

// The first line with words in it, used as the piece's name until the writer gives one.
function openingLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim() && l.trim() !== "* * *") ?? "";
  return line.trim().slice(0, 80);
}

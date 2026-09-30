import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useState } from "react";
import { addPicture, PictureError, PICTURE_MESSAGES } from "../lib/pictures";

// How long a message about a picture stays before it fades on its own.
const NOTICE_MS = 6000;

/**
 * Adds pictures into a Notes piece: from the tool bar's picture button (the picker: upload, or
 * one of your pictures), or pasted and dropped.
 * A picture goes into the text once it is stored, so the writer's other devices can always
 * load it; meanwhile the picture button shows the loader.
 */
export function usePictureAdder(editor: Editor) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  const addFiles = useCallback(
    async (files: File[]) => {
      setNotice(null);
      setBusy(true);
      try {
        for (const file of files) {
          const added = await addPicture(file);
          await added.uploaded;
          editor.chain().focus().insertContent({ type: "picture", attrs: { id: added.id } }).run();
        }
      } catch (err) {
        setNotice(err instanceof PictureError ? err.message : PICTURE_MESSAGES.failed);
      } finally {
        setBusy(false);
      }
    },
    [editor]
  );

  const [picking, setPicking] = useState(false);
  const choose = useCallback(() => setPicking(true), []);
  const closePicker = useCallback(() => setPicking(false), []);
  const insert = useCallback(
    (id: string) => {
      setPicking(false);
      editor.chain().focus().insertContent({ type: "picture", attrs: { id } }).run();
    },
    [editor]
  );

  return { busy, notice, addFiles, choose, picking, closePicker, insert };
}

export type PictureAdder = ReturnType<typeof usePictureAdder>;

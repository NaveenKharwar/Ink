import type { PieceLanguage } from "@ink/schemas";
import { META_FIELD, pieceLanguage } from "@ink/schemas";
import { useCallback, useEffect, useState } from "react";
import type * as Y from "yjs";

export type PieceSettings = { title: string | null; language: PieceLanguage };

const read = (meta: Y.Map<unknown>): PieceSettings => {
  const title = meta.get("title");
  const language = pieceLanguage.safeParse(meta.get("language"));
  return { title: typeof title === "string" && title ? title : null, language: language.success ? language.data : "en" };
};

/**
 * A piece's settings (title, language) live in its Yjs document, next to the words. They
 * are saved, kept offline and merged across devices with everything else, and a change
 * made on another device shows up here.
 */
export function usePieceMeta(ydoc: Y.Doc) {
  const meta = ydoc.getMap<unknown>(META_FIELD);
  const [settings, setSettings] = useState(() => read(meta));

  useEffect(() => {
    const onChange = () => setSettings(read(meta));
    meta.observe(onChange);
    return () => meta.unobserve(onChange);
  }, [meta]);

  const setTitle = useCallback(
    (title: string | null) => (title ? meta.set("title", title) : meta.delete("title")),
    [meta]
  );
  const setLanguage = useCallback((language: PieceLanguage) => meta.set("language", language), [meta]);

  return { ...settings, setTitle, setLanguage };
}

import type { PieceCover, PieceLanguage, PieceStyle } from "@ink/schemas";
import { META_FIELD, pieceCover, pieceLanguage, pieceStyle } from "@ink/schemas";
import { useCallback, useEffect, useState } from "react";
import type * as Y from "yjs";

/** `style` is null until the writer picks one (or starts typing); such a piece reads as a poem. */
export type PieceSettings = {
  title: string | null;
  language: PieceLanguage;
  style: PieceStyle | null;
  cover: PieceCover | null;
};

const read = (meta: Y.Map<unknown>): PieceSettings => {
  const title = meta.get("title");
  const language = pieceLanguage.safeParse(meta.get("language"));
  const style = pieceStyle.safeParse(meta.get("style"));
  const cover = pieceCover.safeParse(meta.get("cover"));
  return {
    title: typeof title === "string" && title ? title : null,
    language: language.success ? language.data : "en",
    style: style.success ? style.data : null,
    cover: cover.success ? cover.data : null
  };
};

/**
 * A piece's settings (title, language, writing style, cover) live in its Yjs document, next to the words. They
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
  const setStyle = useCallback((style: PieceStyle) => meta.set("style", style), [meta]);
  const setCover = useCallback(
    (cover: PieceCover | null) => (cover ? meta.set("cover", cover) : meta.delete("cover")),
    [meta]
  );

  return { ...settings, setTitle, setLanguage, setStyle, setCover };
}

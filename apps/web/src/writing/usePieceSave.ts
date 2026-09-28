import type { EditorDoc, EditorNode, PieceLanguage } from "@ink/schemas";
import { useCallback, useEffect, useRef, useState } from "react";
import { pieces } from "../lib/api";

// "idle" until there is something to save.
export type SaveState = "idle" | "saving" | "saved";

const QUIET_MS = 900;
const RETRY_MS = 4000;

const hasContent = (nodes: EditorNode[] = []): boolean =>
  nodes.some((n) => (n.type === "text" && !!n.text) || n.type === "horizontalRule" || hasContent(n.content));

/**
 * Saves a piece to the API 900ms after the last change. The piece is created on its
 * first save with a client-made id, so a retried create cannot make a duplicate.
 * (The local IndexedDB buffer comes with autosave; this is the direct path.)
 */
export function usePieceSave(pieceId: string) {
  const [state, setState] = useState<SaveState>("idle");
  const latest = useRef<{ doc: EditorDoc | null; language: PieceLanguage }>({ doc: null, language: "en" });
  const created = useRef(false);
  const inFlight = useRef(false);
  // Changes not yet sent.
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const { doc, language } = latest.current;
    if (!doc || !pending.current || inFlight.current) return;
    if (!created.current && !hasContent(doc.content)) {
      pending.current = false;
      setState("idle");
      return;
    }
    inFlight.current = true;
    pending.current = false;
    try {
      if (created.current) await pieces.update(pieceId, { content: doc, language });
      else await pieces.create({ id: pieceId, content: doc, language });
      created.current = true;
      inFlight.current = false;
      // Changes typed while the request was out go in the next one.
      if (pending.current) void flush();
      else setState("saved");
    } catch {
      inFlight.current = false;
      pending.current = true;
      timer.current = setTimeout(() => void flush(), RETRY_MS);
    }
  }, [pieceId]);

  const schedule = useCallback(() => {
    pending.current = true;
    setState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), QUIET_MS);
  }, [flush]);

  const changeDoc = useCallback(
    (doc: EditorDoc) => {
      latest.current.doc = doc;
      schedule();
    },
    [schedule]
  );

  const changeLanguage = useCallback(
    (language: PieceLanguage) => {
      latest.current.language = language;
      if (latest.current.doc) schedule();
    },
    [schedule]
  );

  // Save straight away when the tab is hidden or the piece is left.
  useEffect(() => {
    const onHide = () => document.hidden && void flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush]);

  return { state, changeDoc, changeLanguage };
}

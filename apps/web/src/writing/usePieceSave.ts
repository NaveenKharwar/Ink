import { ydocToEditorDoc, type EditorNode, type PieceLanguage } from "@ink/schemas";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { bufferKey } from "../lib/buffer";
import { buffer, sync } from "../lib/localSave";

// "idle" until there is something to save. "device" = safe on this device, not on the server yet.
export type SaveState = "idle" | "saving" | "saved" | "device";

// Marks changes that came from the server, so they are not sent back as new writing.
export const REMOTE = "remote";

const QUIET_MS = 900;
const RETRY_MS = 4000;
const RETRY_MAX_MS = 60000;

const hasContent = (nodes: EditorNode[] = []): boolean =>
  nodes.some((n) => (n.type === "text" && !!n.text) || n.type === "horizontalRule" || hasContent(n.content));

/**
 * Every change is written to this device straight away (IndexedDB), then sent to the
 * API 900ms after the last change. If the send fails or the writer is offline, the
 * writing stays on the device and goes up later: by retry, when the browser is back
 * online, or on the next visit.
 *
 * The piece is a Yjs document, so what another device wrote comes back with every send
 * and is merged into the open page; neither device overwrites the other.
 */
export type SaveOptions = {
  /** A piece that already exists: its meta and what the server is known to have. */
  initial?: { serverVector: Uint8Array | null; language: PieceLanguage; title: string | null };
  /** Called once, when the piece first has something worth saving. */
  onStart?: () => void;
};

export function usePieceSave(pieceId: string, userId: string, ydoc: Y.Doc, { initial, onStart }: SaveOptions = {}) {
  const key = bufferKey(userId, pieceId);
  const [state, setState] = useState<SaveState>("idle");
  const meta = useRef<{ language: PieceLanguage; title: string | null }>({
    language: initial?.language ?? "en",
    title: initial?.title ?? null
  });
  // An opened piece is already worth saving; a new one is not until it has words.
  const started = useRef(!!initial);
  const stamp = useRef(0);
  // What the server is known to have, so a send only carries what is newer.
  const serverVector = useRef<Uint8Array | null>(initial?.serverVector ?? null);
  // Buffer writes are coalesced: while one is running, changes just mark it to run again.
  const writing = useRef<Promise<void> | null>(null);
  const dirty = useRef(false);
  // Counts changes; a send that finishes after a newer change must not claim "Saved".
  const version = useRef(0);
  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const persist = useCallback(() => {
    dirty.current = true;
    if (writing.current) return;
    writing.current = (async () => {
      try {
        while (dirty.current) {
          dirty.current = false;
          stamp.current = Math.max(stamp.current + 1, Date.now());
          await buffer.put({
            key,
            userId,
            id: pieceId,
            state: Y.encodeStateAsUpdate(ydoc),
            serverVector: serverVector.current,
            language: meta.current.language,
            title: meta.current.title,
            updatedAt: stamp.current
          });
        }
      } catch {
        // The device would not take it (private mode, full disk); the send below still tries.
      } finally {
        writing.current = null;
      }
    })();
  }, [key, userId, pieceId, ydoc]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!started.current) return;
    const sentVersion = version.current;
    while (writing.current) await writing.current;
    if (!navigator.onLine) {
      setState("device");
      return;
    }
    const result = await sync.syncPiece(key);
    if (result.status === "failed") {
      failures.current++;
      setState("device");
      timer.current = setTimeout(() => void flush(), Math.min(RETRY_MS * 2 ** (failures.current - 1), RETRY_MAX_MS));
      return;
    }
    failures.current = 0;
    // Nothing was waiting (already sent elsewhere): only claim "Saved" if something was written here.
    if (result.status === "gone" && version.current === 0) return;
    if (result.serverVector) serverVector.current = result.serverVector;
    // What another device wrote lands in the open page.
    if (result.remote) Y.applyUpdate(ydoc, result.remote, REMOTE);
    if (version.current === sentVersion) setState("saved");
  }, [key, ydoc]);

  const schedule = useCallback(() => {
    // An empty new piece is not saved anywhere.
    if (!started.current && !hasContent(ydocToEditorDoc(ydoc).content)) return;
    if (!started.current) {
      started.current = true;
      onStart?.();
    }
    version.current++;
    setState("saving");
    persist();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), QUIET_MS);
  }, [ydoc, persist, flush, onStart]);

  const changeLanguage = useCallback(
    (language: PieceLanguage) => {
      meta.current.language = language;
      schedule();
    },
    [schedule]
  );

  const changeTitle = useCallback(
    (title: string | null) => {
      meta.current.title = title;
      schedule();
    },
    [schedule]
  );

  // Writing in the page (anything that is not from the server) is saved.
  useEffect(() => {
    const onChange = (_update: Uint8Array, origin: unknown) => {
      if (origin !== REMOTE) schedule();
    };
    ydoc.on("update", onChange);
    return () => ydoc.off("update", onChange);
  }, [ydoc, schedule]);

  // Send straight away when the tab is hidden, the piece is left, or the connection returns.
  useEffect(() => {
    const onHide = () => document.hidden && void flush();
    const onOnline = () => void flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("online", onOnline);
      void flush();
    };
  }, [flush]);

  return { state, changeLanguage, changeTitle };
}

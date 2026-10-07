import type { RelatedNote, RelatedResponse } from "@ink/schemas";
import { useCallback, useEffect, useRef, useState } from "react";
import { pieces } from "../lib/api";
import { onSaved } from "../lib/savedEvents";

const EMPTY: RelatedResponse = { related: [], forgotten: [], loose: [], looked: false, keptOut: false };
// The panel looks again this long after the writer's last save, so it never shifts while they type.
const AFTER_SAVE_MS = 8000;
// Once more after the server has had time to make the piece's vector (it waits for 30 s of quiet),
// so a new piece stops showing shared-word matches without another save.
const AFTER_VECTOR_MS = 50000;

export type Related = RelatedResponse & {
  /** False until the first answer arrives (or when there is no saved piece yet). */
  ready: boolean;
  /** Asked, and no answer yet: the panel shows the loader instead of an empty page. */
  loading: boolean;
  /** The last look failed and nothing is shown yet (the server could not be reached). */
  failed: boolean;
  /** The server has answered for this piece, so it is on the server and the panel can offer to keep it out. */
  known: boolean;
  /** Looks again now. */
  retry: () => void;
};

/**
 * What "Ink sees this too" shows beside a piece. Looks when the piece opens and a few seconds
 * after each save. A piece that is not on the server yet (`exists` is false) is not asked about
 * until its first save.
 */
export function useRelated(pieceId: string | null, exists: boolean): Related {
  const [data, setData] = useState<RelatedResponse>(EMPTY);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [known, setKnown] = useState(false);
  const [tick, setTick] = useState(0);
  const [saved, setSaved] = useState(false);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    setData(EMPTY);
    setReady(false);
    setFailed(false);
    setKnown(false);
    setSaved(false);
  }, [pieceId]);

  useEffect(() => {
    if (!pieceId || !(exists || saved)) return;
    const controller = new AbortController();
    pieces.related(pieceId, controller.signal).then(
      (res) => {
        if (controller.signal.aborted) return;
        setData(res);
        setFailed(false);
        setKnown(true);
        setReady(true);
      },
      (err: { status?: number; name?: string }) => {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        // 404: a new piece the server has not seen yet. Anything else: keep what is shown.
        if (err?.status === 404) {
          setData(EMPTY);
          setFailed(false);
        } else setFailed(true);
        setReady(true);
      }
    );
    return () => controller.abort();
  }, [pieceId, exists, saved, tick]);

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const laterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!pieceId) return;
    const stop = onSaved(pieceId, () => {
      setSaved(true);
      clearTimeout(timer.current);
      clearTimeout(laterTimer.current);
      timer.current = setTimeout(refresh, AFTER_SAVE_MS);
      laterTimer.current = setTimeout(refresh, AFTER_VECTOR_MS);
    });
    return () => {
      stop();
      clearTimeout(timer.current);
      clearTimeout(laterTimer.current);
    };
  }, [pieceId, refresh]);

  const asked = !!pieceId && (exists || saved);
  const nothingShown = data.related.length + data.forgotten.length + data.loose.length === 0;
  return { ...data, ready, known, loading: asked && !ready, failed: failed && nothingShown, retry: refresh };
}

export type Dismissal = "undo" | "gone";

/**
 * "Not related": a note goes at once, with a few seconds to undo it; after that it is gone for
 * good (the server already knows). If the server refuses, the note simply comes back.
 */
export function useDismissals(pieceId: string | null, undoMs = 5000) {
  const [state, setState] = useState<Record<string, Dismissal>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // The request that hides a note, so an Undo pressed at once is sent after it, never before.
  const sending = useRef(new Map<string, Promise<unknown>>());

  useEffect(() => {
    setState({});
    const held = timers.current;
    return () => {
      for (const timer of held.values()) clearTimeout(timer);
      held.clear();
    };
  }, [pieceId]);

  const forget = (id: string) =>
    setState((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });

  const dismiss = (note: Pick<RelatedNote, "id">) => {
    if (!pieceId) return;
    const id = note.id;
    setState((s) => ({ ...s, [id]: "undo" }));
    const request = pieces.dismiss(pieceId, id).catch(() => {
      clearTimeout(timers.current.get(id));
      forget(id);
    });
    sending.current.set(id, request);
    clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(() => setState((s) => (s[id] === "undo" ? { ...s, [id]: "gone" } : s)), undoMs)
    );
  };

  const restore = (note: Pick<RelatedNote, "id">) => {
    if (!pieceId) return;
    clearTimeout(timers.current.get(note.id));
    forget(note.id);
    // If the server cannot undo it, the note is back for now and hides again next time.
    void (sending.current.get(note.id) ?? Promise.resolve()).then(() => pieces.restore(pieceId, note.id)).catch(() => undefined);
  };

  return { state, dismiss, restore };
}

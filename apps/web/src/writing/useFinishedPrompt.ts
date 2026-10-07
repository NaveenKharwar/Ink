import { useCallback, useEffect, useState } from "react";
import type * as Y from "yjs";
import { pieces } from "../lib/api";
import { spotFor } from "../lib/finishedPrompt";
import { REMOTE, type SaveState } from "./usePieceSave";

/**
 * The quiet "Mark finished" under the last line: it is the only way a piece becomes finished.
 * Writing in a finished piece quietly makes it a draft again (the server does that on the next
 * save), so this only follows along.
 */
export function useFinishedPrompt(pieceId: string, ydoc: Y.Doc, options: { finished: boolean; words: number; save: SaveState }) {
  const [finished, setFinished] = useState(options.finished);

  // Anything the writer does to the piece (not what another device sent) reopens it.
  useEffect(() => {
    const onChange = (_update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE) return;
      setFinished(false);
    };
    ydoc.on("update", onChange);
    return () => ydoc.off("update", onChange);
  }, [ydoc]);

  const toggle = useCallback(async () => {
    const next = !finished;
    try {
      await pieces.setStatus(pieceId, next ? "finished" : "draft");
    } catch {
      // The app shows its one screen for a failure.
      return;
    }
    setFinished(next);
  }, [pieceId, finished]);

  const saved = options.save === "saved" || options.save === "idle";
  const spot = spotFor({ finished, words: options.words, saved });
  return { spot, toggle: () => void toggle() };
}

import { useEffect, useState } from "react";
import { pieces } from "../lib/api";
import { buffer } from "../lib/localSave";
import { openPiece, type OpenedPiece } from "../lib/openPiece";

export type Load =
  | { status: "loading" }
  | { status: "ready"; piece: OpenedPiece | null }
  | { status: "missing" }
  | { status: "error"; retry: () => void };

/**
 * Loads a piece that already exists, before the page (and its editor) is shown.
 * A new piece (`id` is null) is ready at once with nothing to load.
 */
export function usePieceLoad(userId: string, id: string | null): Load {
  const [tries, setTries] = useState(0);
  const [load, setLoad] = useState<Load>(id ? { status: "loading" } : { status: "ready", piece: null });

  useEffect(() => {
    if (!id) {
      setLoad({ status: "ready", piece: null });
      return;
    }
    let cancelled = false;
    setLoad({ status: "loading" });
    openPiece(buffer, pieces, userId, id).then(
      (r) => {
        if (cancelled) return;
        if (r.status === "ok") setLoad({ status: "ready", piece: r.piece });
        else if (r.status === "missing") setLoad({ status: "missing" });
        else setLoad({ status: "error", retry: () => setTries((n) => n + 1) });
      },
      () => !cancelled && setLoad({ status: "error", retry: () => setTries((n) => n + 1) })
    );
    return () => {
      cancelled = true;
    };
  }, [userId, id, tries]);

  return load;
}


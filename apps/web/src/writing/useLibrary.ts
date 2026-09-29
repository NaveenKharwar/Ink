import type { LibraryItem } from "@ink/schemas";
import { useCallback, useEffect, useState } from "react";
import { pieces } from "../lib/api";

export type Library = {
  /** Null until the first answer arrives. */
  items: LibraryItem[] | null;
  failed: boolean;
  refresh: () => void;
};

/**
 * The writer's whole library, light (first two lines per piece). Fetched once, and again
 * whenever `refresh` is called: when the menu or All writing opens, so a piece written
 * a moment ago is there.
 */
export function useLibrary(): Library {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    pieces.library().then(
      (res) => {
        if (cancelled) return;
        setItems(res.items);
        setFailed(false);
      },
      () => !cancelled && setFailed(true)
    );
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { items, failed, refresh };
}

import type { LibraryItem } from "@ink/schemas";
import { useEffect, useState } from "react";
import { pieceDatesText } from "../lib/pieceDates";
import { onSaved } from "../lib/savedEvents";
import { deviceTimeZone } from "../lib/seasons";

/**
 * The open piece's dates as one line, from the library; a save on this visit makes the edit
 * date today. Null for a piece the library does not hold yet (a new page).
 */
export function usePieceDates(pieceId: string | null, items: LibraryItem[] | null): string | null {
  const [savedAt, setSavedAt] = useState<{ id: string; at: string } | null>(null);
  useEffect(() => {
    if (!pieceId) return;
    return onSaved(pieceId, () => setSavedAt({ id: pieceId, at: new Date().toISOString() }));
  }, [pieceId]);

  const item = pieceId ? items?.find((i) => i.id === pieceId) : undefined;
  if (!item) return null;
  const updatedAt = savedAt?.id === pieceId && savedAt.at > item.updatedAt ? savedAt.at : item.updatedAt;
  return pieceDatesText(item.createdAt, updatedAt, deviceTimeZone());
}

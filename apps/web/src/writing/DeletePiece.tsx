import { useState } from "react";
import { pieces } from "../lib/api";
import { bufferKey } from "../lib/buffer";
import { buffer } from "../lib/localSave";
import { MenuRow } from "../ui/MenuRow";

type Props = { pieceId: string; userId: string; onDeleted: () => void };

// The last grey line of "Ink sees this too". Tapping it asks once, in the same place; deleting is
// for good (no trash, no undo), and the words say so.
export function DeletePiece({ pieceId, userId, onDeleted }: Props) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const remove = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await pieces.remove(pieceId);
      // What this device still holds of it must not go up again.
      await buffer.remove(bufferKey(userId, pieceId)).catch(() => undefined);
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    onDeleted();
  };

  if (!asking)
    return (
      <MenuRow tone="danger" onClick={() => setAsking(true)}>
        Delete this piece
      </MenuRow>
    );

  // The question on the left, its two answers on the right: one row, each answer a 44px tap area.
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-2 px-3 text-[14px] leading-5">
      <span className="text-ink">Delete for good?</span>
      <span className="-mr-3 flex items-center">
        <MenuRow inline tone="danger" disabled={busy} onClick={() => void remove()} className="font-medium">
          Delete
        </MenuRow>
        <MenuRow inline tone="muted" disabled={busy} onClick={() => setAsking(false)}>
          Keep
        </MenuRow>
      </span>
      {failed && <span className="basis-full pb-2 text-[12px] text-ink-muted">Couldn’t delete that. Try again.</span>}
    </div>
  );
}

import { useState } from "react";
import { pieces } from "../lib/api";
import { bufferKey } from "../lib/buffer";
import { buffer } from "../lib/localSave";

type Props = { pieceId: string; userId: string; row: string; onDeleted: () => void };

const answer =
  "min-h-11 cursor-pointer border-0 bg-transparent px-3 text-[14px] leading-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default";

// The last grey line of "Ink sees this too". Tapping it asks once, in the same place; deleting is
// for good (no trash, no undo), and the words say so.
export function DeletePiece({ pieceId, userId, row, onDeleted }: Props) {
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
      <button type="button" onClick={() => setAsking(true)} className={`${row} text-danger`}>
        Delete this piece
      </button>
    );

  // The question on the left, its two answers on the right: one row, each answer a 44px tap area.
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-2 px-2 text-[14px] leading-5">
      <span className="text-ink">Delete for good?</span>
      <span className="flex items-center">
        <button type="button" onClick={() => void remove()} disabled={busy} className={`${answer} font-medium text-danger`}>
          Delete
        </button>
        <button type="button" onClick={() => setAsking(false)} disabled={busy} className={`${answer} text-ink-muted`}>
          Keep
        </button>
      </span>
      {failed && <span className="basis-full pb-2 text-[12px] text-ink-muted">Couldn’t delete that. Try again.</span>}
    </div>
  );
}

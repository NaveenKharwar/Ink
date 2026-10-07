import { useState } from "react";
import { pieces } from "../lib/api";
import { bufferKey } from "../lib/buffer";
import { buffer } from "../lib/localSave";

type Props = { pieceId: string; userId: string; row: string; onDeleted: () => void };

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
      <button type="button" onClick={() => setAsking(true)} className={row}>
        Delete this piece
      </button>
    );

  return (
    <div className="flex min-h-11 flex-wrap items-center text-[14px] leading-5 text-ink-muted">
      <span className="px-2">Delete for good?</span>
      <button type="button" onClick={() => void remove()} disabled={busy} className={`${row} w-auto underline`}>
        Delete
      </button>
      <button type="button" onClick={() => setAsking(false)} disabled={busy} className={`${row} w-auto`}>
        Keep
      </button>
      {failed && <span className="basis-full px-2 text-[12px]">Couldn’t delete that. Try again.</span>}
    </div>
  );
}

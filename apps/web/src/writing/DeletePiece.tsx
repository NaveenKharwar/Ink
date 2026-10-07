import { useState } from "react";
import { pieces } from "../lib/api";
import { bufferKey } from "../lib/buffer";
import { buffer } from "../lib/localSave";

type Props = { pieceId: string; userId: string; onDeleted: () => void };

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
// 14px text, 44px tap area (see FinishedPrompt).
const target = `-my-3 cursor-pointer border-0 bg-transparent px-0 py-3 text-[14px] leading-5 active:text-ink hover:text-ink ${focus}`;

// One quiet grey line under the last line of the page. Tapping it asks once, in the same place;
// deleting is for good (no trash, no undo), and the words say so.
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

  return (
    <div aria-live="polite" className="mt-3 min-h-5 font-sans text-[14px] leading-5 text-ink-muted">
      {asking ? (
        <div className="flex items-center gap-[18px]">
          <span>Delete for good?</span>
          <button type="button" onClick={() => void remove()} disabled={busy} className={`${target} text-ink underline`}>
            Delete
          </button>
          <button type="button" onClick={() => setAsking(false)} disabled={busy} className={`${target} text-ink-muted`}>
            Keep
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className={`${target} text-ink-muted`}>
          Delete this piece
        </button>
      )}
      {failed && <p className="m-0 mt-3">Couldn’t delete that. Try again.</p>}
    </div>
  );
}

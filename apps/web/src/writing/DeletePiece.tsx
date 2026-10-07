import { useState } from "react";
import { pieces } from "../lib/api";
import { bufferKey } from "../lib/buffer";
import { buffer } from "../lib/localSave";

type Props = { pieceId: string; userId: string; phone: boolean; onDeleted: () => void };

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
// The same quiet grey as "Keep it out of Ink's memory": dotted underline, 12px, bigger tap area on phone.
const link = (phone: boolean) =>
  `relative cursor-pointer border-0 border-b border-dotted border-ink-subtle bg-transparent p-0 text-[12px] leading-5 text-ink-muted hover:border-ink hover:text-ink ${
    phone ? "before:absolute before:-inset-x-3 before:-inset-y-3 before:content-['']" : ""
  } ${focus}`;

// The last grey line of "Ink sees this too". Tapping it asks once, in the same place; deleting is
// for good (no trash, no undo), and the words say so.
export function DeletePiece({ pieceId, userId, phone, onDeleted }: Props) {
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
    <div className="flex min-h-9 flex-wrap items-center gap-x-4 text-[12px] leading-5 text-ink-muted">
      {asking ? (
        <>
          <span>Delete for good?</span>
          <button type="button" onClick={() => void remove()} disabled={busy} className={link(phone)}>
            Delete
          </button>
          <button type="button" onClick={() => setAsking(false)} disabled={busy} className={link(phone)}>
            Keep
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className={link(phone)}>
          Delete this piece
        </button>
      )}
      {failed && <span className="basis-full">Couldn’t delete that. Try again.</span>}
    </div>
  );
}

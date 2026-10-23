import { useState } from "react";
import { account as accountApi, ApiError } from "../lib/api";
import { downloadAllWriting, type Progress } from "../lib/export/downloadAll";
import type { SeasonSet } from "../lib/seasons";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { MenuDivider, MenuRow } from "../ui/MenuRow";
import { CheckCircleIcon } from "./icons";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type DownloadState = { kind: "idle" } | { kind: "working"; progress: Progress | null } | { kind: "done"; fileName: string; pieces: number } | { kind: "failed" };

/** "Download all my writing", shared by the Profile row and the delete window. */
function useDownload(timeZone: string, set: SeasonSet) {
  const [state, setState] = useState<DownloadState>({ kind: "idle" });
  const start = async () => {
    if (state.kind === "working") return;
    setState({ kind: "working", progress: null });
    try {
      const done = await downloadAllWriting(timeZone, set, (progress) => setState({ kind: "working", progress }));
      setState({ kind: "done", fileName: done.fileName, pieces: done.pieces });
    } catch {
      setState({ kind: "failed" });
    }
  };
  return { state, start };
}

function progressText(state: DownloadState): string | null {
  if (state.kind === "working") {
    const p = state.progress;
    if (!p) return "Getting your writing ready…";
    if (p.pictures > 0) return `Adding your pictures, ${p.picturesDone} of ${p.pictures}…`;
    return `Getting your writing ready… ${p.pieces} ${p.pieces === 1 ? "piece" : "pieces"}`;
  }
  if (state.kind === "done") return `Downloaded ${state.fileName}`;
  if (state.kind === "failed") return "Ink couldn’t make the download. Check your connection and try again.";
  return null;
}

function DownloadStatus({ state }: { state: DownloadState }) {
  const text = progressText(state);
  if (!text) return null;
  return (
    <div aria-live="polite" className="mt-2 flex items-start gap-2 text-[13px] leading-[18px] text-ink-muted">
      {state.kind === "done" && (
        <span className="mt-px shrink-0">
          <CheckCircleIcon size={16} />
        </span>
      )}
      <span className={state.kind === "failed" ? "text-ink" : undefined}>{text}</span>
    </div>
  );
}

type Props = { email: string; pieces: number; wide: boolean; timeZone: string; set: SeasonSet };

/**
 * Under Sign out at the foot of Profile: "Download all my writing" (any time) and "Delete account",
 * which opens a window that offers the download again and emails the link that deletes the account.
 */
export function AccountFoot({ email, pieces, wide, timeZone, set }: Props) {
  const download = useDownload(timeZone, set);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="-mx-3 mt-5">
      <MenuDivider className="mx-3 mb-2" />
      <MenuRow tall disabled={download.state.kind === "working"} onClick={() => void download.start()}>
        <span className="block font-medium">Download all my writing</span>
        <span className="block text-[13px] leading-[18px] text-ink-muted">One .zip: a text file for each piece, and your pictures.</span>
      </MenuRow>
      <div className="px-3">
        <DownloadStatus state={download.state} />
      </div>
      <MenuRow tone="danger" className="mt-1" onClick={() => setDeleting(true)}>
        Delete account
      </MenuRow>
      {deleting && <DeleteWindow email={email} pieces={pieces} wide={wide} download={download} onClose={() => setDeleting(false)} />}
    </div>
  );
}

type SendState = { kind: "ask" } | { kind: "sending" } | { kind: "sent" } | { kind: "failed"; message: string };

function sendProblem(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) return "Ink can’t send another email just yet. Try again in a while.";
  if (err instanceof ApiError && err.status === 503) return "Ink can’t send email right now. Try again later.";
  if (err instanceof ApiError) return "Something went wrong on our side. Your writing is safe. Try again in a moment.";
  return "You seem to be offline. Check your connection and try again.";
}

function DeleteWindow({ email, pieces, wide, download, onClose }: { email: string; pieces: number; wide: boolean; download: ReturnType<typeof useDownload>; onClose: () => void }) {
  const [send, setSend] = useState<SendState>({ kind: "ask" });
  const ask = async () => {
    if (send.kind === "sending") return;
    setSend({ kind: "sending" });
    try {
      await accountApi.sendDeleteLink();
      setSend({ kind: "sent" });
    } catch (err) {
      setSend({ kind: "failed", message: sendProblem(err) });
    }
  };
  const what = pieces === 1 ? "Your piece" : pieces > 1 ? `Your ${pieces} pieces` : "Your writing";

  return (
    <Dialog title="Delete your account" wide={wide} onClose={onClose} className="w-[520px] h-auto">
      <div className="overflow-y-auto px-[var(--page-gutter)] pt-5 pb-6 text-[14px] leading-[21px] wide:px-6">
        {send.kind === "sent" ? (
          <>
            <p className="m-0 max-w-[440px]">
              Check your email. We sent a link to <span className="font-medium">{email}</span>.
            </p>
            <p className="mt-1 mb-0 text-[13px] leading-[18px] text-ink-muted">It works once, for 1 hour, on any device. Nothing is deleted until you confirm on the page it opens.</p>
            <Button className="mt-5" onClick={onClose}>
              Close
            </Button>
          </>
        ) : (
          <>
            <p className="m-0 max-w-[440px]">
              {what}, your pictures and everything Ink remembers about them go at once, on every device. This can’t be undone.
            </p>
            <Button className="mt-4" busy={download.state.kind === "working"} onClick={() => void download.start()}>
              Download all my writing
            </Button>
            <DownloadStatus state={download.state} />
            <div className="my-5 h-px bg-line" />
            <p className="m-0 max-w-[440px] text-ink-muted">To be sure it’s you, Ink emails a link to {email}. Your account is deleted only when you confirm on the page it opens.</p>
            {send.kind === "failed" && <p className="mt-3 mb-0 text-[13px] leading-[18px]">{send.message}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Button busy={send.kind === "sending"} onClick={() => void ask()}>
                Email me a link
              </Button>
              <button type="button" onClick={onClose} className={`touch-44 cursor-pointer border-0 bg-transparent p-0 text-ink-muted hover:text-ink ${focusRing}`}>
                Keep my account
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

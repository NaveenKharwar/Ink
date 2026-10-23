import type { LibraryItem } from "@ink/schemas";
import { useState } from "react";
import { account as accountApi, ApiError } from "../lib/api";
import { downloadAllWriting, type Progress } from "../lib/export/downloadAll";
import { usePictureList } from "../lib/pictures";
import { seasonPlace, type SeasonSet } from "../lib/seasons";
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

type Props = { email: string; items: LibraryItem[] | null; wide: boolean; timeZone: string; set: SeasonSet };

/**
 * Under Sign out at the foot of Profile: "Download all my writing" (any time) and "Delete account",
 * which asks once and then emails the link that deletes the account.
 */
export function AccountFoot({ email, items, wide, timeZone, set }: Props) {
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
      {deleting && <DeleteWindow email={email} items={items} wide={wide} timeZone={timeZone} set={set} onClose={() => setDeleting(false)} />}
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

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Asks once, plainly: how long they have written here and what would go. Keeping the account is the
// main button. Delete only emails the link; the account goes when the writer confirms on its page.
function DeleteWindow({ email, items, wide, timeZone, set, onClose }: { email: string; items: LibraryItem[] | null; wide: boolean; timeZone: string; set: SeasonSet; onClose: () => void }) {
  const [send, setSend] = useState<SendState>({ kind: "ask" });
  const pictureList = usePictureList();
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

  const oldest = items?.reduce<string | null>((min, i) => (!min || i.createdAt < min ? i.createdAt : min), null) ?? null;
  const since = oldest ? seasonPlace(new Date(oldest), timeZone, set) : null;
  const pieces = items?.length ?? 0;
  const pictures = pictureList.items?.length ?? 0;
  // Only what is really there: an empty account gets one plain sentence, not a list.
  const lost = [
    ...(pieces > 0 ? [count(pieces, "piece", "pieces")] : []),
    ...(pictures > 0 ? [count(pictures, "picture", "pictures")] : []),
    ...(pieces > 1 ? ["what Echoes found between them"] : [])
  ];

  if (send.kind === "sent")
    return (
      <Dialog title="Check your inbox" wide={wide} onClose={onClose} className="w-[460px] h-auto">
        <div className="px-[var(--page-gutter)] pt-5 pb-6 text-[14px] leading-[21px] wide:px-6">
          <p className="m-0">
            We sent an email to <span className="font-medium">{email}</span>. Open it and confirm, and your account is deleted.
          </p>
          <p className="mt-2 mb-0 text-ink-muted">Until then nothing changes. The link works once, for 1 hour.</p>
          <Button look="main" className="mt-5" onClick={onClose}>
            Done
          </Button>
        </div>
      </Dialog>
    );

  return (
    <Dialog title="Delete your account?" wide={wide} onClose={onClose} className="w-[460px] h-auto">
      <div className="px-[var(--page-gutter)] pt-5 pb-6 text-[14px] leading-[21px] wide:px-6">
        {lost.length > 0 ? (
          <>
            <p className="m-0">
              {since ? (
                <>
                  You’ve been writing here since <span className="font-medium">{`${since.name} ${since.year}`}</span>. Deleting takes, on every device:
                </>
              ) : (
                "Deleting takes, on every device:"
              )}
            </p>
            <ul className="m-0 mt-2 list-disc pl-5 marker:text-ink-subtle">
              {lost.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="m-0">Nothing is written here yet. Deleting removes your account, on every device.</p>
        )}
        <p className="mt-3 mb-0 text-ink-muted">This can’t be undone.</p>
        {send.kind === "failed" && <p className="mt-3 mb-0 text-[13px] leading-[18px]">{send.message}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Button look="main" onClick={onClose}>
            Keep my account
          </Button>
          <button
            type="button"
            disabled={send.kind === "sending"}
            aria-busy={send.kind === "sending" || undefined}
            onClick={() => void ask()}
            className={`touch-44 cursor-pointer border-0 bg-transparent p-0 font-medium text-danger disabled:cursor-default disabled:opacity-60 ${focusRing}`}
          >
            {send.kind === "sending" ? "Sending…" : "Delete"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

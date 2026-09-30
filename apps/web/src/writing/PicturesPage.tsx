import type { PictureSummary, PictureUsesResponse } from "@ink/schemas";
import { useEffect, useState, type DragEvent } from "react";
import { pictures as picturesApi } from "../lib/api";
import { addPicture, choosePicture, forgetPicture, formatBytes, PictureError, PICTURE_MESSAGES, usePicture, usePictureList } from "../lib/pictures";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Loader, ScreenLoader } from "../ui/Loader";
import { AdSlot } from "./AdSlot";
import { MenuIcon, NoteIcon } from "./icons";
import { PictureTile } from "./PictureTile";
import { SideColumn } from "./SideColumn";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type Props = {
  wide: boolean;
  showMenuButton: boolean;
  onMenu: () => void;
  /** When a picture was added, as it reads in Ink ("Now", "Monsoon 2025"). */
  seasonOf: (createdAt: string) => string;
  onOpenPiece: (id: string) => void;
};

/**
 * Pictures: every picture the writer added (covers and pictures in Notes), newest first. Upload
 * adds more; opening one shows where it is used and lets the writer delete it for good.
 */
export function PicturesPage({ wide, showMenuButton, onMenu, seasonOf, onOpenPiece }: Props) {
  const list = usePictureList();
  const [open, setOpen] = useState<PictureSummary | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setMessage(null);
    setUploading(true);
    try {
      for (const file of files) {
        const added = await addPicture(file);
        await added.uploaded;
      }
    } catch (err) {
      setMessage(err instanceof PictureError ? err.message : PICTURE_MESSAGES.failed);
    } finally {
      setUploading(false);
      void list.refresh();
    }
  };
  const chooseAndUpload = async () => {
    const file = await choosePicture();
    if (file) await upload([file]);
  };
  // Pictures dropped anywhere on the page are added too.
  const onDrop = (e: DragEvent) => {
    const files = [...e.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    e.preventDefault();
    void upload(files);
  };

  const count = list.items?.length ?? 0;

  return (
    <>
      <div className={`flex shrink-0 items-center gap-2.5 ${wide ? "h-14 pr-4 pl-4" : "h-[52px] pr-1.5 pl-1"}`}>
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open menu"
            className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink ${focusRing}`}
          >
            <MenuIcon />
          </button>
        )}
        <span className={`whitespace-nowrap ${showMenuButton ? "" : "pl-2.5"}`}>Pictures</span>
      </div>

      <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className={`grow overflow-y-auto px-[var(--page-gutter)] ${wide ? "pb-12" : "pb-10"}`}>
        <div className={`mx-auto max-w-[680px] ${wide ? "pt-7" : "pt-4"}`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className={`m-0 font-display font-normal ${wide ? "text-[30px] leading-9" : "text-[26px] leading-8"}`}>Your pictures</h1>
              {list.items && (
                <div className="mt-1 text-[13px] text-ink-muted">
                  {count} {count === 1 ? "picture" : "pictures"}
                  {count > 0 && ` · ${formatBytes(list.totalBytes)}`}
                </div>
              )}
            </div>
            <Button busy={uploading} onClick={() => void chooseAndUpload()} className="h-10 shrink-0 text-[14px]">
              Upload
            </Button>
          </div>

          {message && (
            <p role="status" className="m-0 mt-4 flex items-center gap-2 text-[13px] leading-5 text-ink">
              <NoteIcon size={16} />
              {message}
            </p>
          )}

          {list.failed && !list.items ? (
            <div className="mt-10 text-[14px] text-ink">
              Ink couldn't load your pictures.{" "}
              <button type="button" onClick={() => void list.refresh()} className={`cursor-pointer border-0 bg-transparent p-0 text-accent underline underline-offset-4 ${focusRing}`}>
                Try again
              </button>
            </div>
          ) : !list.items ? (
            <ScreenLoader className="py-16" label="Loading your pictures" />
          ) : count === 0 ? (
            <p className="m-0 mt-10 max-w-[420px] text-[14px] leading-[22px] text-ink-muted">
              No pictures yet. Covers and pictures you add to your writing show up here, and so does anything you upload.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {list.items.map((item) => (
                <PictureTile key={item.id} id={item.id} preview={item.preview} label="Open picture" onClick={() => setOpen(item)} />
              ))}
            </div>
          )}

          <p className="m-0 mt-6 text-[13px] text-ink-muted">Only you can see these.</p>
        </div>
      </div>

      {/* Beside the paper, on the ground: the ad slot at the bottom, as on All writing. */}
      {wide && import.meta.env.DEV && (
        <SideColumn>
          <div className="mt-auto w-full max-w-[300px] shrink-0 pt-6">
            <AdSlot />
          </div>
        </SideColumn>
      )}

      {open && (
        <PictureViewer
          picture={open}
          wide={wide}
          added={seasonOf(open.createdAt)}
          onClose={() => setOpen(null)}
          onOpenPiece={(id) => {
            setOpen(null);
            onOpenPiece(id);
          }}
          onDeleted={() => {
            setOpen(null);
            void list.refresh();
          }}
        />
      )}
    </>
  );
}

function PictureViewer({
  picture,
  wide,
  added,
  onClose,
  onOpenPiece,
  onDeleted
}: {
  picture: PictureSummary;
  wide: boolean;
  added: string;
  onClose: () => void;
  onOpenPiece: (id: string) => void;
  onDeleted: () => void;
}) {
  const url = usePicture(picture.id);
  const [uses, setUses] = useState<PictureUsesResponse["items"] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let live = true;
    picturesApi.uses(picture.id).then(
      (res) => live && setUses(res.items),
      () => live && setUses([])
    );
    return () => {
      live = false;
    };
  }, [picture.id]);

  const remove = async () => {
    setDeleting(true);
    setFailed(false);
    try {
      await picturesApi.remove(picture.id);
      forgetPicture(picture.id);
      onDeleted();
    } catch {
      setFailed(true);
      setDeleting(false);
    }
  };

  const usedIn = uses?.length ?? 0;
  const pieceName = (use: { title: string | null; firstLine: string }) => use.title ?? (use.firstLine || "Untitled");

  return (
    <Dialog title="Picture" wide={wide} onClose={onClose} className="h-[720px] w-[1040px]">
      <div className={`flex min-h-0 grow ${wide ? "flex-row" : "flex-col overflow-y-auto"}`}>
        <div className={`flex items-center justify-center bg-ground p-6 ${wide ? "min-w-0 grow" : "min-h-[280px]"}`}>
          {url && url !== "failed" ? (
            <img
              src={url}
              alt=""
              onLoad={(e) => setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
              className="block max-h-full max-w-full rounded-md"
            />
          ) : (
            <span className="text-[13px] text-ink-muted">{url === "failed" ? "This picture couldn't be loaded." : <Loader delayMs={300} label="Loading the picture" />}</span>
          )}
        </div>
        <div className={`box-border flex shrink-0 flex-col gap-5 px-[var(--page-gutter)] py-5 wide:px-6 ${wide ? "w-[300px] border-l border-line" : ""}`}>
          <div className="text-[13px] leading-5 text-ink-muted">
            Added {added}
            <br />
            {size ? `${size.width} × ${size.height} · ` : ""}
            {formatBytes(picture.bytes)}
          </div>
          <div>
            <div className="mb-1.5 text-[13px] text-ink-muted">Used in</div>
            {uses === null ? (
              <Loader size={14} delayMs={300} label="Finding where it's used" />
            ) : usedIn === 0 ? (
              <div className="text-[14px]">Not in any piece yet.</div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {uses.map((use) => (
                  <li key={use.id}>
                    <a
                      href={`/p/${use.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenPiece(use.id);
                      }}
                      className={`block truncate font-serif text-[16px] leading-6 text-accent no-underline hover:underline hover:underline-offset-4 ${focusRing}`}
                    >
                      {pieceName(use)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-auto">
            {confirming ? (
              <>
                <p className="m-0 mb-3 text-[14px] leading-[21px]">
                  {usedIn === 0
                    ? "Delete this picture? This can't be undone."
                    : usedIn === 1
                      ? `Delete this picture? It will also be taken out of “${pieceName(uses![0]!)}”. This can't be undone.`
                      : `Delete this picture? It will also be taken out of ${usedIn} pieces. This can't be undone.`}
                </p>
                {failed && <p className="m-0 mb-3 text-[13px] text-ink">Ink couldn't delete it. Try again in a moment.</p>}
                <div className="flex gap-2">
                  <Button look="main" busy={deleting} onClick={() => void remove()} className="h-10 text-[14px]">
                    Delete
                  </Button>
                  <Button onClick={() => setConfirming(false)} disabled={deleting} className="h-10 text-[14px]">
                    Keep it
                  </Button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={uses === null}
                className={`h-8 cursor-pointer border-0 bg-transparent p-0 text-[14px] text-ink/75 transition-colors duration-150 hover:text-ink disabled:cursor-default motion-reduce:transition-none ${focusRing}`}
              >
                Delete picture
              </button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

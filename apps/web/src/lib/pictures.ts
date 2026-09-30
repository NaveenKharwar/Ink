import type { PictureSummary } from "@ink/schemas";
import { useCallback, useEffect, useState } from "react";
import { pictures } from "./api";
import { newId } from "./newId";
import { fitWithin, PICTURE_MAX_SIDE, PREVIEW_SIDE, SMALL_SIDE } from "./pictureSize";

const QUALITY = 0.85;

export type PictureProblem = "offline" | "not-a-picture" | "failed";

// Plain words, what happened and what to do; never red (see Messages in the design system).
export const PICTURE_MESSAGES: Record<PictureProblem, string> = {
  offline: "Pictures need a connection. Try again when you're online.",
  "not-a-picture": "Ink can't open this file as a picture. Try a photo or an image.",
  failed: "Ink couldn't add this picture. Try again in a moment."
};

export class PictureError extends Error {
  readonly problem: PictureProblem;
  constructor(problem: PictureProblem) {
    super(PICTURE_MESSAGES[problem]);
    this.problem = problem;
  }
}

type Prepared = { full: Blob; small: Blob; preview: string };

function draw(bitmap: ImageBitmap, max: number): HTMLCanvasElement {
  const size = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new PictureError("failed");
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  return canvas;
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

// WebP, or JPEG where the browser can't write WebP (Safari).
async function compress(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await encode(canvas, "image/webp");
  if (webp?.type === "image/webp") return webp;
  const jpeg = await encode(canvas, "image/jpeg");
  if (!jpeg) throw new PictureError("failed");
  return jpeg;
}

/**
 * Redraws the picture, upright, three times: at most 2400px on its longest side (the picture),
 * 480px (the small copy grids show) and 16px (a tiny preview, shown blurred while the others
 * load). Redrawing keeps only the pixels, so the photo's location, camera and date details
 * never leave the device.
 */
export async function preparePicture(file: Blob): Promise<Prepared> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PictureError("not-a-picture");
  }
  try {
    const full = await compress(draw(bitmap, PICTURE_MAX_SIDE));
    const small = await compress(draw(bitmap, SMALL_SIDE));
    const tiny = draw(bitmap, PREVIEW_SIDE);
    const webp = tiny.toDataURL("image/webp", 0.5);
    const preview = webp.startsWith("data:image/webp") ? webp : tiny.toDataURL("image/jpeg", 0.5);
    return { full, small, preview };
  } finally {
    bitmap.close();
  }
}

export type PictureSize = "full" | "small";

// Pictures already shown in this visit, by id and size: an object URL for the bytes. A picture
// the writer just added shows at once from the device, before its upload finishes.
const shown = new Map<string, Promise<string>>();
const key = (id: string, size: PictureSize) => `${id}|${size}`;

function load(id: string, size: PictureSize): Promise<string> {
  let url = shown.get(key(id, size));
  if (!url) {
    const fetched = pictures.get(id, size).then((blob) => URL.createObjectURL(blob));
    // A picture added before small copies existed has none: show the picture itself instead.
    url = size === "small" ? fetched.catch(() => load(id, "full")) : fetched;
    // A failed load is forgotten, so the picture is tried again next time it is shown.
    url.catch(() => shown.delete(key(id, size)));
    shown.set(key(id, size), url);
  }
  return url;
}

/**
 * Makes a picture ready from a file the writer chose: resized on the device, shown at once,
 * uploaded in the background (the small copy first, then the picture with its preview). `id`
 * can be used straight away; `uploaded` settles when the picture is safely stored (and rejects
 * with a PictureError if it couldn't be).
 */
export async function addPicture(file: Blob): Promise<{ id: string; uploaded: Promise<void> }> {
  if (!navigator.onLine) throw new PictureError("offline");
  const picture = await preparePicture(file);
  const id = newId();
  shown.set(key(id, "full"), Promise.resolve(URL.createObjectURL(picture.full)));
  shown.set(key(id, "small"), Promise.resolve(URL.createObjectURL(picture.small)));
  const uploaded = (async () => {
    await pictures.put(id, picture.small, { size: "small" });
    await pictures.put(id, picture.full, { preview: picture.preview });
  })().catch(() => {
    throw new PictureError(navigator.onLine ? "failed" : "offline");
  });
  return { id, uploaded };
}

/**
 * The picture's address for an <img>, once loaded; "failed" if it couldn't be. Grids ask for the
 * small copy; nothing loads while `id` is null (a tile not yet near the screen).
 */
export function usePicture(id: string | null, size: PictureSize = "full"): string | null | "failed" {
  const [state, setState] = useState<{ key: string | null; url: string | null | "failed" }>({ key: null, url: null });
  useEffect(() => {
    if (!id) return;
    let live = true;
    load(id, size).then(
      (url) => live && setState({ key: key(id, size), url }),
      () => live && setState({ key: key(id, size), url: "failed" })
    );
    return () => {
      live = false;
    };
  }, [id, size]);
  return id && state.key === key(id, size) ? state.url : null;
}

/** Opens the device's photos and gives back the file picked (none if the writer cancels). */
export function choosePicture(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}

/** Forgets a deleted picture's bytes in this visit. */
export function forgetPicture(id: string) {
  for (const size of ["full", "small"] as const) {
    const url = shown.get(key(id, size));
    shown.delete(key(id, size));
    void url?.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
  }
}

/** The writer's pictures (the Pictures page, the picker), newest first. */
export function usePictureList() {
  const [items, setItems] = useState<PictureSummary[] | null>(null);
  const [totalBytes, setTotalBytes] = useState(0);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const list = await pictures.list();
      setItems(list.items);
      setTotalBytes(list.totalBytes);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { items, totalBytes, failed, refresh };
}

/** "412 KB", "3.2 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

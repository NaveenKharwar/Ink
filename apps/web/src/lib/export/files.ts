import { zipSync, strToU8 } from "fflate";
import type { ExportDoc } from "./piece";

// Packing what an export made: names for its files and one .zip for many of them.

const UNSAFE = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const NAME_MAX = 80;

const day = (date: Date, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

/** A file name every system accepts: the day it was written, then its title ("2025-01-03 The kettle.md"). */
export function fileNameOf(doc: ExportDoc, timeZone: string, extension: string): string {
  const title = doc.title.replace(UNSAFE, " ").replace(/\s+/g, " ").trim().replace(/^\.+/, "").slice(0, NAME_MAX).trim();
  return `${day(doc.createdAt, timeZone)} ${title || "Untitled"}.${extension}`;
}

/** Gives a name that is already taken a number: "Untitled.md", "Untitled (2).md". Case is ignored, as on most computers. */
export function uniqueNamer() {
  const taken = new Set<string>();
  return (name: string) => {
    const dot = name.lastIndexOf(".");
    const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
    let candidate = name;
    for (let n = 2; taken.has(candidate.toLowerCase()); n += 1) candidate = `${stem} (${n})${ext}`;
    taken.add(candidate.toLowerCase());
    return candidate;
  };
}

export const pictureExtension = (type: string) => (type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg");

export type ExportFile = { path: string; data: Uint8Array | string };

/** One .zip of many files. Pictures are already compressed, so they are stored as they are. */
export function zipOf(files: ExportFile[]): Uint8Array {
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  for (const file of files) {
    const data = typeof file.data === "string" ? strToU8(file.data) : file.data;
    entries[file.path] = [data, { level: typeof file.data === "string" ? 6 : 0 }];
  }
  return zipSync(entries);
}

/** Hands a file to the browser to save. */
export function saveFile(name: string, data: Uint8Array | string, type: string) {
  const blob = new Blob([typeof data === "string" ? data : (data as BlobPart)], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

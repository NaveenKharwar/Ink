import { account, pictures } from "../api";
import type { SeasonSet } from "../seasons";
import { fileNameOf, pictureExtension, saveFile, uniqueNamer, zipOf, type ExportFile } from "./files";
import { toMarkdown } from "./markdown";
import { picturesOf, toExportDoc, type ExportDoc } from "./piece";

export type Progress = { pieces: number; pictures: number; picturesDone: number };

const day = (date: Date, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

/**
 * "Download all my writing": one .zip, built here on the device, with a Markdown file for each
 * piece and a `pictures` folder. The server only hands over the writer's own pieces and pictures,
 * as it does when they are opened; it never makes or keeps a file of the writing.
 */
export async function downloadAllWriting(timeZone: string, set: SeasonSet, onProgress: (p: Progress) => void = () => {}): Promise<{ pieces: number; fileName: string }> {
  const docs: ExportDoc[] = [];
  let cursor: string | undefined;
  do {
    const page = await account.exportPage(cursor);
    for (const piece of page.items) docs.push(toExportDoc(piece, timeZone, set));
    cursor = page.nextCursor ?? undefined;
    onProgress({ pieces: docs.length, pictures: 0, picturesDone: 0 });
  } while (cursor);

  // Each picture once, however many pieces use it.
  const ids = [...new Set(docs.flatMap(picturesOf))];
  const pictureFiles = new Map<string, ExportFile>();
  let done = 0;
  for (const id of ids) {
    try {
      const blob = await pictures.get(id);
      pictureFiles.set(id, { path: `pictures/${id}.${pictureExtension(blob.type)}`, data: new Uint8Array(await blob.arrayBuffer()) });
    } catch {
      // A picture that can't be fetched (deleted meanwhile) is left out; the writing still goes in.
    }
    done += 1;
    onProgress({ pieces: docs.length, pictures: ids.length, picturesDone: done });
  }

  const name = uniqueNamer();
  const folder = `Ink writing ${day(new Date(), timeZone)}`;
  const files: ExportFile[] = docs.map((doc) => ({
    path: `${folder}/${name(fileNameOf(doc, timeZone, "md"))}`,
    data: toMarkdown(doc, timeZone, (id) => pictureFiles.get(id)?.path ?? null)
  }));
  for (const file of pictureFiles.values()) files.push({ ...file, path: `${folder}/${file.path}` });

  const fileName = `${folder}.zip`;
  saveFile(fileName, zipOf(files), "application/zip");
  return { pieces: docs.length, fileName };
}

import { docToPlainText, removePictureFromYdoc, ydocPictureIds, ydocToEditorDoc, ydocToMeta, type EditorDoc, type PieceMeta } from "@ink/schemas";
import * as Y from "yjs";

/** The bytes the client sent are not valid Yjs data. */
export class InvalidUpdateError extends Error {}

export type Merged = {
  /** The whole document, to store. */
  state: Uint8Array;
  /** What the client is missing, to send back. */
  diff: Uint8Array;
  /** What the server has now. */
  stateVector: Uint8Array;
  /** Derived copies (words, title, language), kept next to the document for reading and search. */
  content: EditorDoc;
  text: string;
  meta: PieceMeta;
  /** The pictures the piece uses (cover and text). */
  pictureIds: string[];
};

/**
 * Yjs merges are order-independent and safe to repeat, so a retried or duplicated
 * sync never changes the result. Throws if the bytes are not valid Yjs data.
 */
export function mergeYdoc(stored: Uint8Array | null, incoming: Uint8Array | null, clientVector: Uint8Array): Merged {
  const doc = new Y.Doc();
  if (stored?.length) Y.applyUpdate(doc, stored);
  let diff: Uint8Array;
  try {
    if (incoming?.length) Y.applyUpdate(doc, incoming);
    diff = Y.encodeStateAsUpdate(doc, clientVector);
  } catch {
    throw new InvalidUpdateError();
  }
  const content = ydocToEditorDoc(doc);
  const merged = {
    state: Y.encodeStateAsUpdate(doc),
    diff,
    stateVector: Y.encodeStateVector(doc),
    content,
    text: docToPlainText(content),
    meta: ydocToMeta(doc),
    pictureIds: ydocPictureIds(doc)
  };
  doc.destroy();
  return merged;
}

/**
 * The piece with a picture taken out (cover and text), made as an ordinary Yjs change so the
 * writer's devices merge it on their next sync. Null when the piece didn't use it.
 */
export function withoutPicture(stored: Uint8Array, pictureId: string): Merged | null {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, stored);
  const changed = removePictureFromYdoc(doc, pictureId);
  const state = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return changed ? mergeYdoc(state, null, new Uint8Array([0])) : null;
}

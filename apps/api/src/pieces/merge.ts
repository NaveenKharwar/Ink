import { docToPlainText, ydocToEditorDoc, ydocToMeta, type EditorDoc, type PieceMeta } from "@ink/schemas";
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
    meta: ydocToMeta(doc)
  };
  doc.destroy();
  return merged;
}

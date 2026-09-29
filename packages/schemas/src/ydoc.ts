import * as Y from "yjs";
import { pieceLanguage, type EditorDoc, type EditorMark, type EditorNode, type PieceLanguage } from "./piece.js";

// The name the editor's Yjs binding stores the document under.
export const EDITOR_FIELD = "default";
// A piece's settings live in the same Yjs document, in a map of their own next to the text,
// so they merge across devices and work offline just like the words do.
export const META_FIELD = "meta";
export const TITLE_MAX = 200;

export type PieceMeta = { title: string | null; language: PieceLanguage | null };

function textNodes(text: Y.XmlText): EditorNode[] {
  const nodes: EditorNode[] = [];
  for (const run of text.toDelta() as Array<{ insert: unknown; attributes?: Record<string, unknown> }>) {
    if (typeof run.insert !== "string" || run.insert === "") continue;
    const marks: EditorMark[] = Object.entries(run.attributes ?? {}).map(([type, attrs]) => {
      const hasAttrs = attrs && typeof attrs === "object" && Object.keys(attrs).length > 0;
      return hasAttrs ? { type, attrs: attrs as Record<string, unknown> } : { type };
    });
    nodes.push({ type: "text", text: run.insert, ...(marks.length ? { marks } : {}) });
  }
  return nodes;
}

function elementNode(element: Y.XmlElement): EditorNode {
  const attrs = element.getAttributes() as Record<string, unknown>;
  const content = element.toArray().flatMap((child) =>
    child instanceof Y.XmlText ? textNodes(child) : child instanceof Y.XmlElement ? [elementNode(child)] : []
  );
  return {
    type: element.nodeName,
    ...(Object.keys(attrs).length ? { attrs } : {}),
    ...(content.length ? { content } : {})
  };
}

/**
 * The editor document held in a Yjs document, as the same JSON the editor produces.
 * Reads Yjs' own structure, so the server needs no editor code.
 */
export function ydocToEditorDoc(ydoc: Y.Doc): EditorDoc {
  const content = ydoc
    .getXmlFragment(EDITOR_FIELD)
    .toArray()
    .flatMap((child) => (child instanceof Y.XmlElement ? [elementNode(child)] : []));
  return content.length ? { type: "doc", content } : { type: "doc" };
}

/**
 * The piece's settings from its Yjs document. Anything missing or not valid reads as
 * empty, so a bad client cannot put nonsense in the database columns.
 */
export function ydocToMeta(ydoc: Y.Doc): PieceMeta {
  const meta = ydoc.getMap(META_FIELD);
  const title = meta.get("title");
  const language = pieceLanguage.safeParse(meta.get("language"));
  return {
    title: typeof title === "string" && title.trim() ? title.trim().slice(0, TITLE_MAX) : null,
    language: language.success ? language.data : null
  };
}

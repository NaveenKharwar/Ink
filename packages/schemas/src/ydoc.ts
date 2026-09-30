import * as Y from "yjs";
import {
  pieceCover,
  pieceLanguage,
  pieceStyle,
  type EditorDoc,
  type EditorMark,
  type EditorNode,
  type PieceLanguage,
  type PieceStyle
} from "./piece.js";

// The name the editor's Yjs binding stores the document under.
export const EDITOR_FIELD = "default";
// A piece's settings live in the same Yjs document, in a map of their own next to the text,
// so they merge across devices and work offline just like the words do.
export const META_FIELD = "meta";
export const TITLE_MAX = 200;

export type PieceMeta = { title: string | null; language: PieceLanguage | null; style: PieceStyle | null };

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
  const style = pieceStyle.safeParse(meta.get("style"));
  return {
    title: typeof title === "string" && title.trim() ? title.trim().slice(0, TITLE_MAX) : null,
    language: language.success ? language.data : null,
    style: style.success ? style.data : null
  };
}

// The editor node that holds a picture in the text (Notes); its `id` names the picture.
export const PICTURE_NODE = "picture";

function pictureElements(parent: Y.XmlFragment | Y.XmlElement, found: Array<{ parent: Y.XmlFragment | Y.XmlElement; element: Y.XmlElement }>) {
  for (const child of parent.toArray()) {
    if (!(child instanceof Y.XmlElement)) continue;
    if (child.nodeName === PICTURE_NODE) found.push({ parent, element: child });
    else pictureElements(child, found);
  }
  return found;
}

/** Every picture a piece uses: its cover and the pictures in its text, each id once. */
export function ydocPictureIds(ydoc: Y.Doc): string[] {
  const ids = new Set<string>();
  const cover = pieceCover.safeParse(ydoc.getMap(META_FIELD).get("cover"));
  if (cover.success) ids.add(cover.data.id);
  for (const { element } of pictureElements(ydoc.getXmlFragment(EDITOR_FIELD), [])) {
    const id = element.getAttribute("id");
    if (typeof id === "string" && id) ids.add(id);
  }
  return [...ids];
}

/**
 * Takes a picture out of a piece (its cover and every place in the text), as an ordinary Yjs
 * change, so the writer's devices simply merge it. Returns whether anything changed.
 */
export function removePictureFromYdoc(ydoc: Y.Doc, id: string): boolean {
  let changed = false;
  ydoc.transact(() => {
    const meta = ydoc.getMap(META_FIELD);
    const cover = pieceCover.safeParse(meta.get("cover"));
    if (cover.success && cover.data.id === id) {
      meta.delete("cover");
      changed = true;
    }
    // From the end, so earlier positions stay valid.
    for (const { parent, element } of pictureElements(ydoc.getXmlFragment(EDITOR_FIELD), []).reverse()) {
      if (element.getAttribute("id") !== id) continue;
      parent.delete(parent.toArray().indexOf(element), 1);
      changed = true;
    }
  });
  return changed;
}

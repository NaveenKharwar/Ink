import * as Y from "yjs";
import type { EditorDoc, EditorMark, EditorNode } from "./piece.js";

// The name the editor's Yjs binding stores the document under.
export const EDITOR_FIELD = "default";

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

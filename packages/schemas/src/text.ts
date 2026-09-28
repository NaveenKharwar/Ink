import type { EditorDoc, EditorNode } from "./piece.js";

const LIST_TYPES = new Set(["bulletList", "orderedList"]);

function inlineText(nodes: EditorNode[] = []): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.text ?? "";
      if (node.type === "hardBreak") return "\n";
      return inlineText(node.content);
    })
    .join("");
}

function blockText(node: EditorNode): string {
  if (LIST_TYPES.has(node.type)) {
    const ordered = node.type === "orderedList";
    const start = typeof node.attrs?.start === "number" ? node.attrs.start : 1;
    return (node.content ?? [])
      .map((item, i) => `${ordered ? `${start + i}.` : "-"} ${blockText(item)}`)
      .join("\n");
  }
  if (node.type === "listItem") return (node.content ?? []).map(blockText).join("\n");
  if (node.content?.some((child) => child.type === "text" || child.type === "hardBreak")) {
    return inlineText(node.content);
  }
  if (node.content) return node.content.map(blockText).join("\n");
  return node.type === "text" ? node.text ?? "" : "";
}

/**
 * Plain text of a piece for embeddings, search and export.
 * Stanzas (top-level blocks) are separated by a blank line; lines keep their breaks.
 */
export function docToPlainText(doc: EditorDoc): string {
  return (doc.content ?? []).map(blockText).join("\n\n").replace(/\s+$/u, "");
}

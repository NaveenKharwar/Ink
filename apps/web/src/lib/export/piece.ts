import type { EditorDoc, EditorNode, ExportPiece, PieceStyle } from "@ink/schemas";
import { isFollowable } from "../link";
import { seasonPlace, type SeasonSet } from "../seasons";

// One plain shape for a piece, made once from what the editor stores. Every export format (the
// Markdown download today; a PDF or a picture of a piece later) is written from this shape, so
// none of them has to know the editor's own format.

export type Span = { text: string; bold?: boolean; italic?: boolean; href?: string };
/** A line is a run of spans; a stanza (a paragraph) is its lines. */
export type Line = Span[];

export type Block =
  | { kind: "stanza"; lines: Line[] }
  | { kind: "heading"; level: 1 | 2 | 3; spans: Line }
  | { kind: "quote"; blocks: Block[] }
  | { kind: "list"; ordered: boolean; items: Block[][] }
  | { kind: "rule" }
  | { kind: "picture"; id: string };

export type ExportDoc = {
  id: string;
  title: string;
  /** False when the piece has no title and its first line stands in for one. */
  titled: boolean;
  style: PieceStyle;
  finished: boolean;
  /** The season it was written in, as Ink shows it ("Winter 2025"). */
  season: string;
  createdAt: Date;
  updatedAt: Date;
  cover: string | null;
  blocks: Block[];
};

function spansOf(nodes: EditorNode[] = []): Line[] {
  const lines: Line[] = [[]];
  for (const node of nodes) {
    if (node.type === "hardBreak") {
      lines.push([]);
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    const span: Span = { text: node.text };
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") span.bold = true;
      else if (mark.type === "italic") span.italic = true;
      else if (mark.type === "link" && typeof mark.attrs?.href === "string" && isFollowable(mark.attrs.href)) span.href = mark.attrs.href;
    }
    lines[lines.length - 1]!.push(span);
  }
  return lines;
}

function blocksOf(nodes: EditorNode[] = []): Block[] {
  const blocks: Block[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph": {
        const lines = spansOf(node.content);
        // An empty paragraph is the space between stanzas, which the gap between blocks already gives.
        if (lines.some((line) => line.length > 0)) blocks.push({ kind: "stanza", lines });
        break;
      }
      case "heading": {
        const level = node.attrs?.level === 1 || node.attrs?.level === 2 ? node.attrs.level : 3;
        const spans = spansOf(node.content).flat();
        if (spans.length) blocks.push({ kind: "heading", level, spans });
        break;
      }
      case "blockquote":
        blocks.push({ kind: "quote", blocks: blocksOf(node.content) });
        break;
      case "bulletList":
      case "orderedList":
        blocks.push({ kind: "list", ordered: node.type === "orderedList", items: (node.content ?? []).map((item) => blocksOf(item.content)) });
        break;
      case "horizontalRule":
        blocks.push({ kind: "rule" });
        break;
      case "picture":
        if (typeof node.attrs?.id === "string" && node.attrs.id) blocks.push({ kind: "picture", id: node.attrs.id });
        break;
      default:
        // A node this version doesn't know still keeps its words.
        if (node.content) blocks.push(...blocksOf(node.content));
    }
  }
  return blocks;
}

const plain = (line: Line) => line.map((s) => s.text).join("").trim();

function firstLine(blocks: Block[]): string | null {
  for (const block of blocks) {
    if (block.kind === "stanza") {
      const line = block.lines.map(plain).find(Boolean);
      if (line) return line;
    } else if (block.kind === "heading") {
      const line = plain(block.spans);
      if (line) return line;
    } else if (block.kind === "quote" || block.kind === "list") {
      const line = firstLine(block.kind === "quote" ? block.blocks : block.items.flat());
      if (line) return line;
    }
  }
  return null;
}

/** Every picture a piece shows: its cover first, then the pictures in its text, each once. */
export function picturesOf(doc: ExportDoc): string[] {
  const ids = new Set<string>(doc.cover ? [doc.cover] : []);
  const walk = (blocks: Block[]) => {
    for (const block of blocks) {
      if (block.kind === "picture") ids.add(block.id);
      else if (block.kind === "quote") walk(block.blocks);
      else if (block.kind === "list") block.items.forEach(walk);
    }
  };
  walk(doc.blocks);
  return [...ids];
}

/** The piece as one plain shape, with its season worked out where the writer is. */
export function toExportDoc(piece: ExportPiece, timeZone: string, set: SeasonSet): ExportDoc {
  const blocks = blocksOf((piece.content as EditorDoc).content);
  const createdAt = new Date(piece.createdAt);
  const place = seasonPlace(createdAt, timeZone, set);
  const title = piece.title?.trim() || null;
  return {
    id: piece.id,
    title: title ?? firstLine(blocks) ?? "Untitled",
    titled: !!title,
    style: piece.style ?? "poem",
    finished: piece.status === "finished",
    season: `${place.name} ${place.year}`,
    createdAt,
    updatedAt: new Date(piece.updatedAt),
    cover: piece.cover,
    blocks
  };
}

import { z } from "zod";

export const pieceStatus = z.enum(["draft", "finished"]);
export type PieceStatus = z.infer<typeof pieceStatus>;

export const pieceLanguage = z.enum(["hi", "hi-Latn", "en", "mixed"]);
export type PieceLanguage = z.infer<typeof pieceLanguage>;

// How a piece is written: a poem (lines and stanzas), a story (paragraphs like a book) or
// notes (headings, lists, links). Chosen by the writer; a piece without one is a poem.
export const pieceStyle = z.enum(["poem", "story", "notes"]);
export type PieceStyle = z.infer<typeof pieceStyle>;

// A piece's cover: one of the writer's own pictures across the top of the paper. It lives in
// the piece's Yjs document (meta map, "cover"), like the title: `id` names the picture in the
// writer's private store, `crop` is the part the writer chose, in percent of the picture
// (the picture itself is never changed, so one picture can be cropped differently per piece).
const percent = z.number().min(0).max(100);
export const pictureCrop = z.object({ x: percent, y: percent, width: percent.positive(), height: percent.positive() });
export type PictureCrop = z.infer<typeof pictureCrop>;
export const pieceCover = z.object({ id: z.string().uuid(), crop: pictureCrop });
export type PieceCover = z.infer<typeof pieceCover>;

// The writer's pictures, as the Pictures page lists them.
export const pictureSummary = z.object({
  id: z.string().uuid(),
  type: z.enum(["image/jpeg", "image/webp"]),
  bytes: z.number().int().nonnegative(),
  // A tiny blurred preview (a data: URL of a few hundred bytes), shown while the picture loads.
  preview: z.string().nullable(),
  createdAt: z.string()
});
export type PictureSummary = z.infer<typeof pictureSummary>;
export const pictureListResponse = z.object({ items: z.array(pictureSummary), totalBytes: z.number().int().nonnegative() });
export type PictureListResponse = z.infer<typeof pictureListResponse>;
// The pieces a picture is in (its cover, or in the text).
export const pictureUsesResponse = z.object({
  items: z.array(z.object({ id: z.string().uuid(), title: z.string().nullable(), firstLine: z.string() }))
});
export type PictureUsesResponse = z.infer<typeof pictureUsesResponse>;

// Editor (TipTap / ProseMirror) JSON. The editor owns the node types, so this only
// checks the shape. A stanza is a paragraph; a line inside it is a hardBreak.
export type EditorMark = { type: string; attrs?: Record<string, unknown> };
export type EditorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: EditorNode[];
  text?: string;
  marks?: EditorMark[];
};
export type EditorDoc = { type: "doc"; content?: EditorNode[] };

const MAX_DEPTH = 32;

const editorMark: z.ZodType<EditorMark> = z.object({
  type: z.string().min(1),
  attrs: z.record(z.unknown()).optional()
});

const editorNode: z.ZodType<EditorNode> = z.lazy(() =>
  z.object({
    type: z.string().min(1),
    attrs: z.record(z.unknown()).optional(),
    content: z.array(editorNode).optional(),
    text: z.string().optional(),
    marks: z.array(editorMark).optional()
  })
);

function depthOf(value: unknown): number {
  let max = 0;
  const stack: Array<[unknown, number]> = [[value, 1]];
  while (stack.length) {
    const [node, depth] = stack.pop()!;
    if (depth > max) max = depth;
    if (depth > MAX_DEPTH) break;
    const children = (node as { content?: unknown })?.content;
    if (Array.isArray(children)) for (const child of children) stack.push([child, depth + 1]);
  }
  return max;
}

// Depth is checked first, without recursion, so a deeply nested body cannot
// exhaust the stack while the recursive schema below parses it.
export const editorDoc: z.ZodType<EditorDoc, z.ZodTypeDef, unknown> = z
  .unknown()
  .refine((value) => depthOf(value) <= MAX_DEPTH, { message: `Nested deeper than ${MAX_DEPTH} levels` })
  .pipe(z.object({ type: z.literal("doc"), content: z.array(editorNode).optional() }));

// The flags the server keeps. The words, the title and the language are part of the piece's
// Yjs document and are written by syncing (see sync.ts), so they merge across devices.
export const updatePieceInput = z
  .object({
    status: pieceStatus,
    isFragment: z.boolean(),
    includeInMemory: z.boolean()
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, { message: "Nothing to update" });
export type UpdatePieceInput = z.infer<typeof updatePieceInput>;

export const piece = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  content: editorDoc,
  text: z.string(),
  status: pieceStatus,
  language: pieceLanguage.nullable(),
  style: pieceStyle.nullable(),
  isFragment: z.boolean(),
  includeInMemory: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type Piece = z.infer<typeof piece>;

// Lists leave out the editor document; `text` is enough to show and search a piece.
export type PieceSummary = Omit<Piece, "content">;

export const listPiecesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional()
});
export type ListPiecesQuery = z.infer<typeof listPiecesQuery>;

export type ListPiecesResponse = { items: PieceSummary[]; nextCursor: string | null };

// The writer's whole library in one light list (no paging): each piece's first two lines,
// newest first. Seasons are worked out on the device from `createdAt`.
export type LibraryItem = Pick<Piece, "id" | "title" | "status" | "language" | "style" | "isFragment" | "createdAt" | "updatedAt"> & {
  lines: string[];
};
export type LibraryResponse = { items: LibraryItem[] };

export const searchQuery = z.object({ q: z.string().trim().min(1).max(200) });
export type SearchQuery = z.infer<typeof searchQuery>;

/** A line of the writer's own words, with the found words marked as [start, end) offsets. */
export type MarkedLine = { text: string; marks: [number, number][] };
export type SearchResult = Pick<Piece, "id" | "language" | "style" | "isFragment" | "createdAt" | "updatedAt"> & {
  firstLine: MarkedLine;
  /** The line the words were found in, when it is not the first line. */
  match: MarkedLine | null;
};
export type SearchResponse = {
  /** Pieces holding the typed words. */
  items: SearchResult[];
  /** Pieces without those words that are close in meaning; never also in `items`, with no matched line. */
  close: SearchResult[];
};

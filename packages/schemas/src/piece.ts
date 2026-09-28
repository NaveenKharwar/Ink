import { z } from "zod";

export const pieceStatus = z.enum(["draft", "finished"]);
export type PieceStatus = z.infer<typeof pieceStatus>;

export const pieceLanguage = z.enum(["hi", "hi-Latn", "en", "mixed"]);
export type PieceLanguage = z.infer<typeof pieceLanguage>;

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

export const createPieceInput = z.object({
  // Set by the client so a piece written offline keeps its id when it syncs.
  id: z.string().uuid().optional(),
  title: z.string().trim().max(200).optional(),
  content: editorDoc,
  status: pieceStatus.default("draft"),
  language: pieceLanguage.optional(),
  isFragment: z.boolean().default(false),
  includeInMemory: z.boolean().default(true)
});
export type CreatePieceInput = z.infer<typeof createPieceInput>;

export const updatePieceInput = z
  .object({
    title: z.string().trim().max(200).nullable(),
    content: editorDoc,
    status: pieceStatus,
    language: pieceLanguage.nullable(),
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

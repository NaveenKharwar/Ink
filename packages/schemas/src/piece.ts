import { z } from "zod";

export const pieceStatus = z.enum(["draft", "finished"]);
export type PieceStatus = z.infer<typeof pieceStatus>;

export const pieceLanguage = z.enum(["hi", "hi-Latn", "en", "mixed"]);
export type PieceLanguage = z.infer<typeof pieceLanguage>;

export const createPieceInput = z.object({
  title: z.string().trim().max(200).optional(),
  body: z.string().min(1),
  status: pieceStatus.default("draft"),
  language: pieceLanguage.optional(),
  isFragment: z.boolean().default(false),
  includeInMemory: z.boolean().default(true)
});
export type CreatePieceInput = z.infer<typeof createPieceInput>;

export const updatePieceInput = createPieceInput.partial();
export type UpdatePieceInput = z.infer<typeof updatePieceInput>;

export const piece = createPieceInput.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type Piece = z.infer<typeof piece>;

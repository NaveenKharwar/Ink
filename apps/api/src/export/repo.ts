import { META_FIELD, pieceCover, type ExportPiece } from "@ink/schemas";
import type pg from "pg";
import * as Y from "yjs";

export type ExportPage = { items: ExportPiece[]; next: { updatedAt: string; id: string } | null };

/** The writer's pieces with everything a download needs, newest first, a page at a time. */
export interface ExportRepo {
  page(userId: string, options: { limit: number; after?: { updatedAt: string; id: string } }): Promise<ExportPage>;
}

/** The cover lives in the piece's Yjs settings, next to the title. */
export function coverOf(ydoc: Uint8Array): string | null {
  if (ydoc.length === 0) return null;
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, ydoc);
    const cover = pieceCover.safeParse(doc.getMap(META_FIELD).get("cover"));
    return cover.success ? cover.data.id : null;
  } catch {
    return null;
  } finally {
    doc.destroy();
  }
}

type Row = {
  id: string;
  title: string | null;
  status: ExportPiece["status"];
  style: ExportPiece["style"];
  content: ExportPiece["content"];
  ydoc: Buffer;
  created_at: Date;
  updated_at: Date;
  updated_at_raw: string;
};

export function pgExportRepo(db: pg.Pool): ExportRepo {
  return {
    async page(userId, { limit, after }) {
      // Keyset pagination on (updated_at, id), as the piece list does.
      const { rows } = await db.query<Row>(
        `select id, title, status, style, content, ydoc, created_at, updated_at, updated_at::text as updated_at_raw
         from pieces
         where user_id = $1
           and ($2::timestamptz is null or (updated_at, id) < ($2::timestamptz, $3::uuid))
         order by updated_at desc, id desc
         limit $4`,
        [userId, after?.updatedAt ?? null, after?.id ?? null, limit + 1]
      );
      const page = rows.slice(0, limit);
      const last = page[page.length - 1];
      return {
        items: page.map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          style: row.style,
          content: row.content,
          cover: coverOf(row.ydoc),
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString()
        })),
        next: rows.length > limit && last ? { updatedAt: last.updated_at_raw, id: last.id } : null
      };
    }
  };
}

/** Kept in memory: for tests. */
export function memoryExportRepo(pieces: Array<ExportPiece & { userId: string }> = []): ExportRepo {
  return {
    async page(userId, { limit, after }) {
      const mine = pieces
        .filter((p) => p.userId === userId)
        .sort((a, b) => (a.updatedAt === b.updatedAt ? b.id.localeCompare(a.id) : b.updatedAt.localeCompare(a.updatedAt)))
        .filter((p) => !after || p.updatedAt < after.updatedAt || (p.updatedAt === after.updatedAt && p.id < after.id));
      const page = mine.slice(0, limit).map(({ userId: _, ...piece }) => piece);
      const last = page[page.length - 1];
      return { items: page, next: mine.length > limit && last ? { updatedAt: last.updatedAt, id: last.id } : null };
    }
  };
}

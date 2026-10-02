import type { PictureSummary } from "@ink/schemas";
import type pg from "pg";
import { isLoose, searchText } from "../pieces/fold.js";
import { withoutPicture } from "../pieces/merge.js";
import type { PictureType } from "./store.js";

export type PictureUse = { id: string; title: string | null; text: string };

/** The list of each writer's pictures (the bytes are in the PictureStore). Every query names the writer. */
export interface PicturesRepo {
  add(userId: string, id: string, picture: { type: PictureType; bytes: number; preview: string | null }): Promise<void>;
  list(userId: string): Promise<PictureSummary[]>;
  /** The writer's pieces that use the picture (cover or text), newest first. */
  uses(userId: string, id: string): Promise<PictureUse[]>;
  /** Takes the picture out of every piece that uses it and forgets it. False if it wasn't the writer's. */
  remove(userId: string, id: string): Promise<boolean>;
}

export const PICTURE_LIST_LIMIT = 2000;

type Row = { id: string; type: PictureType; bytes: number; preview: string | null; created_at: Date };

export function pgPicturesRepo(db: pg.Pool): PicturesRepo {
  return {
    async add(userId, id, picture) {
      // A retried upload of the same picture just updates its row.
      await db.query(
        `insert into pictures (user_id, id, type, bytes, preview) values ($1, $2, $3, $4, $5)
         on conflict (user_id, id) do update set type = excluded.type, bytes = excluded.bytes, preview = excluded.preview`,
        [userId, id, picture.type, picture.bytes, picture.preview]
      );
    },

    async list(userId) {
      const { rows } = await db.query<Row>(
        `select id, type, bytes, preview, created_at from pictures where user_id = $1 order by created_at desc, id desc limit $2`,
        [userId, PICTURE_LIST_LIMIT]
      );
      return rows.map((row) => ({ id: row.id, type: row.type, bytes: row.bytes, preview: row.preview, createdAt: row.created_at.toISOString() }));
    },

    async uses(userId, id) {
      const { rows } = await db.query<PictureUse>(
        `select id, title, left(text, 300) as text from pieces
         where user_id = $1 and $2::uuid = any(picture_ids)
         order by updated_at desc`,
        [userId, id]
      );
      return rows;
    },

    async remove(userId, id) {
      const client = await db.connect();
      try {
        await client.query("begin");
        const { rows } = await client.query<{ id: string; ydoc: Buffer }>(
          `select id, ydoc from pieces where user_id = $1 and $2::uuid = any(picture_ids) for update`,
          [userId, id]
        );
        for (const piece of rows) {
          const merged = withoutPicture(piece.ydoc, id);
          if (!merged) continue;
          await client.query(
            `update pieces set ydoc = $3, content = $4::jsonb, text = $5, title = $6, language = $7, style = $8,
               search_text = $9, picture_ids = $10::uuid[]
             where id = $1 and user_id = $2`,
            [
              piece.id,
              userId,
              Buffer.from(merged.state),
              JSON.stringify(merged.content),
              merged.text,
              merged.meta.title,
              merged.meta.language,
              merged.meta.style,
              searchText(merged.meta.title, merged.text, isLoose(merged.meta.language)),
              merged.pictureIds
            ]
          );
        }
        const deleted = await client.query("delete from pictures where user_id = $1 and id = $2", [userId, id]);
        await client.query("commit");
        return (deleted.rowCount ?? 0) > 0 || rows.length > 0;
      } catch (err) {
        await client.query("rollback").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    }
  };
}

/** Kept in memory, for tests. `uses` holds which pieces use which picture ("userId/pictureId"). */
export function memoryPicturesRepo(uses = new Map<string, PictureUse[]>()): PicturesRepo {
  const rows = new Map<string, PictureSummary & { userId: string }>();
  let clock = Date.parse("2026-09-30T10:00:00.000Z");
  return {
    async add(userId, id, picture) {
      const key = `${userId}/${id}`;
      const createdAt = rows.get(key)?.createdAt ?? new Date((clock += 1000)).toISOString();
      rows.set(key, { userId, id, type: picture.type, bytes: picture.bytes, preview: picture.preview, createdAt });
    },
    async list(userId) {
      return [...rows.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ userId: _u, ...row }) => row);
    },
    async uses(userId, id) {
      return uses.get(`${userId}/${id}`) ?? [];
    },
    async remove(userId, id) {
      const key = `${userId}/${id}`;
      const found = rows.delete(key) || uses.has(key);
      uses.delete(key);
      return found;
    }
  };
}

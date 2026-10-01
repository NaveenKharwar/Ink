import type pg from "pg";

/** What the worker needs to know about a piece. The worker acts for the system, so it names the piece's own writer. */
export type EmbeddableRow = { userId: string; title: string | null; text: string; includeInMemory: boolean; storedHash: string | null };

export interface EmbeddingsRepo {
  /** Null when the piece no longer exists. */
  load(pieceId: string): Promise<EmbeddableRow | null>;
  save(pieceId: string, userId: string, model: string, vector: number[], hash: string): Promise<void>;
  remove(pieceId: string): Promise<void>;
  /** Marks a vector as checked against the current text, without changing it. */
  touch(pieceId: string): Promise<void>;
  /** Pieces that should have a vector but have none, or were edited after theirs was made. Newest first. */
  findStale(limit: number): Promise<string[]>;
}

export function pgEmbeddingsRepo(db: pg.Pool): EmbeddingsRepo {
  return {
    async load(pieceId) {
      const { rows } = await db.query<{ user_id: string; title: string | null; text: string; include_in_memory: boolean; text_hash: string | null }>(
        `select p.user_id, p.title, p.text, p.include_in_memory, e.text_hash
           from pieces p left join piece_embeddings e on e.piece_id = p.id
          where p.id = $1`,
        [pieceId]
      );
      const row = rows[0];
      return row ? { userId: row.user_id, title: row.title, text: row.text, includeInMemory: row.include_in_memory, storedHash: row.text_hash } : null;
    },
    async save(pieceId, userId, model, vector, hash) {
      await db.query(
        `insert into piece_embeddings (piece_id, user_id, model, embedding, text_hash)
         values ($1, $2, $3, $4::extensions.vector, $5)
         on conflict (piece_id) do update
           set model = excluded.model, embedding = excluded.embedding, text_hash = excluded.text_hash, embedded_at = now()`,
        [pieceId, userId, model, JSON.stringify(vector), hash]
      );
    },
    async remove(pieceId) {
      await db.query("delete from piece_embeddings where piece_id = $1", [pieceId]);
    },
    async touch(pieceId) {
      await db.query("update piece_embeddings set embedded_at = now() where piece_id = $1", [pieceId]);
    },
    async findStale(limit) {
      // The 2 minute margin keeps a piece that was just embedded from counting as stale.
      const { rows } = await db.query<{ id: string }>(
        `select p.id
           from pieces p left join piece_embeddings e on e.piece_id = p.id
          where p.include_in_memory and btrim(p.text) <> ''
            and (e.piece_id is null or p.updated_at > e.embedded_at + interval '2 minutes')
          order by p.updated_at desc
          limit $1`,
        [limit]
      );
      return rows.map((r) => r.id);
    }
  };
}

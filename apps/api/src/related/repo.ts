import type pg from "pg";
import type { PiecesRepo } from "../pieces/repo.js";
import type { Candidate } from "./rank.js";

/** The writer's pieces the panel can choose from. Every query names the writer. */
export interface RelatedRepo {
  /**
   * The piece and the writer's other pieces, without the ones dismissed beside it and without
   * pieces kept out of memory. Null when the piece is not the writer's.
   */
  candidates(userId: string, pieceId: string): Promise<{ current: Candidate; others: Candidate[] } | null>;
  /** The id of the writer's most recently edited piece that has words and counts for memory, if any. */
  latest(userId: string): Promise<string | null>;
  /** Records that Forgotten returned these pieces beside `pieceId`. Only the writer's own pieces are recorded. */
  markShown(userId: string, pieceId: string, shownIds: string[]): Promise<void>;
  /** Hides `otherId` beside `pieceId` (and the other way round) for good. False if either isn't the writer's. */
  dismiss(userId: string, pieceId: string, otherId: string): Promise<boolean>;
  /** Undoes a dismissal. False if either isn't the writer's. */
  restore(userId: string, pieceId: string, otherId: string): Promise<boolean>;
}

export const CANDIDATE_LIMIT = 1000;

type Row = {
  id: string;
  title: string | null;
  text: string;
  language: Candidate["language"];
  style: Candidate["style"];
  include_in_memory: boolean;
  created_at: Date;
  updated_at: Date;
  similarity?: number | null;
  shown_at?: Date | null;
  shown_for?: string | null;
};

const COLUMNS = "id, title, left(text, 5000) as text, language, style, include_in_memory, created_at, updated_at";

const toCandidate = (row: Row): Candidate => ({
  id: row.id,
  title: row.title,
  text: row.text,
  language: row.language,
  style: row.style,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  similarity: row.similarity ?? null,
  shownAt: row.shown_at?.toISOString() ?? null,
  shownFor: row.shown_for ?? null
});

export function pgRelatedRepo(db: pg.Pool): RelatedRepo {
  const bothAreTheirs = async (userId: string, a: string, b: string) => {
    if (a === b) return false;
    const { rows } = await db.query<{ n: string }>("select count(*) as n from pieces where user_id = $1 and id = any($2::uuid[])", [
      userId,
      [a, b]
    ]);
    return Number(rows[0]?.n) === 2;
  };

  return {
    async latest(userId) {
      const { rows } = await db.query<{ id: string }>(
        "select id from pieces where user_id = $1 and include_in_memory and btrim(text) <> '' order by updated_at desc, id desc limit 1",
        [userId]
      );
      return rows[0]?.id ?? null;
    },

    async candidates(userId, pieceId) {
      const { rows: mine } = await db.query<Row>(`select ${COLUMNS} from pieces where id = $1 and user_id = $2`, [pieceId, userId]);
      if (!mine[0]) return null;
      const current = toCandidate(mine[0]);
      if (!mine[0].include_in_memory) return { current, others: [] };
      // Similarity is null when either piece has no vector yet; those fall back to shared words.
      const cols = "p.id, p.title, left(p.text, 5000) as text, p.language, p.style, p.include_in_memory, p.created_at, p.updated_at";
      const { rows } = await db.query<Row>(
        `select ${cols},
                1 - (e.embedding operator(extensions.<=>) c.embedding) as similarity,
                f.shown_at, f.shown_for
         from pieces p
         left join forgotten_shown f on f.piece_id = p.id and f.user_id = $1
         left join piece_embeddings e on e.piece_id = p.id and e.user_id = $1
         left join piece_embeddings c on c.piece_id = $2 and c.user_id = $1
         where p.user_id = $1 and p.id <> $2 and p.include_in_memory and btrim(p.text) <> ''
           and not exists (
             select 1 from related_dismissals d where d.user_id = $1 and d.piece_id = $2 and d.other_id = p.id
           )
         order by p.updated_at desc, p.id desc
         limit $3`,
        [userId, pieceId, CANDIDATE_LIMIT]
      );
      return { current, others: rows.map(toCandidate) };
    },

    async markShown(userId, pieceId, shownIds) {
      if (shownIds.length === 0) return;
      await db.query(
        `insert into forgotten_shown (user_id, piece_id, shown_for)
         select $1, p.id, $2 from pieces p
         where p.user_id = $1 and p.id = any($3::uuid[]) and exists (select 1 from pieces where id = $2 and user_id = $1)
         on conflict (user_id, piece_id) do update set shown_for = excluded.shown_for, shown_at = now()`,
        [userId, pieceId, shownIds]
      );
    },

    async dismiss(userId, pieceId, otherId) {
      if (!(await bothAreTheirs(userId, pieceId, otherId))) return false;
      await db.query(
        `insert into related_dismissals (user_id, piece_id, other_id)
         values ($1, $2, $3), ($1, $3, $2)
         on conflict do nothing`,
        [userId, pieceId, otherId]
      );
      return true;
    },

    async restore(userId, pieceId, otherId) {
      if (!(await bothAreTheirs(userId, pieceId, otherId))) return false;
      await db.query(
        `delete from related_dismissals
         where user_id = $1 and ((piece_id = $2 and other_id = $3) or (piece_id = $3 and other_id = $2))`,
        [userId, pieceId, otherId]
      );
      return true;
    }
  };
}

/** For tests: the same behaviour over a PiecesRepo, kept in memory. */
export function memoryRelatedRepo(pieces: PiecesRepo, vectors: Map<string, number[]> = new Map()): RelatedRepo {
  const cosine = (a: number[], b: number[]) => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i]! * b[i]!; na += a[i]! ** 2; nb += b[i]! ** 2; }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  };
  const hidden = new Set<string>();
  const shown = new Map<string, { at: string; for: string }>();
  const key = (userId: string, a: string, b: string) => `${userId}|${a}|${b}`;
  const toCandidate = (p: { id: string; title: string | null; text: string; language: Candidate["language"]; style: Candidate["style"]; createdAt: string; updatedAt: string }): Candidate => ({
    id: p.id, title: p.title, text: p.text, language: p.language, style: p.style, createdAt: p.createdAt, updatedAt: p.updatedAt
  });
  const bothAreTheirs = async (userId: string, a: string, b: string) =>
    a !== b && !!(await pieces.get(userId, a)) && !!(await pieces.get(userId, b));

  return {
    async latest(userId) {
      const all = await pieces.library(userId);
      const newest = all
        .filter((p) => p.includeInMemory && p.text.trim() !== "")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      return newest?.id ?? null;
    },
    async candidates(userId, pieceId) {
      const mine = await pieces.get(userId, pieceId);
      if (!mine) return null;
      const all = await pieces.library(userId);
      const others = all
        .filter((p) => p.id !== pieceId && p.includeInMemory && p.text.trim() !== "" && !hidden.has(key(userId, pieceId, p.id)))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((p) => {
          const a = vectors.get(pieceId), b = vectors.get(p.id);
          const seen = shown.get(`${userId}|${p.id}`);
          return { ...toCandidate(p), similarity: a && b ? cosine(a, b) : null, shownAt: seen?.at ?? null, shownFor: seen?.for ?? null };
        });
      return { current: toCandidate(mine), others: mine.includeInMemory ? others : [] };
    },
    async markShown(userId, pieceId, shownIds) {
      for (const id of shownIds) shown.set(`${userId}|${id}`, { at: new Date().toISOString(), for: pieceId });
    },
    async dismiss(userId, pieceId, otherId) {
      if (!(await bothAreTheirs(userId, pieceId, otherId))) return false;
      hidden.add(key(userId, pieceId, otherId));
      hidden.add(key(userId, otherId, pieceId));
      return true;
    },
    async restore(userId, pieceId, otherId) {
      if (!(await bothAreTheirs(userId, pieceId, otherId))) return false;
      hidden.delete(key(userId, pieceId, otherId));
      hidden.delete(key(userId, otherId, pieceId));
      return true;
    }
  };
}

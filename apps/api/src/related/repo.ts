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
};

const COLUMNS = "id, title, left(text, 5000) as text, language, style, include_in_memory, created_at, updated_at";

const toCandidate = (row: Row): Candidate => ({
  id: row.id,
  title: row.title,
  text: row.text,
  language: row.language,
  style: row.style,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString()
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
    async candidates(userId, pieceId) {
      const { rows: mine } = await db.query<Row>(`select ${COLUMNS} from pieces where id = $1 and user_id = $2`, [pieceId, userId]);
      if (!mine[0]) return null;
      const current = toCandidate(mine[0]);
      if (!mine[0].include_in_memory) return { current, others: [] };
      const { rows } = await db.query<Row>(
        `select ${COLUMNS}
         from pieces p
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
export function memoryRelatedRepo(pieces: PiecesRepo): RelatedRepo {
  const hidden = new Set<string>();
  const key = (userId: string, a: string, b: string) => `${userId}|${a}|${b}`;
  const toCandidate = (p: { id: string; title: string | null; text: string; language: Candidate["language"]; style: Candidate["style"]; createdAt: string; updatedAt: string }): Candidate => ({
    id: p.id, title: p.title, text: p.text, language: p.language, style: p.style, createdAt: p.createdAt, updatedAt: p.updatedAt
  });
  const bothAreTheirs = async (userId: string, a: string, b: string) =>
    a !== b && !!(await pieces.get(userId, a)) && !!(await pieces.get(userId, b));

  return {
    async candidates(userId, pieceId) {
      const mine = await pieces.get(userId, pieceId);
      if (!mine) return null;
      const all = await pieces.library(userId);
      const others = all
        .filter((p) => p.id !== pieceId && p.includeInMemory && p.text.trim() !== "" && !hidden.has(key(userId, pieceId, p.id)))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(toCandidate);
      return { current: toCandidate(mine), others: mine.includeInMemory ? others : [] };
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

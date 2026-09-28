import type { CreatePieceInput, Piece, PieceSummary, UpdatePieceInput } from "@ink/schemas";
import type pg from "pg";

export type NewPiece = CreatePieceInput & { text: string };
export type PiecePatch = UpdatePieceInput & { text?: string };
export type ListPage = { items: PieceSummary[]; next: { updatedAt: string; id: string } | null };

export interface PiecesRepo {
  /** Inserts the piece. Returns null when a piece with that id already exists. */
  create(userId: string, input: NewPiece): Promise<Piece | null>;
  list(userId: string, options: { limit: number; after?: { updatedAt: string; id: string } }): Promise<ListPage>;
  get(userId: string, id: string): Promise<Piece | null>;
  update(userId: string, id: string, patch: PiecePatch): Promise<Piece | null>;
}

type PieceRow = {
  id: string;
  title: string | null;
  content?: Piece["content"];
  text: string;
  status: Piece["status"];
  language: Piece["language"];
  is_fragment: boolean;
  include_in_memory: boolean;
  created_at: Date;
  updated_at: Date;
  updated_at_raw?: string;
};

const SUMMARY_COLUMNS = "id, title, text, status, language, is_fragment, include_in_memory, created_at, updated_at";
const COLUMNS = `${SUMMARY_COLUMNS}, content`;

function toSummary(row: PieceRow): PieceSummary {
  return {
    id: row.id,
    title: row.title,
    text: row.text,
    status: row.status,
    language: row.language,
    isFragment: row.is_fragment,
    includeInMemory: row.include_in_memory,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toPiece(row: PieceRow): Piece {
  return { ...toSummary(row), content: row.content ?? { type: "doc" } };
}

// Patch field → column. Only these can be written by an update.
const PATCH_COLUMNS = {
  title: "title",
  content: "content",
  text: "text",
  status: "status",
  language: "language",
  isFragment: "is_fragment",
  includeInMemory: "include_in_memory"
} as const satisfies Record<keyof PiecePatch, string>;

export function pgPiecesRepo(db: pg.Pool): PiecesRepo {
  return {
    async create(userId, input) {
      const { rows } = await db.query<PieceRow>(
        `insert into pieces (id, user_id, title, content, text, status, language, is_fragment, include_in_memory)
         values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
         on conflict (id) do nothing
         returning ${COLUMNS}`,
        [
          input.id ?? null,
          userId,
          input.title || null,
          JSON.stringify(input.content),
          input.text,
          input.status,
          input.language ?? null,
          input.isFragment,
          input.includeInMemory
        ]
      );
      return rows[0] ? toPiece(rows[0]) : null;
    },

    async list(userId, { limit, after }) {
      // Keyset pagination on (updated_at, id), newest first. The cursor keeps
      // Postgres' own timestamp text so microseconds are not lost.
      const { rows } = await db.query<PieceRow>(
        `select ${SUMMARY_COLUMNS}, updated_at::text as updated_at_raw
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
        items: page.map(toSummary),
        next: rows.length > limit && last ? { updatedAt: last.updated_at_raw!, id: last.id } : null
      };
    },

    async get(userId, id) {
      const { rows } = await db.query<PieceRow>(`select ${COLUMNS} from pieces where id = $1 and user_id = $2`, [
        id,
        userId
      ]);
      return rows[0] ? toPiece(rows[0]) : null;
    },

    async update(userId, id, patch) {
      const sets: string[] = [];
      const values: unknown[] = [id, userId];
      for (const [key, column] of Object.entries(PATCH_COLUMNS) as [keyof PiecePatch, string][]) {
        const value = patch[key];
        if (value === undefined) continue;
        values.push(key === "content" ? JSON.stringify(value) : key === "title" && value === "" ? null : value);
        sets.push(`${column} = $${values.length}${key === "content" ? "::jsonb" : ""}`);
      }
      const { rows } = await db.query<PieceRow>(
        `update pieces set ${[...sets, "updated_at = now()"].join(", ")}
         where id = $1 and user_id = $2
         returning ${COLUMNS}`,
        values
      );
      return rows[0] ? toPiece(rows[0]) : null;
    }
  };
}

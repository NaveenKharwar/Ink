import type { Piece, PieceSummary, UpdatePieceInput } from "@ink/schemas";
import type pg from "pg";
import type { SearchWords } from "./fold.js";
import { isLoose, searchText } from "./fold.js";
import { mergeYdoc } from "./merge.js";

export type PiecePatch = UpdatePieceInput;
export type SyncRequest = { update: Uint8Array | null; stateVector: Uint8Array };
export type SyncOutcome = { piece: PieceSummary; update: Uint8Array; stateVector: Uint8Array };
export type ListPage = { items: PieceSummary[]; next: { updatedAt: string; id: string } | null };

export interface PiecesRepo {
  /**
   * Merges the writer's changes into the piece (creating it on the first sync) and
   * returns what the writer is missing. Null when the piece is someone else's, or
   * does not exist and there is nothing to create it from.
   */
  sync(userId: string, id: string, request: SyncRequest): Promise<SyncOutcome | null>;
  list(userId: string, options: { limit: number; after?: { updatedAt: string; id: string } }): Promise<ListPage>;
  get(userId: string, id: string): Promise<Piece | null>;
  update(userId: string, id: string, patch: PiecePatch): Promise<Piece | null>;
  /** Every piece of the writer's, newest first; `text` may be cut short (lists show two lines). */
  library(userId: string): Promise<PieceSummary[]>;
  /** The writer's pieces holding every searched word, best first (see fold.ts). */
  search(userId: string, words: SearchWords, limit: number): Promise<PieceSummary[]>;
}

export const LIBRARY_LIMIT = 5000;

type PieceRow = {
  id: string;
  title: string | null;
  content?: Piece["content"];
  text: string;
  status: Piece["status"];
  language: Piece["language"];
  style: Piece["style"];
  is_fragment: boolean;
  include_in_memory: boolean;
  created_at: Date;
  updated_at: Date;
  updated_at_raw?: string;
};

const SUMMARY_COLUMNS = "id, title, text, status, language, style, is_fragment, include_in_memory, created_at, updated_at";
const COLUMNS = `${SUMMARY_COLUMNS}, content`;

function toSummary(row: PieceRow): PieceSummary {
  return {
    id: row.id,
    title: row.title,
    text: row.text,
    status: row.status,
    language: row.language,
    style: row.style,
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
  status: "status",
  isFragment: "is_fragment",
  includeInMemory: "include_in_memory"
} as const satisfies Record<keyof PiecePatch, string>;

export function pgPiecesRepo(db: pg.Pool): PiecesRepo {
  return {
    async sync(userId, id, request) {
      const client = await db.connect();
      try {
        await client.query("begin");
        // Only a writer with something to write creates a piece. If the id is already
        // someone else's, nothing is inserted and the select below finds nothing.
        if (request.update) {
          await client.query(
            `insert into pieces (id, user_id, content, text, ydoc)
             values ($1, $2, '{"type":"doc"}'::jsonb, '', ''::bytea)
             on conflict (id) do nothing`,
            [id, userId]
          );
        }
        const { rows } = await client.query<{ ydoc: Buffer }>(
          "select ydoc from pieces where id = $1 and user_id = $2 for update",
          [id, userId]
        );
        if (!rows[0]) {
          await client.query("rollback");
          return null;
        }
        const merged = mergeYdoc(rows[0].ydoc, request.update, request.stateVector);

        const values: unknown[] = [id, userId];
        const sets: string[] = [];
        const set = (column: string, value: unknown, cast = "") => {
          values.push(value);
          sets.push(`${column} = $${values.length}${cast}`);
        };
        if (request.update) {
          set("ydoc", Buffer.from(merged.state));
          set("content", JSON.stringify(merged.content), "::jsonb");
          set("text", merged.text);
          // Title, language and style are part of the document; these columns are copies.
          set("title", merged.meta.title);
          set("language", merged.meta.language);
          set("style", merged.meta.style);
          set("search_text", searchText(merged.meta.title, merged.text, isLoose(merged.meta.language)));
          set("picture_ids", merged.pictureIds, "::uuid[]");
          // Writing in a finished piece reopens it: the writer has no control for that.
          sets.push("status = 'draft'");
        }
        if (sets.length) sets.push("updated_at = now()");

        const { rows: out } = sets.length
          ? await client.query<PieceRow>(
              `update pieces set ${sets.join(", ")} where id = $1 and user_id = $2 returning ${SUMMARY_COLUMNS}`,
              values
            )
          : await client.query<PieceRow>(`select ${SUMMARY_COLUMNS} from pieces where id = $1 and user_id = $2`, [id, userId]);
        await client.query("commit");
        return { piece: toSummary(out[0]!), update: merged.diff, stateVector: merged.stateVector };
      } catch (err) {
        await client.query("rollback").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
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

    async library(userId) {
      // Only the start of the words: a list shows each piece's first two lines.
      const { rows } = await db.query<PieceRow>(
        `select id, title, left(text, 1000) as text, status, language, style, is_fragment, include_in_memory, created_at, updated_at
         from pieces
         where user_id = $1
         order by created_at desc, id desc
         limit $2`,
        [userId, LIBRARY_LIMIT]
      );
      return rows.map(toSummary);
    },

    async search(userId, words, limit) {
      // Every word must be in one of the two copies: (evened words) OR (loose Latin words).
      // Pieces labelled English only count by their exact words: the loose side is not enough for them.
      // Each side is escaped, so nothing the writer types is read as query syntax.
      const { rows } = await db.query<PieceRow>(
        `select ${SUMMARY_COLUMNS}
         from pieces
         where user_id = $1
           and search_text operator(extensions.&@~) (
             '(' || extensions.pgroonga_query_escape($2) || ') OR (' || extensions.pgroonga_query_escape($3) || ')'
           )
           and (language is distinct from 'en' or search_text operator(extensions.&@~) extensions.pgroonga_query_escape($2))
         order by extensions.pgroonga_score(tableoid, ctid) desc, updated_at desc
         limit $4`,
        [userId, words.even.join(" "), words.latin.filter(Boolean).join(" ") || words.even.join(" "), limit]
      );
      return rows.map(toSummary);
    },

    async update(userId, id, patch) {
      const sets: string[] = [];
      const values: unknown[] = [id, userId];
      for (const [key, column] of Object.entries(PATCH_COLUMNS) as [keyof PiecePatch, string][]) {
        const value = patch[key];
        if (value === undefined) continue;
        values.push(value);
        sets.push(`${column} = $${values.length}`);
      }
      // Only a change to the writing's own flags counts as a touch; marking a piece finished or
      // reopening it leaves "last edited" alone, so Forgotten does not start over.
      if (Object.entries(patch).some(([key, value]) => key !== "status" && value !== undefined)) sets.push("updated_at = now()");
      const { rows } = await db.query<PieceRow>(
        `update pieces set ${sets.join(", ")}
         where id = $1 and user_id = $2
         returning ${COLUMNS}`,
        values
      );
      return rows[0] ? toPiece(rows[0]) : null;
    }
  };
}

import type { PieceSummary } from "@ink/schemas";
import type pg from "pg";
import type { EmbeddingProvider } from "../embeddings/provider.js";
import type { PiecesRepo } from "../pieces/repo.js";

/** Search by meaning: the embedder turns the words into a vector, the repo finds the writer's closest pieces. */
export type Meaning = { repo: MeaningRepo; embedder: EmbeddingProvider };

/**
 * How close a piece must be to the typed words to count as close in meaning. Higher than Related's floor:
 * a word or two gives the model little to go on, so everything scores 0.45–0.5 ("table" finds "Hello, this is
 * a poem"), while real matches for "rain" score 0.53–0.61. A guess from one archive; retune on more writing.
 */
export const MIN_CLOSE_SIMILARITY = 0.53;

/**
 * Pieces shorter than this stay out of meaning search. A few letters of nothing ("sdadsad") sit
 * closer to a short query than real writing does, and BGE-M3 cannot tell them apart.
 */
export const MIN_WORDS = 4;

export type CloseRow = Pick<PieceSummary, "id" | "text" | "language" | "style" | "isFragment" | "createdAt" | "updatedAt">;

export interface MeaningRepo {
  /**
   * The writer's pieces closest to `vector`, closest first, at least `minSimilarity` close, leaving out
   * `exclude`, pieces kept out of memory, pieces under MIN_WORDS words and Hinglish pieces (the model can't
   * read Hindi in Latin letters, so those are found by their words only). Pieces without a vector yet are never returned.
   */
  closeTo(userId: string, vector: number[], exclude: string[], minSimilarity: number, limit: number): Promise<CloseRow[]>;
}

type Row = {
  id: string;
  text: string;
  language: CloseRow["language"];
  style: CloseRow["style"];
  is_fragment: boolean;
  created_at: Date;
  updated_at: Date;
};

export function pgMeaningRepo(db: pg.Pool): MeaningRepo {
  return {
    async closeTo(userId, vector, exclude, minSimilarity, limit) {
      // Every query names the writer: the vector row and the piece must both be theirs.
      const { rows } = await db.query<Row>(
        `select p.id, left(p.text, 1000) as text, p.language, p.style, p.is_fragment, p.created_at, p.updated_at
         from piece_embeddings e
         join pieces p on p.id = e.piece_id and p.user_id = $1
         where e.user_id = $1 and p.include_in_memory and p.language <> 'hi-Latn'
           and cardinality(regexp_split_to_array(btrim(p.text), '\\s+')) >= $6
           and p.id <> all($2::uuid[])
           and 1 - (e.embedding operator(extensions.<=>) $3::extensions.vector) >= $4
         order by e.embedding operator(extensions.<=>) $3::extensions.vector
         limit $5`,
        [userId, exclude, JSON.stringify(vector), minSimilarity, limit, MIN_WORDS]
      );
      return rows.map((row) => ({
        id: row.id,
        text: row.text,
        language: row.language,
        style: row.style,
        isFragment: row.is_fragment,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      }));
    }
  };
}

/** For tests: the same behaviour over a PiecesRepo, embedding each piece's words on the spot. */
export function memoryMeaningRepo(pieces: PiecesRepo, embedder: EmbeddingProvider): MeaningRepo {
  const cosine = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i]!, 0);
  return {
    async closeTo(userId, vector, exclude, minSimilarity, limit) {
      const mine = (await pieces.library(userId)).filter((p) => p.includeInMemory && p.language !== "hi-Latn" && p.text.trim().split(/\s+/).length >= MIN_WORDS && !exclude.includes(p.id));
      const vectors = mine.length ? await embedder.embed(mine.map((p) => p.text)) : [];
      return mine
        .map((p, i) => ({ p, similarity: cosine(vector, vectors[i]!) }))
        .filter(({ similarity }) => similarity >= minSimilarity)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(({ p: { id, text, language, style, isFragment, createdAt, updatedAt } }) => ({ id, text, language, style, isFragment, createdAt, updatedAt }));
    }
  };
}

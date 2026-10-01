/** Turns text into meaning vectors. Providers sit behind this so the model can be swapped. */
export interface EmbeddingProvider {
  /** Which model made the vectors. Stored beside them, so a model change can be told apart. */
  readonly model: string;
  /** One vector per text, in order. Throws if the provider can't be reached. */
  embed(texts: string[]): Promise<number[][]>;
}

export const EMBEDDING_DIMENSIONS = 1024;

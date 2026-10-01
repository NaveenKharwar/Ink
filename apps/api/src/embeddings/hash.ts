import { createHash } from "node:crypto";

/** Tells the worker whether a piece's text changed since it was last embedded. */
export const textHash = (text: string): string => createHash("sha256").update(text).digest("hex");

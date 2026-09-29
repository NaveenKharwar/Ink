import { fromBase64, toBase64, type PieceLanguage, type SyncPieceInput, type SyncPieceOutput } from "@ink/schemas";
import * as Y from "yjs";
import { bufferKey, type Buffer } from "./buffer";

// What the page needs to show a piece that already exists.
export type OpenedPiece = {
  state: Uint8Array;
  // What the server was known to have, so the next send only carries what is newer.
  serverVector: Uint8Array | null;
  title: string | null;
  language: PieceLanguage;
};

export type OpenResult = { status: "ok"; piece: OpenedPiece } | { status: "missing" } | { status: "error" };

const NOTHING = Y.encodeStateVector(new Y.Doc());
const statusOf = (err: unknown) => (err as { status?: number })?.status;

/**
 * Loads a piece from the server and from this device (writing that has not been sent yet)
 * and merges the two. The device copy alone is enough when offline; the server copy alone
 * when nothing is waiting here. "Missing" means neither has it (or it is someone else's).
 */
export async function openPiece(
  buffer: Buffer,
  api: { sync(id: string, input: SyncPieceInput): Promise<SyncPieceOutput> },
  userId: string,
  id: string
): Promise<OpenResult> {
  // The device first: if writing is still waiting here, the server may not have it yet.
  let local;
  try {
    local = await buffer.get(bufferKey(userId, id));
  } catch {
    local = undefined;
  }

  let server: SyncPieceOutput | null = null;
  try {
    server = await api.sync(id, { stateVector: toBase64(NOTHING) });
  } catch (err) {
    if (!local) return statusOf(err) === 404 ? { status: "missing" } : { status: "error" };
    // Not on the server yet, or offline: the device copy is the piece.
  }

  if (!server && !local) return { status: "missing" };

  const doc = new Y.Doc();
  if (server) Y.applyUpdate(doc, fromBase64(server.update));
  if (local) Y.applyUpdate(doc, local.state);
  const state = Y.encodeStateAsUpdate(doc);
  doc.destroy();

  return {
    status: "ok",
    piece: {
      state,
      serverVector: server ? fromBase64(server.stateVector) : (local?.serverVector ?? null),
      // Unsent changes on this device are newer than what the server holds.
      title: local ? local.title : (server?.piece.title ?? null),
      language: local ? local.language : (server?.piece.language ?? "en")
    }
  };
}

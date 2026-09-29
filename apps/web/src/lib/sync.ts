import { fromBase64, toBase64, type SyncPieceInput, type SyncPieceOutput } from "@ink/schemas";
import * as Y from "yjs";
import type { Buffer, BufferedPiece } from "./buffer";

// The one call the sync needs; the real one is in api.ts.
export type SyncApi = { sync(id: string, input: SyncPieceInput): Promise<SyncPieceOutput> };

export type SyncResult = {
  // "failed" = try again later (offline, server trouble); "refused" = the server said no for good
  // (e.g. the piece is too large), so trying again won't help.
  status: "synced" | "gone" | "failed" | "refused";
  // What other devices wrote that this one was missing (Yjs data); apply it to the open piece.
  remote?: Uint8Array;
  // What the server has now.
  serverVector?: Uint8Array;
};

const NOTHING = Y.encodeStateVector(new Y.Doc());
const isEmpty = (update: Uint8Array) => update.length === 2 && update[0] === 0 && update[1] === 0;

// A 4xx answer is final, except for the ones that pass: signed out for a moment (401), too slow
// (408) or too many requests (429).
const RETRYABLE = new Set([401, 408, 429]);
export function isRefusal(err: unknown): boolean {
  const status = (err as { status?: unknown })?.status;
  return typeof status === "number" && status >= 400 && status < 500 && !RETRYABLE.has(status);
}

export function createSync(buffer: Buffer, api: SyncApi) {
  const inFlight = new Map<string, Promise<SyncResult>>();

  // Send what the server has not seen; get back what this device has not seen.
  async function send(piece: BufferedPiece) {
    const news = Y.diffUpdate(piece.state, piece.serverVector ?? NOTHING);
    const out = await api.sync(piece.id, {
      ...(isEmpty(news) ? {} : { update: toBase64(news) }),
      stateVector: toBase64(Y.encodeStateVectorFromUpdate(piece.state))
    });
    return { remote: fromBase64(out.update), serverVector: fromBase64(out.stateVector) };
  }

  // One request per piece at a time; a second caller waits for the first.
  // If the piece changed meanwhile, one more pass sends the newer version.
  function syncPiece(key: string): Promise<SyncResult> {
    const running = inFlight.get(key);
    if (running) return running;
    const run = (async (): Promise<SyncResult> => {
      const remotes: Uint8Array[] = [];
      let serverVector: Uint8Array | undefined;
      for (let pass = 0; pass < 5; pass++) {
        const piece = await buffer.get(key);
        if (!piece) return remotes.length ? done(remotes, serverVector) : { status: "gone" };
        try {
          const out = await send(piece);
          remotes.push(out.remote);
          serverVector = out.serverVector;
          // Only forget it if nothing was typed while the request was out.
          if (await buffer.removeIfUnchanged(key, piece.updatedAt)) return done(remotes, serverVector);
          await buffer.setServerVector(key, out.serverVector);
        } catch (err) {
          // Keep the writing on this device either way; it is not lost, just not accepted.
          return { status: isRefusal(err) ? "refused" : "failed" };
        }
      }
      return { status: "failed" };
    })().finally(() => inFlight.delete(key));
    inFlight.set(key, run);
    return run;
  }

  const done = (remotes: Uint8Array[], serverVector?: Uint8Array): SyncResult => ({
    status: "synced",
    remote: remotes.length === 1 ? remotes[0] : Y.mergeUpdates(remotes),
    serverVector
  });

  // Everything this writer left on the device (a crash, a closed tab, being offline).
  async function syncAll(userId: string): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;
    for (const piece of await buffer.unsynced(userId)) {
      const r = await syncPiece(piece.key);
      if (r.status === "synced") synced++;
      else if (r.status === "failed" || r.status === "refused") failed++;
    }
    return { synced, failed };
  }

  return { syncPiece, syncAll };
}

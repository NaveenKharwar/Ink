import type { PieceLanguage } from "@ink/schemas";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// A piece as it sits on this device, waiting to reach the server.
// Only unsent writing lives here: a record is deleted once the server has it.
export type BufferedPiece = {
  key: string; // `${userId}:${id}`, so one writer never sees another's leftovers
  userId: string;
  id: string;
  // The whole piece as Yjs data, so a record is complete on its own.
  state: Uint8Array;
  // What the server was known to have; the next send only needs what is newer. Null = never sent.
  serverVector: Uint8Array | null;
  language: PieceLanguage;
  title: string | null;
  updatedAt: number; // ms; changes on every write, so a save that raced an edit can tell
};

interface InkDB extends DBSchema {
  pieces: { key: string; value: BufferedPiece; indexes: { byUser: string } };
}

export type Buffer = {
  put(piece: BufferedPiece): Promise<void>;
  get(key: string): Promise<BufferedPiece | undefined>;
  unsynced(userId: string): Promise<BufferedPiece[]>;
  // Removes the record only if it is still the version that was sent. True when removed.
  removeIfUnchanged(key: string, updatedAt: number): Promise<boolean>;
  // Notes what the server has, without touching the writing.
  setServerVector(key: string, serverVector: Uint8Array): Promise<void>;
};

export const bufferKey = (userId: string, id: string) => `${userId}:${id}`;

export function openBuffer(name = "ink-buffer"): Buffer {
  let db: Promise<IDBPDatabase<InkDB>> | undefined;
  const open = () =>
    (db ??= openDB<InkDB>(name, 1, {
      upgrade(d) {
        d.createObjectStore("pieces", { keyPath: "key" }).createIndex("byUser", "userId");
      }
    }));

  return {
    async put(piece) {
      await (await open()).put("pieces", piece);
    },
    async get(key) {
      return (await open()).get("pieces", key);
    },
    async unsynced(userId) {
      return (await open()).getAllFromIndex("pieces", "byUser", userId);
    },
    async removeIfUnchanged(key, updatedAt) {
      const tx = (await open()).transaction("pieces", "readwrite");
      const current = await tx.store.get(key);
      const same = !!current && current.updatedAt === updatedAt;
      if (same) await tx.store.delete(key);
      await tx.done;
      return same;
    },
    async setServerVector(key, serverVector) {
      const tx = (await open()).transaction("pieces", "readwrite");
      const current = await tx.store.get(key);
      if (current) await tx.store.put({ ...current, serverVector });
      await tx.done;
    }
  };
}

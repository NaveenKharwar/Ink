// Shared by the database tests. They run the real repository code against a real database with
// every migration applied: CI's local Supabase (see the api-checks job). DATABASE_URL must point at
// a database that only lives for the test run: these tests create and delete writers.
import { randomUUID } from "node:crypto";
import { after } from "node:test";
import { toBase64 } from "@ink/schemas";
import pg from "pg";
import * as Y from "yjs";
import { pgPiecesRepo } from "../pieces/repo.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set: the database tests need a throwaway database (CI's local Supabase).");

export const db = new pg.Pool({ connectionString: url, max: 10 });
const writers: string[] = [];

after(async () => {
  // Deleting the writers takes everything of theirs with them (on delete cascade).
  if (writers.length) await db.query("delete from auth.users where id = any($1::uuid[])", [writers]);
  await db.end();
});

/** A throwaway writer, deleted (with everything of theirs) when the test file ends. */
export async function writer(): Promise<string> {
  const id = randomUUID();
  await db.query(
    `insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, now(), now())`,
    [id, `${id}@db-tests.test`]
  );
  writers.push(id);
  return id;
}

/** A Yjs update shaped the way the editor stores a piece: one stanza per entry, a line break between lines. */
export function pieceUpdate(stanzas: string[][], meta: Record<string, unknown> = {}): Uint8Array {
  const ydoc = new Y.Doc();
  const fragment = ydoc.getXmlFragment("default");
  for (const lines of stanzas) {
    const p = new Y.XmlElement("paragraph");
    fragment.push([p]);
    lines.forEach((line, i) => {
      if (i > 0) p.push([new Y.XmlElement("hardBreak")]);
      const t = new Y.XmlText();
      p.push([t]);
      t.insert(0, line);
    });
  }
  for (const [key, value] of Object.entries(meta)) ydoc.getMap("meta").set(key, value);
  const update = Y.encodeStateAsUpdate(ydoc);
  ydoc.destroy();
  return update;
}

/** A new piece of the writer's, written through the real sync. */
export async function piece(userId: string, stanzas: string[][], meta: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID();
  const out = await pgPiecesRepo(db).sync(userId, id, { update: pieceUpdate(stanzas, meta), stateVector: new Uint8Array([0]) });
  if (!out) throw new Error("The piece was not created");
  return id;
}

/** A 1024-number vector pointing mostly along `axis`, a little along `lean`: close vectors share an axis. */
export function vector(axis: number, lean = (axis + 1) % 1024, amount = 0.2): number[] {
  const v = new Array(1024).fill(0);
  v[axis] = 1;
  v[lean] = amount;
  const norm = Math.hypot(1, amount);
  return v.map((x) => x / norm);
}

export { toBase64 };

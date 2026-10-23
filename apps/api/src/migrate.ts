import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type pg from "pg";

const FILE_NAME = /^(\d{4})_[a-z0-9_]+\.sql$/;

/** The migration files in the order they run (by number). Throws on a badly named file or two files with one number. */
export function orderMigrations(names: string[]): string[] {
  const files = names.filter((name) => name.endsWith(".sql")).sort();
  const seen = new Map<string, string>();
  for (const name of files) {
    const number = FILE_NAME.exec(name)?.[1];
    if (!number) throw new Error(`${name}: a migration is named like 0001_pieces.sql.`);
    const other = seen.get(number);
    if (other) throw new Error(`Two migrations share the number ${number}: ${other} and ${name}.`);
    seen.set(number, name);
  }
  return files;
}

/**
 * Applies every migration in `dir` the database has not had yet, each in its own transaction, and
 * records it in `applied_migrations`. Running it again applies nothing. A database that already has
 * Ink's tables but no record (set up by hand) is left alone. Returns the files it applied.
 */
export async function migrate(pool: pg.Pool, dir: string, log: (line: string) => void = () => {}): Promise<string[]> {
  const files = orderMigrations(await readdir(dir));
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ has_record: boolean; has_tables: boolean }>(
      "select to_regclass('public.applied_migrations') is not null as has_record, to_regclass('public.pieces') is not null as has_tables"
    );
    const { has_record, has_tables } = rows[0]!;
    if (!has_record && has_tables) {
      throw new Error("This database already has Ink's tables but no record of which migrations ran, so nothing was applied.");
    }
    // Row level security on with no policies, like every table: only the API and this command reach it.
    await client.query(
      `create table if not exists public.applied_migrations (name text primary key, applied_at timestamptz not null default now());
       alter table public.applied_migrations enable row level security;`
    );
    const done = new Set((await client.query<{ name: string }>("select name from public.applied_migrations")).rows.map((row) => row.name));
    const applied: string[] = [];
    for (const name of files) {
      if (done.has(name)) continue;
      const sql = await readFile(join(dir, name), "utf8");
      log(`applying ${name}`);
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into public.applied_migrations (name) values ($1)", [name]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`${name} failed, nothing from it was kept: ${error instanceof Error ? error.message : String(error)}`);
      }
      applied.push(name);
    }
    return applied;
  } finally {
    client.release();
  }
}

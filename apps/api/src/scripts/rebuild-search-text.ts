import { createPool } from "../db.js";
import { loadEnv } from "../env.js";
import { isLoose, searchText } from "../pieces/fold.js";

// Rewrites every piece's search copy with today's rules (see fold.ts). Run it after the spelling rules
// change, e.g. `pnpm --filter @ink/api search:rebuild`. Safe to repeat: pieces already right are skipped.
const pool = createPool(loadEnv(), (message) => console.warn(message));
const { rows } = await pool.query<{ id: string; title: string | null; text: string; language: string | null; search_text: string }>(
  "select id, title, text, language, search_text from pieces"
);
let changed = 0;
for (const row of rows) {
  const next = searchText(row.title, row.text, isLoose(row.language));
  if (next === row.search_text) continue;
  await pool.query("update pieces set search_text = $2 where id = $1", [row.id, next]);
  changed += 1;
}
console.log(`${changed} of ${rows.length} pieces updated.`);
await pool.end();

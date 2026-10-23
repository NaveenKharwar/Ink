import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SUPABASE_TEMPLATES } from "./templates.js";

const folder = new URL("../../../../docs/email-templates/", import.meta.url);

test("the Supabase email files are the ones the shared layout writes", () => {
  for (const template of SUPABASE_TEMPLATES) {
    const onDisk = readFileSync(new URL(template.file, folder), "utf8");
    assert.equal(onDisk, template.html, `${template.file} differs from src/emails/templates.ts: run pnpm --filter @ink/api emails:write and paste the changed file into Supabase`);
  }
});

test("every Supabase template keeps the placeholder Supabase fills in", () => {
  const needs: Record<string, string> = {
    "confirm-signup.html": "{{ .Token }}",
    "sign-in-code.html": "{{ .Token }}",
    "reset-password.html": "{{ .TokenHash }}"
  };
  for (const template of SUPABASE_TEMPLATES) assert.ok(template.html.includes(needs[template.file]!), template.file);
});

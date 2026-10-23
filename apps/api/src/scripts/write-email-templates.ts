// Writes the Supabase email templates (src/emails/templates.ts) to docs/email-templates/, and says
// which ones changed: those are the ones to paste into Supabase (Authentication → Emails → Templates).
import { readFileSync, writeFileSync } from "node:fs";
import { SUPABASE_TEMPLATES } from "../emails/templates.js";

const folder = new URL("../../../../docs/email-templates/", import.meta.url);

for (const template of SUPABASE_TEMPLATES) {
  const file = new URL(template.file, folder);
  let before = "";
  try {
    before = readFileSync(file, "utf8");
  } catch {
    // A new template.
  }
  if (before === template.html) {
    console.log(`unchanged  ${template.file}`);
    continue;
  }
  writeFileSync(file, template.html);
  console.log(`changed    ${template.file}  → paste into Supabase "${template.name}" (subject: ${template.subject})`);
}

// Turns the Bruno report into a short Markdown summary for the run page: one row per area, then every
// check in plain words. Usage: node summary.mjs bruno-results.json >> "$GITHUB_STEP_SUMMARY"
import { existsSync, readFileSync } from "node:fs";

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.log("## API checks\n\nNo report was written, so the collection did not finish. See the log of the run.");
  process.exit(0);
}

const report = JSON.parse(readFileSync(file, "utf8"));
const runs = Array.isArray(report) ? report : [report];
const results = runs.flatMap((run) => run.results ?? []);

const passed = (item) => item.status === "pass" || item.status === "passed";
const describeAssertion = (a) =>
  a.lhsExpr === "res.status" ? `answers ${String(a.rhsOperand ?? a.rhsExpr).replace(/^eq /, "")}` : `${a.lhsExpr} ${a.operator} ${a.rhsExpr}`;

const requests = results.map((r) => {
  const checks = [
    ...(r.assertionResults ?? []).map((a) => ({ ok: passed(a), text: describeAssertion(a), error: a.error })),
    ...[...(r.preRequestTestResults ?? []), ...(r.testResults ?? []), ...(r.postResponseTestResults ?? [])].map((t) => ({
      ok: passed(t),
      text: t.description,
      error: t.error
    }))
  ];
  const scriptError = r.error ? [{ ok: false, text: "script or request error", error: r.error }] : [];
  const all = [...checks, ...scriptError];
  const name = r.suitename ?? r.test?.filename ?? r.request?.url ?? "request";
  return { name, status: r.response?.status, checks: all, ok: all.length > 0 && all.every((c) => c.ok) };
});

const folders = new Map();
for (const request of requests) {
  const folder = request.name.includes("/") ? request.name.split("/")[0] : "Other";
  const entry = folders.get(folder) ?? [];
  entry.push(request);
  folders.set(folder, entry);
}

const total = requests.length;
const good = requests.filter((r) => r.ok).length;
const lines = [`## API checks: ${good === total && total > 0 ? "all passed" : "FAILED"}`, "", `${good} of ${total} requests passed, against a real local Supabase with two writers.`, ""];
lines.push("| Area | Passed |", "| --- | --- |");
for (const [folder, items] of folders) lines.push(`| ${folder} | ${items.filter((r) => r.ok).length} of ${items.length} ${items.every((r) => r.ok) ? "✅" : "❌"} |`);

for (const [folder, items] of folders) {
  lines.push("", `### ${folder}`);
  for (const item of items) {
    const short = item.name.includes("/") ? item.name.split("/").slice(1).join("/") : item.name;
    lines.push(`- ${item.ok ? "✅" : "❌"} **${short}**: ${item.checks.map((c) => `${c.ok ? "" : "✖ "}${c.text}`).join("; ") || "no checks"}`);
    for (const check of item.checks.filter((c) => !c.ok && c.error)) lines.push(`  - ${String(check.error).split("\n")[0]}`);
  }
}
if (total === 0) lines.push("", "The report had no requests in it. Report keys: " + Object.keys(runs[0] ?? {}).join(", "));
console.log(lines.join("\n"));

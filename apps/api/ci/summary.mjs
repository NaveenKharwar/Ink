// Turns the Bruno report into Markdown. Short (for the pull request comment): a headline, one row per area,
// and whatever failed. Full (for the run page): every check in plain words.
// Usage: node summary.mjs bruno-results.json [short]
import { existsSync, readFileSync } from "node:fs";

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.log("**API checks did not finish.** No report was written; the run page has the log.");
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
  const name = String(r.suitename ?? r.test?.filename ?? r.request?.url ?? "request").replace(/^.*\/bruno\//, "");
  return { name, status: r.response?.status, checks: all, ok: all.length > 0 && all.every((c) => c.ok) };
});

const short = process.argv[3] === "short";
const area = (name) => (name.includes("/") ? name.split("/")[0] : "Other").replace(/^\d+\s+/, "");
const leaf = (name) => (name.includes("/") ? name.split("/").slice(1).join("/") : name);

const folders = new Map();
for (const request of requests) {
  const entry = folders.get(area(request.name)) ?? [];
  entry.push(request);
  folders.set(area(request.name), entry);
}

const total = requests.length;
const good = requests.filter((r) => r.ok).length;
const allGood = good === total && total > 0;
const failures = requests.filter((r) => !r.ok);
const reason = (item) =>
  item.checks.filter((c) => !c.ok).map((c) => (c.error ? `${c.text} (${String(c.error).split("\n")[0]})` : c.text)).join("; ") || "no checks ran";

const lines = [
  allGood
    ? `**API checks passed.** ${total} of ${total} requests, against a real local database with two writers.`
    : `**API checks failed.** ${good} of ${total} requests passed.`,
  "",
  "| Area | Passed |",
  "| --- | --- |",
  ...[...folders].map(([name, items]) => `| ${name} | ${items.filter((r) => r.ok).length} of ${items.length} |`)
];

if (failures.length > 0) {
  lines.push("", "Failed:");
  for (const item of failures) lines.push(`- ${leaf(item.name)}: ${reason(item)}`);
}

if (!short) {
  for (const [name, items] of folders) {
    lines.push("", `### ${name}`);
    for (const item of items) lines.push(`- ${leaf(item.name)}: ${item.ok ? item.checks.map((c) => c.text).join("; ") : `FAILED, ${reason(item)}`}`);
  }
}
if (total === 0) lines.push("", "The report had no requests in it. Report keys: " + Object.keys(runs[0] ?? {}).join(", "));
console.log(lines.join("\n"));

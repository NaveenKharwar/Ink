import { useState } from "react";
import { pieces } from "../lib/api";

// Development only: create → list → get → edit one piece as the signed-in writer.
export function ApiCheck() {
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const log = (line: string) => setLines((prev) => [...prev, line]);
    setLines([]);
    try {
      const content = {
        type: "doc" as const,
        content: [{ type: "paragraph", content: [{ type: "text", text: "The kettle clicks off" }] }]
      };
      const created = await pieces.create({ id: crypto.randomUUID(), content });
      log(`Created ${created.id.slice(0, 8)}`);
      const list = await pieces.list({ limit: 5 });
      log(`Listed ${list.items.length}`);
      const got = await pieces.get(created.id);
      log(`Got back: "${got.text}"`);
      const updated = await pieces.update(created.id, { status: "finished" });
      log(`Edited: ${updated.status}`);
      log("All four calls worked.");
    } catch (err) {
      log(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="mx-3 mb-3 border-t border-dashed border-line pt-3 text-[12px] leading-4 text-ink-muted">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="cursor-pointer rounded-md border border-line bg-transparent px-2 py-1 text-ink disabled:opacity-60"
      >
        Check the pieces API (dev)
      </button>
      <ul className="mt-2 mb-0 list-none p-0">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

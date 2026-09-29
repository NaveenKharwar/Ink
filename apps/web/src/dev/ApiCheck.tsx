import { toBase64 } from "@ink/schemas";
import { useState } from "react";
import * as Y from "yjs";
import { pieces } from "../lib/api";

// Development only: write → list → get → edit one piece as the signed-in writer.
export function ApiCheck() {
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const log = (line: string) => setLines((prev) => [...prev, line]);
    setLines([]);
    try {
      const id = crypto.randomUUID();
      const ydoc = new Y.Doc();
      const paragraph = new Y.XmlElement("paragraph");
      ydoc.getXmlFragment("default").push([paragraph]);
      const text = new Y.XmlText();
      paragraph.push([text]);
      text.insert(0, "The kettle clicks off");
      await pieces.sync(id, {
        update: toBase64(Y.encodeStateAsUpdate(ydoc)),
        stateVector: toBase64(Y.encodeStateVector(new Y.Doc()))
      });
      log(`Wrote ${id.slice(0, 8)}`);
      const list = await pieces.list({ limit: 5 });
      log(`Listed ${list.items.length}`);
      const got = await pieces.get(id);
      log(`Got back: "${got.text}"`);
      const updated = await pieces.update(id, { status: "finished" });
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

import type { Noticed } from "@ink/schemas";
import { useEffect, useState } from "react";
import { pieces } from "../lib/api";

// Dev only, to look at a remark without the right pieces: /all?noticed=demo or ?noticed=repeats.
// Read once at startup, before the address is tidied to /all and loses its query.
const demo = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("noticed") : null;
const demoNote = { id: "demo", title: null, language: "en" as const, style: "poem" as const, createdAt: "2025-08-10T00:00:00Z", updatedAt: "2025-08-10T00:00:00Z" };

/**
 * The remark under the All writing title. Asked once each time the page opens; a failed ask or
 * nothing close shows nothing, with no loader and no error, since the remark is only ever extra.
 */
export function useNoticed(): Noticed | null {
  const [noticed, setNoticed] = useState<Noticed | null>(null);
  useEffect(() => {
    
    if (demo === "demo") {
      setNoticed({ kind: "returns", note: { ...demoNote, lines: ["Rain on the tin roof, all night"] } });
      return;
    }
    if (demo === "repeats") {
      setNoticed({
        kind: "repeats",
        note: { ...demoNote, lines: ["I keep waiting at the station for no one"] },
        dates: ["2024-12-10T00:00:00Z", "2025-08-10T00:00:00Z", "2026-03-10T00:00:00Z"]
      });
      return;
    }
    const controller = new AbortController();
    pieces.noticed(controller.signal).then(
      (res) => {
        if (!controller.signal.aborted) setNoticed(res?.noticed ?? null);
      },
      () => undefined
    );
    return () => controller.abort();
  }, []);
  return noticed;
}

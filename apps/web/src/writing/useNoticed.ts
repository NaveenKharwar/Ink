import type { Noticed } from "@ink/schemas";
import { useEffect, useState } from "react";
import { pieces } from "../lib/api";

/**
 * The remark under the All writing title. Asked once each time the page opens; a failed ask or
 * nothing close shows nothing, with no loader and no error, since the remark is only ever extra.
 */
export function useNoticed(): Noticed | null {
  const [noticed, setNoticed] = useState<Noticed | null>(null);
  useEffect(() => {
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

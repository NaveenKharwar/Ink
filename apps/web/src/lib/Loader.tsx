import { Blocks } from "loading-dev";
import { useEffect, useState } from "react";

type Props = { size?: number; label?: string; delayMs?: number; className?: string };

// Ink's one loader: nine small blocks breathing in a wave, in the current text colour.
// A short delay keeps it from flashing when the wait is too quick to notice.
export function Loader({ size = 18, label = "Loading", delayMs = 0, className = "" }: Props) {
  const [shown, setShown] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) return;
    const t = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  return (
    <span role="status" aria-label={label} className={`inline-flex ${className}`}>
      {shown && <Blocks size={size} />}
    </span>
  );
}

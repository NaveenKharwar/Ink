import { Blocks } from "loading-dev";
import { useEffect, useState } from "react";

// The loader's colour is sunset, from the sign-in painting: `loader` on the app's grounds and
// panels, `loader-on-ink` inside an ink-filled button (peach in light, like sign-in). "current"
// leaves the colour to the parent (sign-in, which is light only, uses `auth-sunset`).
const TONES = { surface: "text-loader", "on-ink": "text-loader-on-ink", current: "" };

type Props = { size?: number; label?: string; delayMs?: number; tone?: keyof typeof TONES; className?: string };

// Ink's one loader: nine small blocks breathing in a wave. A short delay keeps it from
// flashing when the wait is too quick to notice.
export function Loader({ size = 18, label = "Loading", delayMs = 0, tone = "surface", className = "" }: Props) {
  const [shown, setShown] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) return;
    const t = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  return (
    <span role="status" aria-label={label} className={`inline-flex ${TONES[tone]} ${className}`}>
      {shown && <Blocks size={size} />}
    </span>
  );
}

// Any screen, or part of one, that is waiting for something: the loader in the middle of the
// space it's given, after 300ms so quick loads don't flash. Every wait uses this one.
export function ScreenLoader({ label = "Loading", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex grow items-center justify-center ${className}`}>
      <Loader size={28} delayMs={300} label={label} />
    </div>
  );
}

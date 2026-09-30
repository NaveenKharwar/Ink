import { useEffect, useState } from "react";

// Below this, the gap is the browser's own bars moving, not a keyboard.
const MIN_KEYBOARD_PX = 80;

export type VisibleArea = { top: number; height: number; keyboard: number };

/**
 * The part of the screen the phone actually shows. Phones don't shrink the page for the
 * keyboard: they slide it over the page and may pan the page up a little. The visual viewport
 * is what's left in view, so an app screen sized and placed to it always keeps its top bar and
 * tool bar visible, and its writing ends right where the keyboard (or the browser's own bar)
 * begins. `keyboard` is how much the keyboard covers (0 when closed). Null where it doesn't
 * apply (desktop).
 */
export function useVisibleArea(enabled: boolean): VisibleArea | null {
  const [area, setArea] = useState<VisibleArea | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) {
      setArea(null);
      return;
    }
    const update = () => {
      const covered = Math.round(window.innerHeight - viewport.height - viewport.offsetTop);
      setArea({
        top: Math.round(viewport.offsetTop),
        height: Math.round(viewport.height),
        keyboard: covered >= MIN_KEYBOARD_PX ? covered : 0
      });
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [enabled]);

  return area;
}

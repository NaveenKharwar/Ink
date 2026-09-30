import { useEffect, useState, type RefObject } from "react";

/**
 * True once the element comes near the visible part of its scrolling area (a little before it
 * scrolls into view), and stays true. Grids use it to load pictures only as they are reached.
 */
export function useNearScreen(ref: RefObject<Element | null>, margin = "300px"): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: margin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, margin, near]);
  return near;
}

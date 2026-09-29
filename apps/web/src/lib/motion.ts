// Whether the writer asked their device for less motion. Read at the moment of a movement, so a
// change in settings applies to the next one.
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

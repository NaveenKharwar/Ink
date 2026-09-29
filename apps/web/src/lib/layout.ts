import { useMediaQuery } from "./useMediaQuery";

// The one place code decides phone vs desktop. styles.css sets the same width as Tailwind's
// `wide` breakpoint (lib/layout.test.ts keeps the two equal), so CSS and code switch together.
export const WIDE_MIN_PX = 1200;
export const WIDE_QUERY = `(min-width: ${WIDE_MIN_PX}px)`;

export function useWide(): boolean {
  return useMediaQuery(WIDE_QUERY);
}

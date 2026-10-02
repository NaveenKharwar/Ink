import type { ReactNode } from "react";

// Desktop only: a quiet column on the ground to the right of the paper, in the same slot as the
// "Ink sees this too" sheet (one gap beside the paper to the window edge, as wide as a sheet, see
// styles.css), with the sheets' 12px breathing room at the edge. Not a sheet: no border or shadow.
export function SideColumn({ children }: { children: ReactNode }) {
  return (
    <div className="fixed top-0 right-0 bottom-0 left-[calc(50vw+var(--paper-width)/2+var(--sheet-gap))] z-10 box-border flex flex-col overflow-hidden pt-3 pr-3 pb-6">
      {children}
    </div>
  );
}

// A list of places on the page beside a thin rule; the one being read is bold with an accent bar.
export function PlaceLink({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "location" : undefined}
      className={`touch-44 -ml-px box-border flex h-[30px] w-full cursor-pointer items-center border-0 border-l-2 bg-transparent pl-4 text-left text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        active ? "border-accent font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

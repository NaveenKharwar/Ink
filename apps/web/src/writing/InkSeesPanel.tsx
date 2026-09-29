import { CloseIcon } from "./icons";

// Related writing arrives in Phase 2; until then the panel shows its empty state.
// Desktop: a side sheet from the right edge. Phone: the right side of the sliding track.
export function InkSeesPanel({ phone = false, onClose }: { phone?: boolean; onClose: () => void }) {
  return (
    <aside
      aria-label="Ink sees this too"
      className={`box-border flex h-full shrink-0 flex-col overflow-hidden bg-surface ${
        phone ? "w-[var(--phone-sheet-width)] border-l border-line" : "w-[var(--sheet-width)] rounded-l-panel border border-r-0 border-line"
      }`}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line pr-3 pl-4">
        <span className="font-serif text-[16px] leading-[22px]">Ink sees this too</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="grow overflow-y-auto px-4 pb-6">
        <p className="m-0 py-5 leading-[1.5] text-ink-muted">
          Nothing yet. Once you have written a few lines, related writing appears here.
        </p>
      </div>
    </aside>
  );
}

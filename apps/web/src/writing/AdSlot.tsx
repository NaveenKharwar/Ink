// The one ad slot (300 × 250), only on Home, All writing and Pictures. For now an empty placeholder
// shown in development only, to see the layout; no ad code is loaded. Real ads come from an
// isolated frame on another origin so ad code can never read the writing.
export function AdSlot() {
  return (
    <aside aria-label="Advertisement">
      <div className="text-[11px] leading-[14px] text-ink-muted">Advertisement</div>
      <div className="my-2 box-border flex aspect-[6/5] w-full items-center justify-center rounded-md border border-dashed border-ad-line text-[12px] text-ink-muted">
        Ad · 300 × 250
      </div>
      <div className="text-[11px] leading-[14px] text-ink-muted">Why this ad? · contextual, no tracking</div>
    </aside>
  );
}

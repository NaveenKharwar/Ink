type Props = {
  /** What the quiet spot shows: nothing, "Mark finished", or "Finished · Reopen". */
  spot: "finished" | "mark" | "none";
  /** The last tap could not reach the server. */
  failed: boolean;
  onToggle: () => void;
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
// 14px text, but the tap area is 44px tall: the padding is cancelled by the negative margin.
const target = "-my-3 cursor-pointer border-0 bg-transparent px-0 py-3 text-[14px] leading-5 active:text-ink";

// One quiet control under the last line of the page. It is the only way a piece becomes finished,
// and the state is never shown anywhere else (see the design system). The button stays mounted
// when its words change, so keyboard focus is not lost.
export function FinishedPrompt({ spot, failed, onToggle }: Props) {
  return (
    <div aria-live="polite" className="mt-8 min-h-5 font-sans text-[14px] leading-5 text-ink-muted">
      {spot !== "none" && (
        <div className="flex items-center gap-[18px]">
          {spot === "finished" && <span>Finished</span>}
          <button
            type="button"
            onClick={onToggle}
            className={`${target} ${focus} ${
              spot === "finished"
                ? "border-b-[1.5px] border-dotted border-accent text-accent hover:border-ink hover:text-ink"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {spot === "finished" ? "Reopen" : "Mark finished"}
          </button>
        </div>
      )}
      {failed && <p className="m-0 mt-3">Couldn’t save that. Try again.</p>}
    </div>
  );
}

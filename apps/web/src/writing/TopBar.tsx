import { CloudIcon, MenuIcon, SparkleIcon } from "./icons";
import type { SaveState } from "./usePieceSave";

type Props = {
  wide: boolean;
  season: string;
  title: string | null;
  save: SaveState;
  showSparkle: boolean;
  onSparkle: () => void;
  onMenu: () => void;
};

const iconButton =
  "flex cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function TopBar({ wide, season, title, save, showSparkle, onSparkle, onMenu }: Props) {
  return (
    <div className={`flex shrink-0 items-center justify-between gap-2 ${wide ? "h-14 pr-4 pl-[26px]" : "h-[52px] pr-1.5 pl-1"}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        {!wide && (
          <button type="button" onClick={onMenu} aria-label="Open menu" className={`h-10 w-10 shrink-0 ${iconButton}`}>
            <MenuIcon />
          </button>
        )}
        <span className="whitespace-nowrap">{season}</span>
        <span className="text-ink-muted">/</span>
        <span className="truncate">{title ?? "Untitled"}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-[13px] text-ink-muted">
        {wide && save !== "idle" && (
          <>
            <span aria-live="polite">{save === "saving" ? "Saving…" : "Saved just now"}</span>
            <span className="text-ink">
              <CloudIcon />
            </span>
          </>
        )}
        {showSparkle && (
          <button type="button" onClick={onSparkle} aria-label="Show what Ink sees" className={`h-9 w-9 ${iconButton}`}>
            <SparkleIcon />
          </button>
        )}
      </div>
    </div>
  );
}

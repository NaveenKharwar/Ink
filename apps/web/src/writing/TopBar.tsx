import { useEffect, useRef, useState } from "react";
import { CloudIcon, MenuIcon, SparkleIcon } from "./icons";
import type { SaveState } from "./usePieceSave";

type Props = {
  wide: boolean;
  season: string;
  /** The writer's title, if they gave one. */
  title: string | null;
  /** The piece's opening line, shown while it has no title. */
  firstLine: string;
  onRename: (title: string | null) => void;
  save: SaveState;
  showSparkle: boolean;
  onSparkle: () => void;
  onMenu: () => void;
};

const iconButton =
  "flex cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function TopBar({ wide, season, title, firstLine, onRename, save, showSparkle, onSparkle, onMenu }: Props) {
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
        <PieceName title={title} firstLine={firstLine} onRename={onRename} />
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

// The piece's name: click it and type, like editing text. Enter or clicking away keeps it,
// Escape puts it back, and an empty name falls back to the first line.
function PieceName({
  title,
  firstLine,
  onRename
}: {
  title: string | null;
  firstLine: string;
  onRename: (title: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  const shown = title ?? (firstLine || "Untitled");

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const commit = () => {
    if (cancelled.current) return;
    const next = value.trim().slice(0, 200) || null;
    setEditing(false);
    if (next !== title) onRename(next);
  };

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`Rename: ${shown}`}
        onClick={() => {
          setValue(title ?? "");
          cancelled.current = false;
          setEditing(true);
        }}
        className="min-w-0 cursor-text truncate rounded-md border-0 bg-transparent px-1 py-0.5 text-left text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {shown}
      </button>
    );
  }

  return (
    <input
      ref={input}
      aria-label="Name of this piece"
      value={value}
      placeholder={firstLine || "Untitled"}
      maxLength={200}
      size={Math.max(8, (value || firstLine || "Untitled").length + 1)}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          setEditing(false);
        }
      }}
      className="max-w-[50vw] min-w-0 rounded-md border-0 bg-surface-hover px-1 py-0.5 font-sans text-[14px] text-ink outline-none placeholder:text-ink-muted"
    />
  );
}

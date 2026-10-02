import type { PieceLanguage, PieceStyle } from "@ink/schemas";
import { useEffect, useRef, useState } from "react";
import { CloudIcon, MenuIcon } from "./icons";
import { ConnectionsButton } from "./ConnectionsButton";
import { Dropdown } from "./Dropdown";
import { STYLES } from "./StyleCards";
import { LANGUAGES } from "./Toolbar";
import type { SaveState } from "./usePieceSave";

const SAVE_LONG = {
  idle: "",
  saving: "Saving…",
  saved: "Saved just now",
  device: "Saved on this device",
  refused: "Ink couldn’t save this piece. It’s kept on this device."
} as const;

type Props = {
  wide: boolean;
  season: string;
  /** The writer's title, if they gave one. */
  title: string | null;
  /** The piece's opening line, shown while it has no title. */
  firstLine: string;
  onRename: (title: string | null) => void;
  /** The piece's language: on phone it is chosen here (the tool bar has no room for it). */
  language: PieceLanguage;
  onLanguage: (language: PieceLanguage) => void;
  /** The piece's writing style, switchable any time; null while the blank page offers the cards. */
  style: PieceStyle | null;
  onStyle: (style: PieceStyle) => void;
  save: SaveState;
  /** "Ink sees this too" is open (the mark stays put, joined). */
  panelOpen: boolean;
  /** Opens the panel, or closes it if it is open. */
  onPanelToggle: () => void;
  /** ☰: always on phone; on desktop while the menu is closed. */
  showMenuButton: boolean;
  onMenu: () => void;
};

const iconButton =
  "flex cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function TopBar({
  wide,
  season,
  title,
  firstLine,
  onRename,
  language,
  onLanguage,
  style,
  onStyle,
  save,
  panelOpen,
  onPanelToggle,
  showMenuButton,
  onMenu
}: Props) {
  return (
    <div className={`flex shrink-0 items-center justify-between gap-2 ${wide ? "h-14 pr-4 pl-4" : "h-[52px] pr-1.5 pl-1"}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        {showMenuButton && (
          <button type="button" onClick={onMenu} aria-label="Open menu" className={`h-10 w-10 shrink-0 ${iconButton}`}>
            <MenuIcon />
          </button>
        )}
        {/* Phone: no room for the season, so the name gets it all (the menu still shows it). */}
        {wide && (
          <>
            <span className={`whitespace-nowrap ${showMenuButton ? "" : "pl-2.5"}`}>{season}</span>
            <span className="text-ink-muted">/</span>
          </>
        )}
        {/* The page's heading for screen readers; sighted writers have the name beside it, renamed in place. */}
        <h1 className="sr-only">{title ?? (firstLine || "Untitled")}</h1>
        <PieceName title={title} firstLine={firstLine} onRename={onRename} />
      </div>
      <div className="flex shrink-0 items-center gap-2 text-[13px] text-ink-muted">
        {wide && save !== "idle" && (
          <>
            <span aria-live="polite">{SAVE_LONG[save]}</span>
            <span className="text-ink">
              <CloudIcon />
            </span>
          </>
        )}
        {style && (
          <Dropdown
            label="Writing style"
            value={style}
            options={STYLES}
            onChange={onStyle}
            placement="down"
            align="end"
            display={<span className="font-medium text-ink">{STYLES.find((s) => s.value === style)?.label}</span>}
          />
        )}
        {/* Phone: the tool bar has no room for the language, so it is chosen here, shown short. */}
        {!wide && (
          <Dropdown
            label="Language"
            value={language}
            options={LANGUAGES}
            onChange={onLanguage}
            placement="down"
            align="end"
            display={<span className="font-medium">{SHORT[language]}</span>}
          />
        )}
        <ConnectionsButton open={panelOpen} onToggle={onPanelToggle} />
      </div>
    </div>
  );
}

// The language as it shows on the phone's top bar.
const SHORT: Record<PieceLanguage, string> = { en: "EN", hi: "हि", "hi-Latn": "Hing", mixed: "Mix" };

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
        className="min-w-0 cursor-text truncate rounded-md border-0 bg-transparent px-1 py-0.5 text-left text-ink decoration-line-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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

import type { RelatedNote } from "@ink/schemas";
import { CloseIcon, OpenBesideIcon } from "./icons";

type Props = {
  note: RelatedNote;
  label: string;
  /** The season's colour, for the short dash beside the chosen note. */
  color: string;
  phone: boolean;
  selected: boolean;
  /** Something else is chosen: this one steps back. */
  dimmed: boolean;
  onSelect: () => void;
  onOpenBeside: () => void;
  onDismiss: () => void;
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// One older piece, only its own words: a small label (season, title), the words, and, once it is
// chosen, its two actions. No box, no reason. The chosen note gets a short dash in its season's
// colour (the same dash as on the page, in the gutter so nothing shifts) and the others step back by taking the muted ink colour
// (never by opacity: faded text fell under 4.5:1).
export function RelatedNoteView({ note, label, color, phone, selected, dimmed, onSelect, onOpenBeside, onDismiss }: Props) {
  const action = `absolute top-1.5 z-10 flex cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink-muted hover:text-ink ${focus} ${
    phone ? "h-11 w-11" : "h-7 w-7"
  }`;
  return (
    <div className="group relative -mx-3 mb-5 rounded-md py-2.5 pr-3 pb-3 pl-3">
      {/* The dash sits in the gutter beside the words (the panel's side margin), so choosing a note
          moves nothing: the words stay where they were. */}
      <span
        aria-hidden="true"
        className={`absolute top-[18px] left-0 h-0.5 w-2 rounded-[1px] transition-opacity duration-[250ms] motion-reduce:transition-none ${selected ? "opacity-100" : "opacity-0"}`}
        style={{ background: color }}
      />
      <span className={`mb-2 block truncate text-[12px] leading-4 font-medium tracking-[0.08em] text-ink-muted uppercase ${selected ? (phone ? "pr-24" : "pr-16") : ""}`}>
        {label}
      </span>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`line-clamp-4 w-full cursor-pointer border-0 bg-transparent p-0 text-left font-serif text-[16px] leading-[25px] whitespace-pre-line transition-colors duration-[250ms] motion-reduce:transition-none ${
          dimmed ? "text-ink-muted group-hover:text-ink" : "text-ink"
        } after:absolute after:inset-0 after:content-[''] ${focus}`}
      >
        {note.lines.join("\n")}
      </button>
      {selected && (
        <>
          <button type="button" onClick={onOpenBeside} aria-label="Open beside your page" title="Open beside your page" className={`${action} ${phone ? "right-11" : "right-9"}`}>
            <OpenBesideIcon />
          </button>
          <button type="button" onClick={onDismiss} aria-label="Not related" title="Not related" className={`${action} right-0`}>
            <CloseIcon size={14} />
          </button>
        </>
      )}
    </div>
  );
}

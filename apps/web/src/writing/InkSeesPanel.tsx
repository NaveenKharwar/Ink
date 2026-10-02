import type { RelatedNote } from "@ink/schemas";
import { useState, type ReactNode } from "react";
import { noteLabel, seasonColorVar } from "../lib/related";
import { deviceTimeZone, type SeasonSet } from "../lib/seasons";
import { ChevronIcon, CloseIcon } from "./icons";
import { RelatedNoteView } from "./RelatedNoteView";
import { useDismissals, useRelated } from "./useRelated";
import { FadeScroll } from "../ui/FadeScroll";
import { ScreenLoader } from "../ui/Loader";

const RELATED_SHOWN = 3;

type Props = {
  phone?: boolean;
  /** The piece being written; none on screens that are not a piece. */
  pieceId: string | null;
  /** The piece is already on the server (opened, not a new blank page). */
  exists: boolean;
  seasonSet: SeasonSet;
  onClose: () => void;
  /** The pieces open in the reading paper right now (desktop, while it is on screen). */
  reading?: string[];
  /** Reads an older piece beside the page (desktop) or as the next screen (phone). */
  onOpenBeside: (note: RelatedNote) => void;
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// The dotted-underline link ("Show 2 more", "Undo").
const linkClass = `cursor-pointer border-0 border-b-[1.5px] border-dotted border-accent bg-transparent p-0 text-[14px] text-accent ${focus}`;

// "Ink sees this too": older writing beside the piece, as plain notes under heading bars. Related
// (soft blue: it leads to other writing), Forgotten (old pieces not opened for a long while) and
// Loose lines (short ones). The panel is the only card; nothing inside it is boxed.
export function InkSeesPanel({ phone = false, pieceId, exists, seasonSet, reading = [], onClose, onOpenBeside }: Props) {
  const found = useRelated(pieceId, exists);
  const dismissals = useDismissals(pieceId);
  const [selected, setSelected] = useState<string | null>(null);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const timeZone = deviceTimeZone();

  const seen = (note: RelatedNote) => dismissals.state[note.id] !== "gone";
  const alive = (note: RelatedNote) => !dismissals.state[note.id];
  const sections = [
    { key: "related", title: "Related", tint: true, notes: found.related.filter(seen), limit: showAll ? Infinity : RELATED_SHOWN },
    { key: "forgotten", title: "Forgotten", tint: false, notes: found.forgotten.filter(seen), limit: Infinity },
    { key: "loose", title: "Loose lines", tint: false, notes: found.loose.filter(seen), limit: Infinity }
  ].filter((section) => section.notes.length > 0);

  const note = (n: RelatedNote) => (
    <div key={n.id}>
      {alive(n) ? (
        <RelatedNoteView
          note={n}
          label={noteLabel(n, seasonSet)}
          color={seasonColorVar(n.createdAt, timeZone, seasonSet)}
          phone={phone}
          selected={selected === n.id}
          dimmed={selected !== null && selected !== n.id}
          reading={reading.includes(n.id)}
          onSelect={() => setSelected(n.id)}
          onOpenBeside={() => {
            // The words move to the reading paper: nothing here stays chosen or faded.
            setSelected(null);
            onOpenBeside(n);
          }}
          onDismiss={() => {
            setSelected(null);
            dismissals.dismiss(n);
          }}
        />
      ) : (
        <p className="m-0 mb-5 py-2.5 text-[13px] leading-5 text-ink-muted">
          Won’t show this here again.{" "}
          <button type="button" onClick={() => dismissals.restore(n)} className={linkClass}>
            Undo
          </button>
        </p>
      )}
    </div>
  );

  const bar = (title: string, count: number, tint: boolean, key: string, first: boolean): ReactNode => {
    const open = !folded[key];
    return (
      <button
        type="button"
        onClick={() => setFolded((f) => ({ ...f, [key]: open }))}
        aria-expanded={open}
        className={`flex w-full cursor-pointer items-center justify-between border-0 border-b border-line px-6 text-left text-[14px] font-semibold text-ink ${
          phone ? "h-14" : "h-[52px]"
        } ${first ? "" : "border-t"} ${tint ? "bg-accent-soft" : "bg-transparent"} ${focus}`}
      >
        <span className="flex items-center">
          <span aria-hidden="true" className={`mr-2.5 h-[7px] w-[7px] rounded-full ${tint ? "bg-accent" : "bg-ink-muted opacity-55"}`} />
          {title}
          <span className="ml-1.5 font-normal text-ink-muted">{count}</span>
        </span>
        <span className="text-ink-muted">
          <ChevronIcon up={open} />
        </span>
      </button>
    );
  };

  // Also true on a new page that is not saved yet (nothing asked, nothing loading): never a bare panel.
  const empty = !found.loading && !found.failed && sections.length === 0;

  return (
    <aside
      aria-label="Ink sees this too"
      data-tether="panel"
      className={`box-border flex h-full shrink-0 flex-col overflow-hidden bg-surface ${
        phone ? "w-[var(--phone-sheet-width)] border-l border-line" : "w-[var(--sheet-width)] rounded-l-panel border border-r-0 border-line"
      }`}
    >
      <div className={`flex h-14 shrink-0 items-center justify-between border-b border-line pr-3 ${phone ? "pl-6" : "pl-4"}`}>
        <span className="font-display text-[16px] leading-[22px]">Ink sees this too</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className={`flex cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink ${phone ? "h-11 w-11" : "h-[34px] w-[34px]"} ${focus}`}
        >
          <CloseIcon />
        </button>
      </div>
      <FadeScroll className="grow">
        {found.loading && <ScreenLoader label="Looking through your writing" className="py-10" />}
        {found.failed && (
          <p className="m-0 px-4 py-5 leading-[1.5] text-ink-muted">
            Couldn’t look just now.{" "}
            <button type="button" onClick={found.retry} className={linkClass}>
              Try again
            </button>
          </p>
        )}
        {empty && (
          <p className="m-0 px-4 py-5 leading-[1.5] text-ink-muted">
            Nothing yet. Once you have written a few lines, related writing appears here.
          </p>
        )}
        {sections.map((section, index) => {
          const visible = section.notes.filter(alive).length;
          const shown = section.notes.slice(0, section.limit);
          const more = section.notes.length - shown.length;
          return (
            <section key={section.key} aria-label={section.title}>
              {bar(section.title, visible, section.tint, section.key, index === 0)}
              {!folded[section.key] && (
                <div className="px-6 pt-7 pb-8">
                  {shown.map(note)}
                  {more > 0 && (
                    <button type="button" onClick={() => setShowAll(true)} className={`${linkClass} mt-1`}>
                      Show {more} more
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </FadeScroll>
    </aside>
  );
}

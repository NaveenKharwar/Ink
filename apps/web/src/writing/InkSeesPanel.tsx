import type { RelatedNote } from "@ink/schemas";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { pieces } from "../lib/api";
import { KEPT_OUT_BODY, MEMORY_LABEL, memoryHint } from "../lib/keepOut";
import { noteLabel, seasonColorVar } from "../lib/related";
import { deviceTimeZone, type SeasonSet } from "../lib/seasons";
import { ChevronIcon, CloseIcon } from "./icons";
import { DeletePiece } from "./DeletePiece";
import { RelatedNoteView } from "./RelatedNoteView";
import { useDismissals, useRelated } from "./useRelated";
import { FadeScroll } from "../ui/FadeScroll";
import { MenuDivider, MenuFoot, MenuRow, MenuSwitch } from "../ui/MenuRow";
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
  /** The panel is on show (it slides in and out of view without unmounting). */
  shown?: boolean;
  /** The note that was just read, now that its words are no longer beside the page: shown chosen. */
  chosen?: string | null;
  /** The pieces open in the reading paper right now (desktop, while it is on screen). */
  reading?: string[];
  /** Reads an older piece beside the page (desktop) or as the next screen (phone). */
  onOpenBeside: (note: RelatedNote) => void;
  userId: string;
  /** The writer deleted this piece from the foot of the panel. */
  onDeleted: () => void;
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// The dotted-underline link ("Show 2 more", "Undo").
const linkClass =
  `relative cursor-pointer border-0 border-b-[1.5px] border-dotted border-accent bg-transparent p-0 text-[14px] text-accent before:absolute before:-inset-x-3 before:-inset-y-[14px] before:content-[''] ${focus}`;

// "Ink sees this too": older writing beside the piece, as plain notes under heading bars. Related
// (soft blue: it leads to other writing), Forgotten (old pieces not edited for a long while) and
// Loose lines (short ones). The panel is the only card; nothing inside it is boxed. A section with
// nothing close is not shown at all. Below a divider the foot holds the piece's
// own options: a switch for whether Ink remembers it, then, set apart, Delete. A kept-out piece has no
// notes, and the panel says so.
export function InkSeesPanel({ phone = false, shown = true, chosen = null, pieceId, exists, seasonSet, reading = [], onClose, onOpenBeside, userId, onDeleted }: Props) {
  const found = useRelated(pieceId, exists);
  const dismissals = useDismissals(pieceId);
  const [selected, setSelected] = useState<string | null>(null);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  // What the writer just chose, until the server's answer says the same (so the panel never waits on it).
  const [keepChoice, setKeepChoice] = useState<boolean | null>(null);
  const timeZone = deviceTimeZone();
  const panel = useRef<HTMLElement>(null);

  // The note just read stays chosen when the reading paper is not beside the page (the phone's
  // reader closed, or a narrow window gave the room back): its dash, the others muted.
  useEffect(() => {
    if (chosen) setSelected(chosen);
  }, [chosen]);

  // Coming back to the panel, bring the chosen note into the middle of the screen: that is how the
  // writer sees which one it was.
  useEffect(() => {
    if (!shown) return;
    const frame = requestAnimationFrame(() =>
      panel.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
    );
    return () => cancelAnimationFrame(frame);
  }, [shown]);

  useEffect(() => {
    setKeepChoice(null);
  }, [pieceId, found.keptOut]);
  const keptOut = keepChoice ?? found.keptOut;
  const changeKeepOut = async () => {
    if (!pieceId) return;
    setKeepChoice(!keptOut);
    try {
      await pieces.setInMemory(pieceId, keptOut);
      found.retry();
    } catch {
      setKeepChoice(null);
    }
  };

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
          selected={selected === n.id}
          dimmed={selected !== null && selected !== n.id}
          reading={reading.includes(n.id)}
          onSelect={() => setSelected(n.id)}
          onOpenBeside={() => {
            // Desktop: the words move to the reading paper beside the page, so nothing here stays
            // chosen or faded. Phone: the reader is a screen of its own, and coming back the note
            // stays chosen (its dash, the others muted): that is how the writer sees what they just read.
            if (!phone) setSelected(null);
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
        className={`flex w-full cursor-pointer items-center justify-between border-0 border-b border-line px-6 text-left text-[14px] font-semibold text-ink h-14 ${first ? "" : "border-t"} ${tint ? "bg-accent-soft" : "bg-transparent"} ${focus}`}
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
  const empty = !keptOut && !found.loading && sections.length === 0;

  return (
    <aside
      ref={panel}
      aria-label="Ink sees this too"
      data-tether="panel"
      className={`box-border flex h-full shrink-0 flex-col overflow-hidden bg-surface ${
        phone ? "w-[var(--phone-sheet-width)] border-l border-line" : "w-[var(--sheet-width)] rounded-l-panel border border-r-0 border-line"
      }`}
    >
      <div className={`flex h-14 shrink-0 items-center justify-between border-b border-line pr-3 pl-6`}>
        <span className="font-display text-[16px] leading-[22px]">Ink sees this too</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className={`flex cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink h-11 w-11 ${focus}`}
        >
          <CloseIcon />
        </button>
      </div>
      <FadeScroll className="grow">
        {keptOut && <p className="m-0 px-4 py-5 leading-[1.5] text-ink-muted">{KEPT_OUT_BODY}</p>}
        {!keptOut && found.loading && <ScreenLoader label="Looking through your writing" className="py-10" />}
        {empty && (
          <p className="m-0 px-4 py-5 leading-[1.5] text-ink-muted">
            {found.looked ? "Nothing close to this yet." : "Nothing yet. Once you have written a few lines, related writing appears here."}
          </p>
        )}
        {(keptOut ? [] : sections).map((section, index) => {
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
      {pieceId && (found.known || keptOut || exists) && (
        <MenuFoot aria-live="polite" className="px-5 pb-3 pt-2">
          {/* Settings first (switches, each with one line of what it does), then any actions, and
              Delete last, set apart. A new option is another row in the right group. */}
          {(found.known || keptOut) && (
            <MenuRow tall tone="muted" role="switch" aria-checked={!keptOut} onClick={() => void changeKeepOut()} trailing={<MenuSwitch on={!keptOut} />}>
              <span className="block text-ink">{MEMORY_LABEL}</span>
              <span className="block text-[12px] leading-4 text-ink-muted">{memoryHint(keptOut)}</span>
            </MenuRow>
          )}
          {exists && (
            <>
              <MenuDivider />
              <DeletePiece pieceId={pieceId} userId={userId} onDeleted={onDeleted} />
            </>
          )}
        </MenuFoot>
      )}
    </aside>
  );
}

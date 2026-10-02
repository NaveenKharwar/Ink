import type { LibraryItem, PieceLanguage } from "@ink/schemas";
import { useEffect, useRef, useState } from "react";
import { ScreenLoader } from "../ui/Loader";
import { prefersReducedMotion } from "../lib/motion";
import type { SeasonGroup, SeasonSet } from "../lib/seasons";
import { AdSlot } from "./AdSlot";
import { FadeScroll } from "../ui/FadeScroll";
import { CloseIcon, MenuIcon } from "./icons";
import { SeasonPainting } from "./SeasonPainting";
import { Noticed } from "./Noticed";
import { PlaceLink, SideColumn } from "./SideColumn";
import { useNoticed } from "./useNoticed";

const LANGUAGE: Record<PieceLanguage, string | null> = { en: "English", hi: "हिन्दी", "hi-Latn": "Hinglish", mixed: null };

const ROLL_BAR_HEIGHT = 35;

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type Props = {
  wide: boolean;
  showMenuButton: boolean;
  onMenu: () => void;
  seasonSet: SeasonSet;
  groups: SeasonGroup<LibraryItem>[] | null;
  failed: boolean;
  onRetry: () => void;
  /** What the list is narrowed to: a season as it reads on its own ("Monsoon 2025"), or Drafts or Finished. */
  narrowedTo: { label: string; clear: string } | null;
  onClearNarrowing: () => void;
  onOpen: (id: string) => void;
};

// All writing: every piece, grouped by the season it was written in, newest first.
// Each row is the writer's own first lines, not a title.
export function AllWriting({ wide, showMenuButton, onMenu, seasonSet, groups, failed, onRetry, narrowedTo, onClearNarrowing, onOpen }: Props) {
  const noticed = useNoticed();
  const total = groups?.reduce((n, g) => n + g.items.length, 0) ?? 0;

  // Desktop: a column beside the paper lists the seasons and marks the one being read.
  const scroller = useRef<HTMLDivElement>(null);
  const sections = useRef(new Map<string, HTMLElement>());
  const [reading, setReading] = useState<string | null>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el || !groups?.length) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // A season is being read once its label has slid under the rolling label at the top.
        const top = el.getBoundingClientRect().top + ROLL_BAR_HEIGHT + 1;
        let current = groups[0]!.key;
        for (const g of groups) {
          const section = sections.current.get(g.key);
          if (section && section.getBoundingClientRect().top <= top) current = g.key;
        }
        // At the very end, the last season is the one being read even if it's short.
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) current = groups[groups.length - 1]!.key;
        setReading(current);
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", update);
    };
  }, [groups]);
  // The seasons list in the column follows along: when the season being read is out of its
  // view, the list scrolls just enough to show it.
  const seasonList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = seasonList.current;
    const item = list?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!list || !item) return;
    // The list is the item's positioned parent, so offsetTop is measured from the list's top.
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    const reduce = prefersReducedMotion();
    const to =
      top < list.scrollTop + 8 ? top - 40 : bottom > list.scrollTop + list.clientHeight - 8 ? bottom - list.clientHeight + 40 : null;
    if (to !== null) list.scrollTo({ top: Math.max(0, to), behavior: reduce ? "auto" : "smooth" });
  }, [reading]);
  const jumpTo = (key: string) => {
    const reduce = prefersReducedMotion();
    sections.current.get(key)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <>
      <div className={`flex shrink-0 items-center gap-2.5 ${wide ? "h-14 pr-4 pl-4" : "h-[52px] pr-1.5 pl-1"}`}>
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open menu"
            className={`touch-44 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink ${focusRing}`}
          >
            <MenuIcon />
          </button>
        )}
        <span className={`whitespace-nowrap ${showMenuButton ? "" : "pl-2.5"}`}>All writing</span>
        {narrowedTo && (
          <>
            <span className="text-ink-muted">/</span>
            <span className="truncate">{narrowedTo.label}</span>
          </>
        )}
      </div>

      {/* No top padding on the scroll box itself, so season labels stick flush to its top edge. */}
      <FadeScroll scrollbar="visible" ref={scroller} className={`grow px-[var(--page-gutter)] ${wide ? "pb-12" : "pb-10"}`}>
        <div className={`mx-auto max-w-[680px] ${wide ? "pt-7" : "pt-4"}`}>
          <h1 className={`m-0 font-display font-normal ${wide ? "text-[30px] leading-9" : "text-[26px] leading-8"}`}>{narrowedTo?.label ?? "All writing"}</h1>
          {groups && (
            <div className="mt-1 text-[13px] text-ink-muted">
              {total} {total === 1 ? "piece" : "pieces"}
            </div>
          )}
          {/* Only on the whole list: narrowed to a season or a filter, the list starts under the title. */}
          {!narrowedTo && groups && total > 0 && noticed && <Noticed noticed={noticed} seasonSet={seasonSet} />}
          {narrowedTo && (
            <div className="mt-4 flex">
              <button
                type="button"
                onClick={onClearNarrowing}
                aria-label={narrowedTo.clear}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border border-accent bg-surface py-1.5 pr-2.5 pl-3 text-[13px] text-accent ${focusRing}`}
              >
                {narrowedTo.label}
                <CloseIcon size={14} />
              </button>
            </div>
          )}

          {!groups && !failed && (
            <ScreenLoader label="Loading your writing" className="pt-16" />
          )}
          {!groups && failed && (
            <div className="flex flex-col items-start gap-3 pt-8 text-ink-muted">
              <p className="m-0">Couldn't load your writing. Check your connection.</p>
              <button
                type="button"
                onClick={onRetry}
                className={`cursor-pointer rounded-md border border-line bg-transparent px-3 py-1.5 text-[14px] text-ink ${focusRing}`}
              >
                Try again
              </button>
            </div>
          )}
          {groups && total === 0 && <p className="mt-7 mb-0 text-ink-muted">Nothing here yet.</p>}

          {groups && groups.length > 0 && (
            <>
              {groups[0]!.divider && <div className="mt-7 text-center text-[12px] text-ink-muted">{groups[0]!.divider}</div>}
              <RollingSeason groups={groups} reading={reading ?? groups[0]!.key} first={!groups[0]!.divider} />
            </>
          )}
          {groups?.map((group, i) => (
            <section
              key={group.key}
              aria-label={group.text}
              ref={(el) => {
                if (el) sections.current.set(group.key, el);
                else sections.current.delete(group.key);
              }}
            >
              {/* Ink's label, not the writer's words: small sans. The first season's label is the
                  rolling one above; the others scroll up under it, and it rolls to their name. */}
              {i === 0 ? (
                <h2 className="sr-only">{group.text}</h2>
              ) : (
                <>
                  {group.divider && <div className="mt-7 text-center text-[12px] text-ink-muted">{group.divider}</div>}
                  <h2
                    className={`m-0 border-b border-line pt-2 pb-2 text-[13px] leading-[18px] font-normal text-ink-muted ${group.divider ? "mt-1" : "mt-5"}`}
                  >
                    {group.text} · {group.items.length}
                  </h2>
                </>
              )}
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className={`group block w-full cursor-pointer border-0 bg-transparent px-0 py-3 text-left text-ink ${focusRing}`}
                >
                  {/* Every row has the same shape: one headline line, one quiet line under it. The
                      headline darkens under the pointer, so you can see which one you're on. */}
                  <div
                    className={`truncate font-serif text-[18px] leading-[25px] transition-colors duration-150 motion-reduce:transition-none ${
                      headline(item) ? "text-ink/75 group-hover:text-ink group-focus-visible:text-ink" : "text-ink-muted"
                    }`}
                  >
                    {headline(item) ?? "Untitled"}
                  </div>
                  {excerpt(item) && (
                    <div className="mt-0.5 truncate font-serif text-[15px] leading-[21px] text-ink-muted">{excerpt(item)}</div>
                  )}
                  <div className="mt-1 text-[12px] leading-4 text-ink-muted">{meta(item)}</div>
                </button>
              ))}
            </section>
          ))}
        </div>
      </FadeScroll>

      {/* Beside the paper, on the ground: the season's painting, the seasons on this page, then
          the ad slot. The painting and the ad stay put; only the seasons list scrolls. */}
      {wide && (
        <SideColumn>
          {groups && groups.length > 0 && (
            <SeasonPainting reading={reading ?? groups[0]!.key} />
          )}
          {groups && groups.length > 0 && (
            <nav aria-label="Seasons on this page" className="mt-6 flex min-h-0 flex-col">
              <div className="shrink-0 pb-2 text-[13px] text-ink-muted">Seasons</div>
              {/* A little room on each side so focus rings aren't clipped by the scroll box. */}
              <FadeScroll ref={seasonList} className="relative -mx-1 min-h-0 px-1">
                <ul className="m-0 list-none border-l border-line p-0">
                  {groups.map((g) => {
                    const active = g.key === reading;
                    return (
                      <li key={g.key}>
                        {g.divider && <div className="pt-2.5 pb-1 pl-4 text-[12px] leading-4 text-ink-muted">{g.divider}</div>}
                        <PlaceLink label={g.label} active={active} onClick={() => jumpTo(g.key)} />
                      </li>
                    );
                  })}
                </ul>
              </FadeScroll>
            </nav>
          )}
          {import.meta.env.DEV && (
            <div className="mt-auto w-full max-w-[300px] shrink-0 pt-6">
              <AdSlot />
            </div>
          )}
        </SideColumn>
      )}
    </>
  );
}

// The season label pinned to the top of the list. When the season being read changes it rolls
// to the new name (a later season comes up from below, an earlier one down from above), the
// same roll as the sign-in line, then stays put. Reduced motion: it just changes.
function RollingSeason({ groups, reading, first }: { groups: SeasonGroup<LibraryItem>[]; reading: string; first: boolean }) {
  const [roll, setRoll] = useState<{ step: number; from: string | null; dir: "up" | "down" }>({ step: 0, from: null, dir: "up" });
  const shown = useRef(reading);
  useEffect(() => {
    if (reading === shown.current) return;
    const index = (key: string) => groups.findIndex((g) => g.key === key);
    const dir = index(reading) > index(shown.current) ? "up" : "down";
    setRoll((r) => ({ step: r.step + 1, from: shown.current, dir }));
    shown.current = reading;
  }, [reading, groups]);

  const label = (key: string | null) => {
    const g = groups.find((x) => x.key === key);
    return g ? `${g.text} · ${g.items.length}` : "";
  };

  return (
    <div
      aria-hidden="true"
      style={{ height: ROLL_BAR_HEIGHT }}
      className={`sticky top-0 z-[1] box-border overflow-hidden border-b border-line bg-surface text-[13px] leading-[18px] text-ink-muted ${first ? "mt-5" : "mt-1"}`}
    >
      {roll.from && roll.step > 0 && (
        <div key={`out-${roll.step}`} className={`absolute inset-x-0 top-2 ${roll.dir === "up" ? "season-roll-out-up" : "season-roll-out-down"}`}>
          {label(roll.from)}
        </div>
      )}
      <div
        key={`in-${roll.step}`}
        className={`absolute inset-x-0 top-2 ${roll.step > 0 ? (roll.dir === "up" ? "season-roll-in-up" : "season-roll-in-down") : ""}`}
      >
        {label(reading)}
      </div>
    </div>
  );
}

// A row's headline: the writer's title, else the piece's first line.
function headline(item: LibraryItem): string | null {
  return item.title ?? item.lines[0] ?? null;
}

// The quiet line under it: the next line of the piece (a notes page whose first line is its
// title heading moves on to the line after).
function excerpt(item: LibraryItem): string | null {
  const title = item.title?.trim();
  const rest = title ? item.lines.filter((line) => line.trim() !== title) : item.lines.slice(1);
  return rest[0] ?? null;
}

// "Today · English", "Aug · हिन्दी".
function meta(item: LibraryItem, now: Date = new Date()): string {
  return [when(new Date(item.createdAt), now), item.language ? LANGUAGE[item.language] : null]
    .filter(Boolean)
    .join(" · ");
}

function when(date: Date, now: Date): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleString("en", { month: "short" });
}

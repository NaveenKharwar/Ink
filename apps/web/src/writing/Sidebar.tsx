import type { PieceStatus } from "@ink/schemas";
import { useEffect, useRef, useState } from "react";
import { groupByYear } from "../lib/seasons";
import { FadeScroll } from "../ui/FadeScroll";
import { AccountMenu } from "./AccountMenu";
import { ChevronIcon, DocumentIcon, MenuIcon, PencilIcon, PictureIcon, SearchIcon, SeasonIcon } from "./icons";

// Which screen is open. "write" is a new page (the only time Write is marked); "piece" is a saved
// piece, marked by its season instead. Profile has no item of its own, so nothing is marked there.
export type Screen = "write" | "piece" | "all" | "pictures" | "profile";

export type SeasonLink = { key: string; label: string; divider: string | null; count: number };

type Props = {
  phone?: boolean;
  /** Who is signed in: the pen name, else the email. */
  name: string;
  screen: Screen;
  seasons: SeasonLink[];
  /** The season All writing is narrowed to, marked with the accent dot. */
  activeSeason: string | null;
  /** Drafts or Finished, when All writing is narrowed to one of them (never together with a season). */
  activeFilter: PieceStatus | null;
  /** How many pieces are drafts and how many are finished. */
  counts: Record<PieceStatus, number>;
  onClose: () => void;
  onSearch: () => void;
  onWrite: () => void;
  onAll: () => void;
  onPictures: () => void;
  onSeason: (key: string) => void;
  onFilter: (status: PieceStatus) => void;
  onProfile: () => void;
  onSignOut: () => Promise<void>;
};

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const navItem = `box-border flex h-11 w-full cursor-pointer items-center gap-3 rounded-md border-0 px-3 text-left text-ink ${focusRing}`;
// Rows are 44px tall at every width (a thumb).
const subItem = `box-border flex h-11 w-full cursor-pointer items-center rounded-md border-0`;

const YEARS_KEY = "ink-menu-years";

// The earlier years the writer has opened, remembered on this device.
function readOpenYears(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(YEARS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((y): y is string => typeof y === "string") : [];
  } catch {
    return [];
  }
}

// The menu: search, Write, All writing, Pictures and the seasons, with the account at the foot.
// Desktop: a side sheet from the left edge. Phone: the left side of the sliding track.
export function Sidebar(props: Props) {
  const { phone = false, name, screen, seasons, activeSeason, activeFilter, counts, onClose, onSearch, onWrite, onAll, onPictures, onSeason, onFilter, onProfile, onSignOut } = props;
  const [openYears, setOpenYears] = useState(readOpenYears);
  useEffect(() => {
    try {
      localStorage.setItem(YEARS_KEY, JSON.stringify(openYears));
    } catch {
      // Storage blocked: the years start folded next time.
    }
  }, [openYears]);
  // Arriving at a season of a folded year (from All writing, a piece, search) opens that year.
  const activeYear = activeSeason?.split("-")[0];
  useEffect(() => {
    if (activeYear) setOpenYears((years) => (years.includes(activeYear) ? years : [...years, activeYear]));
  }, [activeYear]);
  // Opening a year adds rows below the one tapped, often past the bottom of the list; bring the
  // year to the top so the writer sees what opened (it just stops where the list ends).
  const list = useRef<HTMLDivElement>(null);
  const showYear = (row: HTMLElement) =>
    requestAnimationFrame(() => {
      const box = list.current;
      if (!box) return;
      const top = box.scrollTop + row.getBoundingClientRect().top - box.getBoundingClientRect().top - 8;
      box.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  const toggleYear = (year: string, open: boolean) => setOpenYears((years) => (open ? years.filter((y) => y !== year) : [...years.filter((y) => y !== year), year]));

  return (
    <nav
      aria-label="Main"
      className={`box-border flex h-full shrink-0 flex-col overflow-hidden bg-surface px-3 py-4 ${
        phone ? "w-[var(--phone-sheet-width)] border-r border-line" : "w-[var(--sheet-width)] rounded-r-panel border border-l-0 border-line"
      }`}
    >
      {/* The top stays put: ☰, the name, Search and Write. Only the list below scrolls. */}
      <div className="shrink-0">
        <div className="flex items-start gap-3 px-2 pt-1 pb-[18px]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className={`relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink before:absolute before:-inset-1.5 before:content-[''] ${focusRing}`}
          >
            <MenuIcon />
          </button>
          <div>
            <div className="font-display text-[25px] leading-[25px] font-medium">Ink</div>
            <div className="mt-1 text-[12px] leading-4 text-ink-muted">Write. Remember. Rediscover.</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onSearch}
          className={`box-border flex h-11 w-full shrink-0 cursor-pointer items-center gap-3 rounded-md border-0 bg-ground pr-2.5 pl-3 text-left text-ink ${focusRing}`}
        >
          <SearchIcon />
          <span className="grow">Search</span>
          {!phone && <kbd className="rounded-sm border border-line-strong bg-surface px-1.5 font-sans text-[12px] text-ink">⌘ K</kbd>}
        </button>

        <div className="mt-2">
          <button
            type="button"
            onClick={onWrite}
            aria-current={screen === "write" ? "page" : undefined}
            className={`${navItem} ${screen === "write" ? "bg-surface-hover font-semibold" : "bg-transparent"}`}
          >
            <PencilIcon />
            Write
          </button>
        </div>
      </div>

      <div className="mx-1 mt-3 h-px shrink-0 bg-line" />
      <FadeScroll ref={list} className="-mx-3 min-h-0 grow px-3 pt-3 pb-2">
        <div className="px-3 pb-1.5 text-[13px] text-ink-muted">Library</div>
        <button
          type="button"
          onClick={onAll}
          aria-current={screen === "all" && !activeSeason && !activeFilter ? "page" : undefined}
          className={`${navItem} ${screen === "all" && !activeSeason && !activeFilter ? "bg-surface-hover font-semibold" : "bg-transparent"}`}
        >
          <DocumentIcon />
          All writing
        </button>
        {/* Drafts and Finished narrow All writing, like a season does. Nothing in any list is labelled. */}
        {(["draft", "finished"] as const).map((status) => {
          const active = screen === "all" && activeFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => onFilter(status)}
              aria-current={active ? "page" : undefined}
              className={`${subItem} pr-3 pl-[41px] text-left text-ink ${focusRing} ${
                active ? "bg-surface-hover" : "bg-transparent"
              }`}
            >
              <span className={`grow ${active ? "font-semibold" : ""}`}>{status === "draft" ? "Drafts" : "Finished"}</span>
              <span className="text-[13px] text-ink-muted">{counts[status]}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onPictures}
          aria-current={screen === "pictures" ? "page" : undefined}
          className={`${navItem} ${screen === "pictures" ? "bg-surface-hover font-semibold" : "bg-transparent"}`}
        >
          <PictureIcon size={17} />
          Pictures
        </button>

        {seasons.length > 0 && (
          <>
            <div className="mx-1 my-3 h-px shrink-0 bg-line" />
            <div className="px-3 pb-1.5 text-[13px] text-ink-muted">Seasons</div>
            {groupByYear(seasons).map((group) => {
              // This year's seasons are always listed. An earlier year is one quiet row that opens in
              // place (see the effect above: arriving at a season in a folded year opens that year).
              const open = group.thisYear || openYears.includes(group.year);
              return (
                <div key={group.year}>
                  {!group.thisYear && (
                    <button
                      type="button"
                      onClick={(e) => {
                        toggleYear(group.year, open);
                        if (!open) showYear(e.currentTarget);
                      }}
                      aria-expanded={open}
                      className={`${subItem} px-3 text-left active:text-ink ${focusRing} ${open ? "font-semibold text-ink" : "text-ink-muted hover:text-ink"}`}
                    >
                      <span className="grow">{group.year}</span>
                      <span className="mr-2 text-[13px] font-normal text-ink-muted">{group.items.reduce((n, s) => n + s.count, 0)}</span>
                      <ChevronIcon up={open} />
                    </button>
                  )}
                  {open && (
                    <div className={group.thisYear ? undefined : "year-open"}>
                      {group.items.map((s) => {
                        const active = s.key === activeSeason;
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => onSeason(s.key)}
                            aria-current={active ? "true" : undefined}
                            className={`${subItem} px-3 text-left text-ink ${focusRing} ${active ? "bg-surface-hover" : "bg-transparent"}`}
                          >
                            {/* Each season has its small mark in its own colour; the one on screen is marked
                                like the other active menu items. */}
                            <span className="flex w-[24px] shrink-0">
                              <SeasonIcon name={s.key.split("-")[1] ?? ""} />
                            </span>
                            <span className={`grow ${active ? "font-semibold" : ""}`}>{s.label}</span>
                            <span className="text-[13px] text-ink-muted">{s.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </FadeScroll>

      <div className="shrink-0 pt-3">
        <AccountMenu name={name} onProfile={onProfile} onSignOut={onSignOut} />
      </div>
    </nav>
  );
}

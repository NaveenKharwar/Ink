import type { PieceStatus } from "@ink/schemas";
import { useEffect, useRef, useState } from "react";
import { groupByYear } from "../lib/seasons";
import { FadeScroll } from "../ui/FadeScroll";
import { ScreenLoader } from "../ui/Loader";
import { MenuCount, MenuDivider, MenuFoot, MenuLabel, MenuRow } from "../ui/MenuRow";
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
  /** The library has answered. Until then the counts and the seasons are not known, and say nothing. */
  loaded: boolean;
  onClose: () => void;
  onSearch: () => void;
  onWrite: () => void;
  onAll: () => void;
  onPictures: () => void;
  onSeason: (key: string) => void;
  onFilter: (status: PieceStatus) => void;
  onProfile: () => void;
};

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
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
  const { phone = false, name, screen, seasons, activeSeason, activeFilter, counts, loaded, onClose, onSearch, onWrite, onAll, onPictures, onSeason, onFilter, onProfile } = props;
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
      className={`box-border flex h-full shrink-0 flex-col overflow-hidden bg-sheet px-3 py-4 ${
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

        <MenuRow
          field
          icon={<SearchIcon />}
          onClick={onSearch}
          trailing={!phone && <kbd className="rounded-sm border border-line-strong bg-surface px-1.5 font-sans text-[12px] text-ink">⌘ K</kbd>}
        >
          Search
        </MenuRow>

        <div className="mt-2">
          <MenuRow icon={<PencilIcon />} onClick={onWrite} selected={screen === "write"}>
            Write
          </MenuRow>
        </div>
      </div>

      <MenuDivider className="mt-3" />
      <FadeScroll ref={list} className="-mx-3 min-h-0 grow px-3 pt-3 pb-2">
        <MenuLabel>Library</MenuLabel>
        <MenuRow icon={<DocumentIcon />} onClick={onAll} selected={screen === "all" && !activeSeason && !activeFilter}>
          All writing
        </MenuRow>
        {/* Drafts and Finished narrow All writing, like a season does. Nothing in any list is labelled. */}
        {(["draft", "finished"] as const).map((status) => {
          const active = screen === "all" && activeFilter === status;
          return (
            <MenuRow key={status} indent selected={active} onClick={() => onFilter(status)} trailing={loaded && <MenuCount>{counts[status]}</MenuCount>}>
              {status === "draft" ? "Drafts" : "Finished"}
            </MenuRow>
          );
        })}
        <MenuRow icon={<PictureIcon size={17} />} onClick={onPictures} selected={screen === "pictures"}>
          Pictures
        </MenuRow>

        {!loaded && (
          <>
            <MenuDivider className="my-3" />
            <ScreenLoader label="Loading your seasons" className="py-6" />
          </>
        )}
        {loaded && seasons.length > 0 && (
          <>
            <MenuDivider className="my-3" />
            <MenuLabel>Seasons</MenuLabel>
            {groupByYear(seasons).map((group) => {
              // This year's seasons are always listed. An earlier year is one quiet row that opens in
              // place (see the effect above: arriving at a season in a folded year opens that year).
              const open = group.thisYear || openYears.includes(group.year);
              return (
                <div key={group.year}>
                  {!group.thisYear && (
                    <MenuRow
                      tone={open ? "ink" : "muted"}
                      selected={false}
                      onClick={(e) => {
                        toggleYear(group.year, open);
                        if (!open) showYear(e.currentTarget);
                      }}
                      aria-expanded={open}
                      className={open ? "font-semibold" : ""}
                      trailing={
                        <>
                          <MenuCount>{group.items.reduce((n, s) => n + s.count, 0)}</MenuCount>
                          <ChevronIcon up={open} />
                        </>
                      }
                    >
                      {group.year}
                    </MenuRow>
                  )}
                  {open && (
                    <div className={group.thisYear ? undefined : "year-open"}>
                      {group.items.map((s) => {
                        const active = s.key === activeSeason;
                        return (
                          <MenuRow
                            key={s.key}
                            icon={<SeasonIcon name={s.key.split("-")[1] ?? ""} />}
                            onClick={() => onSeason(s.key)}
                            selected={active}
                            aria-current={active ? "true" : undefined}
                            trailing={<MenuCount>{s.count}</MenuCount>}
                          >
                            {s.label}
                          </MenuRow>
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

      {/* The way to the profile: the writer's name once, "Profile" under it, and a chevron that says it opens. */}
      <MenuFoot>
        <MenuRow
          tall
          selected={screen === "profile"}
          onClick={onProfile}
          trailing={
            <span className="shrink-0 -rotate-90 text-ink-muted">
              <ChevronIcon size={16} />
            </span>
          }
        >
          <span className="block truncate font-serif text-[17px] leading-[22px]">{name}</span>
          <span className="block text-[12px] font-normal leading-4 text-ink-muted">Profile</span>
        </MenuRow>
      </MenuFoot>
    </nav>
  );
}

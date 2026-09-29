import { useState } from "react";
import { ApiCheck } from "../dev/ApiCheck";
import { AccountMenu } from "./AccountMenu";
import { ChevronIcon, DocumentIcon, MenuIcon, PencilIcon, SearchIcon } from "./icons";

export type Screen = "write" | "all";

export type SeasonLink = { key: string; label: string; divider: string | null; count: number };

type Props = {
  phone?: boolean;
  email: string;
  screen: Screen;
  seasons: SeasonLink[];
  /** The season All writing is narrowed to, marked with the accent dot. */
  activeSeason: string | null;
  onClose: () => void;
  onSearch: () => void;
  onWrite: () => void;
  onAll: () => void;
  onSeason: (key: string) => void;
  onSignOut: () => void;
};

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const navItem = `box-border flex h-9 w-full cursor-pointer items-center gap-3 rounded-md border-0 px-3 text-left text-ink ${focusRing}`;
const SEASONS_SHOWN = 7;

// The menu: search, Write, All writing and the seasons, with the account at the foot.
// Desktop: a side sheet from the left edge. Phone: the left side of the sliding track.
export function Sidebar(props: Props) {
  const { phone = false, email, screen, seasons, activeSeason, onClose, onSearch, onWrite, onAll, onSeason, onSignOut } = props;
  const [allSeasons, setAllSeasons] = useState(false);
  const shown = allSeasons ? seasons : seasons.slice(0, SEASONS_SHOWN);

  return (
    <nav
      aria-label="Main"
      className={`box-border flex h-full shrink-0 flex-col overflow-y-auto bg-surface px-3 py-4 ${
        phone ? "w-[300px] border-r border-line" : "w-[264px] rounded-r-panel border border-l-0 border-line"
      }`}
    >
      <div className="flex items-start gap-3 px-2 pt-1 pb-[18px]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink ${focusRing}`}
        >
          <MenuIcon />
        </button>
        <div>
          <div className="font-serif text-[25px] leading-[25px] font-medium">Ink</div>
          <div className="mt-1 text-[10px] leading-3 text-ink-muted">Write. Remember. Rediscover.</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSearch}
        className={`box-border flex h-[38px] w-full shrink-0 cursor-pointer items-center gap-3 rounded-md border-0 bg-ground pr-2.5 pl-3 text-left text-ink ${focusRing}`}
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

      <div className="mx-1 my-3 h-px shrink-0 bg-line" />
      <div className="px-3 pb-1.5 text-[13px] text-ink-muted">Library</div>
      <button
        type="button"
        onClick={onAll}
        aria-current={screen === "all" && !activeSeason ? "page" : undefined}
        className={`${navItem} ${screen === "all" && !activeSeason ? "bg-surface-hover font-semibold" : "bg-transparent"}`}
      >
        <DocumentIcon />
        All writing
      </button>

      {seasons.length > 0 && (
        <>
          <div className="mx-1 my-3 h-px shrink-0 bg-line" />
          <div className="px-3 pb-1.5 text-[13px] text-ink-muted">Seasons</div>
          {shown.map((s) => {
            const active = s.key === activeSeason;
            return (
              <div key={s.key}>
                {s.divider && <div className="pt-2.5 pr-3 pb-1 pl-[34px] text-[12px] leading-4 text-ink-muted">{s.divider}</div>}
                <button
                  type="button"
                  onClick={() => onSeason(s.key)}
                  aria-current={active ? "true" : undefined}
                  className={`box-border flex h-[31px] w-full cursor-pointer items-center rounded-md border-0 bg-transparent px-3 text-left text-ink ${focusRing}`}
                >
                  <span className="flex w-[22px] shrink-0">
                    {active && <span className="h-[9px] w-[9px] rounded-full bg-accent" />}
                  </span>
                  <span className={`grow ${active ? "font-semibold" : ""}`}>{s.label}</span>
                  <span className="text-[13px] text-ink-muted">{s.count}</span>
                </button>
              </div>
            );
          })}
          {seasons.length > SEASONS_SHOWN && (
            <button
              type="button"
              onClick={() => setAllSeasons(!allSeasons)}
              aria-expanded={allSeasons}
              className={`box-border flex h-[31px] w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent pl-[34px] text-left text-ink-muted ${focusRing}`}
            >
              {allSeasons ? "Fewer seasons" : "More seasons"}
              <ChevronIcon up={allSeasons} />
            </button>
          )}
        </>
      )}

      <div className="grow" />
      {import.meta.env.DEV && <ApiCheck />}
      <div className="mt-3">
        <AccountMenu email={email} onSignOut={onSignOut} />
      </div>
    </nav>
  );
}

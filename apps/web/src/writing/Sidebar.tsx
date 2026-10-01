import { FadeScroll } from "../ui/FadeScroll";
import { AccountMenu } from "./AccountMenu";
import { DocumentIcon, MenuIcon, PencilIcon, PictureIcon, SearchIcon, SeasonIcon } from "./icons";

// Which screen is open; Profile has no item of its own in the menu, so nothing is marked there.
export type Screen = "write" | "all" | "pictures" | "profile";

export type SeasonLink = { key: string; label: string; divider: string | null; count: number };

type Props = {
  phone?: boolean;
  /** Who is signed in: the pen name, else the email. */
  name: string;
  screen: Screen;
  seasons: SeasonLink[];
  /** The season All writing is narrowed to, marked with the accent dot. */
  activeSeason: string | null;
  onClose: () => void;
  onSearch: () => void;
  onWrite: () => void;
  onAll: () => void;
  onPictures: () => void;
  onSeason: (key: string) => void;
  onProfile: () => void;
  onSignOut: () => Promise<void>;
};

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const navItem = `box-border flex h-9 w-full cursor-pointer items-center gap-3 rounded-md border-0 px-3 text-left text-ink ${focusRing}`;

// The menu: search, Write, All writing, Pictures and the seasons, with the account at the foot.
// Desktop: a side sheet from the left edge. Phone: the left side of the sliding track.
export function Sidebar(props: Props) {
  const { phone = false, name, screen, seasons, activeSeason, onClose, onSearch, onWrite, onAll, onPictures, onSeason, onProfile, onSignOut } = props;

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
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink ${focusRing}`}
          >
            <MenuIcon />
          </button>
          <div>
            <div className="font-display text-[25px] leading-[25px] font-medium">Ink</div>
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
      </div>

      <div className="mx-1 mt-3 h-px shrink-0 bg-line" />
      <FadeScroll className="-mx-3 min-h-0 grow px-3 pt-3 pb-2">
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
            {seasons.map((s) => {
              const active = s.key === activeSeason;
              return (
                <div key={s.key}>
                  {s.divider && <div className="pt-2.5 pr-3 pb-1 pl-[36px] text-[12px] leading-4 text-ink-muted">{s.divider}</div>}
                  <button
                    type="button"
                    onClick={() => onSeason(s.key)}
                    aria-current={active ? "true" : undefined}
                    className={`box-border flex h-[31px] w-full cursor-pointer items-center rounded-md border-0 px-3 text-left text-ink ${focusRing} ${
                      active ? "bg-surface-hover" : "bg-transparent"
                    }`}
                  >
                    {/* Each season has its small mark in its own colour; the one on screen is marked
                        like the other active menu items. */}
                    <span className="flex w-[24px] shrink-0">
                      <SeasonIcon name={s.key.split("-")[1] ?? ""} />
                    </span>
                    <span className={`grow ${active ? "font-semibold" : ""}`}>{s.label}</span>
                    <span className="text-[13px] text-ink-muted">{s.count}</span>
                  </button>
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

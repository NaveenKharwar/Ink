import type { LibraryItem, PieceLanguage } from "@ink/schemas";
import { Loader } from "../lib/Loader";
import type { SeasonGroup } from "../lib/seasons";
import { CloseIcon, MenuIcon } from "./icons";

const LANGUAGE: Record<PieceLanguage, string | null> = { en: "English", hi: "हिन्दी", "hi-Latn": "Hinglish", mixed: null };

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type Props = {
  wide: boolean;
  showMenuButton: boolean;
  onMenu: () => void;
  groups: SeasonGroup<LibraryItem>[] | null;
  failed: boolean;
  onRetry: () => void;
  /** The season the list is narrowed to, as it reads on its own ("Monsoon 2025"). */
  season: string | null;
  onClearSeason: () => void;
  onOpen: (id: string) => void;
};

// All writing: every piece, grouped by the season it was written in, newest first.
// Each row is the writer's own first lines, not a title.
export function AllWriting({ wide, showMenuButton, onMenu, groups, failed, onRetry, season, onClearSeason, onOpen }: Props) {
  const total = groups?.reduce((n, g) => n + g.items.length, 0) ?? 0;

  return (
    <>
      <div className={`flex shrink-0 items-center gap-2.5 ${wide ? "h-14 pr-4 pl-4" : "h-[52px] pr-1.5 pl-1"}`}>
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open menu"
            className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink ${focusRing}`}
          >
            <MenuIcon />
          </button>
        )}
        <span className={`whitespace-nowrap ${showMenuButton ? "" : "pl-2.5"}`}>All writing</span>
        {season && (
          <>
            <span className="text-ink-muted">/</span>
            <span className="truncate">{season}</span>
          </>
        )}
      </div>

      <div className={`grow overflow-y-auto ${wide ? "px-12 pt-7 pb-12" : "px-5 pt-4 pb-10"}`}>
        <div className="mx-auto max-w-[680px]">
          <h1 className={`m-0 font-serif font-normal ${wide ? "text-[30px] leading-9" : "text-[26px] leading-8"}`}>{season ?? "All writing"}</h1>
          {groups && (
            <div className="mt-1 text-[13px] text-ink-muted">
              {total} {total === 1 ? "piece" : "pieces"}
            </div>
          )}
          {season && (
            <div className="mt-4 flex">
              <button
                type="button"
                onClick={onClearSeason}
                aria-label={`Show all seasons, not only ${season}`}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border border-accent bg-surface py-1.5 pr-2.5 pl-3 text-[13px] text-accent ${focusRing}`}
              >
                {season}
                <CloseIcon size={14} />
              </button>
            </div>
          )}

          {!groups && !failed && (
            <div className="flex justify-center pt-16 text-ink-muted">
              <Loader size={28} delayMs={300} label="Loading your writing" />
            </div>
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

          {groups?.map((group, i) => (
            <section key={group.key} aria-label={group.text}>
              {group.divider && <div className="mt-7 text-center text-[12px] text-ink-muted">{group.divider}</div>}
              <div
                className={`flex items-baseline justify-between border-b border-line pb-2 ${i === 0 ? "mt-7" : group.divider ? "mt-3" : "mt-7"}`}
              >
                <h2 className="m-0 font-serif text-[19px] leading-[26px] font-normal">{group.label}</h2>
                <span className="text-[13px] text-ink-muted">{group.items.length}</span>
              </div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className={`block w-full cursor-pointer border-0 border-b border-surface-hover bg-transparent px-0 py-3 text-left text-ink ${focusRing}`}
                >
                  <div className="font-serif text-[18px] leading-[25px]">
                    {item.lines.length ? item.lines.join(" ") : <span className="text-ink-muted">{item.title ?? "Untitled"}</span>}
                  </div>
                  <div className="mt-1 text-[12px] leading-4 text-ink-muted">{meta(item)}</div>
                </button>
              ))}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

// "Today · English", "Aug · fragment · हिन्दी".
function meta(item: LibraryItem, now: Date = new Date()): string {
  return [when(new Date(item.createdAt), now), item.isFragment ? "fragment" : null, item.language ? LANGUAGE[item.language] : null]
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

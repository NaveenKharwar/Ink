import type { LibraryItem, MarkedLine, PieceStyle, SearchResult } from "@ink/schemas";
import { useEffect, useId, useRef, useState } from "react";
import { pieces } from "../lib/api";
import { Loader, ScreenLoader } from "../ui/Loader";
import { deviceTimeZone, seasonText, type SeasonSet } from "../lib/seasons";
import { CloseIcon, SearchIcon } from "./icons";
import { FadeScroll } from "../ui/FadeScroll";

type Result = { id: string; first: MarkedLine; match: MarkedLine | null; season: string; style: string };

// A piece without a style is a Poem.
const STYLE_NAMES: Record<PieceStyle, string> = { poem: "Poem", story: "Story", notes: "Notes" };
const styleName = (style: PieceStyle | null) => STYLE_NAMES[style ?? "poem"];

type Props = {
  wide: boolean;
  /** Shown before anything is typed: the pieces worked on most recently. */
  recent: LibraryItem[];
  seasonSet: SeasonSet;
  onOpen: (id: string) => void;
  onClose: () => void;
};

const WAIT_MS = 200;
// Words matches shown before "Show more", so "Close in meaning" is always on screen without scrolling.
const WORDS_SHOWN = 4;

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Search your writing: the words first, then pieces close in meaning. ⌘K or Search opens it; a result opens the piece.
export function SearchDialog({ wide, recent, seasonSet, onOpen, onClose }: Props) {
  const season = (createdAt: string) => seasonText(new Date(createdAt), new Date(), deviceTimeZone(), seasonSet);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Result[] | null>(null);
  const [closeFound, setCloseFound] = useState<Result[]>([]);
  // Which words the results are for, so a newer search shows the loader, not the old results. The
  // words come back quickly and close in meaning later (it waits for the embedder), so each has
  // its own mark: the words show as soon as they are in, and a small loader waits for the rest.
  const [foundFor, setFoundFor] = useState("");
  const [closeFor, setCloseFor] = useState("");
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // A modal dialog: focus goes back to where the writer was when it closes.
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (before?.isConnected) before.focus();
    };
  }, []);

  const query = q.trim();
  useEffect(() => {
    if (!query) {
      setFound(null);
      setFailed(false);
      return;
    }
    setFailed(false);
    const abort = new AbortController();
    const timer = setTimeout(() => {
      const toResult = (r: SearchResult): Result => ({ id: r.id, first: r.firstLine, match: r.match, season: season(r.createdAt), style: styleName(r.style) });
      pieces.search(query, abort.signal, "words").then(
        (res) => {
          setFound(res.items.map(toResult));
          setFoundFor(query);
          setShowAll(false);
          setFailed(false);
          setActive(0);
        },
        () => !abort.signal.aborted && setFailed(true)
      );
      // Meaning is the slow half. If it fails the writer simply keeps the words.
      pieces.search(query, abort.signal, "close").then(
        (res) => {
          setCloseFound(res.close.map(toResult));
          setCloseFor(query);
        },
        () => !abort.signal.aborted && setCloseFor(query)
      );
    }, WAIT_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query]);

  const searching = Boolean(query) && foundFor !== query && !failed;
  const allWords: Result[] = query
    ? searching
      ? []
      : (found ?? [])
    : recent.map((item) => ({
        id: item.id,
        first: { text: item.lines[0] ?? item.title ?? "Untitled", marks: [] },
        match: null,
        season: season(item.createdAt),
        style: styleName(item.style)
      }));
  // Only a search is capped; the recent pieces shown before typing are never.
  const words = query && !showAll ? allWords.slice(0, WORDS_SHOWN) : allWords;
  const hiddenWords = allWords.length - words.length;
  // Close in meaning shows once it has arrived; until then a small loader waits under the words.
  const closing = Boolean(query) && !searching && !failed && closeFor !== query;
  const close: Result[] = query && !searching && closeFor === query ? closeFound : [];
  // One list for the arrow keys, across both groups.
  const results = [...words, ...close];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      // Keep Tab inside the dialog: from the last control back to the first, and the other way.
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>("input, button") ?? [])];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first && last && e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (first && last && !e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    } else if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      onOpen(results[active]!.id);
    }
  };

  // Keep the chosen result in view while moving with the arrow keys.
  useEffect(() => {
    dialog.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const optionId = (i: number) => `${listId}-${i}`;

  // The name of a group, the same bar as the sections of Ink sees this too: soft accent for meaning, plain for words.
  const label = (title: string, tint: boolean, first: boolean) => (
    <li
      role="presentation"
      className={`-mx-[18px] mb-2 flex h-11 items-center border-y border-line px-[18px] text-[13px] font-semibold text-ink ${
        tint ? "bg-accent-soft" : "bg-transparent"
      } ${first ? "-mt-1.5 border-t-0" : "mt-3"}`}
    >
      <span aria-hidden="true" className={`mr-2.5 h-[7px] w-[7px] rounded-full ${tint ? "bg-accent" : "bg-ink-muted opacity-55"}`} />
      {title}
    </li>
  );

  const row = (r: Result, i: number) => (
    <li
      key={r.id}
      id={optionId(i)}
      data-index={i}
      role="option"
      aria-selected={i === active}
      onClick={() => onOpen(r.id)}
      onMouseMove={() => active !== i && setActive(i)}
      className={`cursor-pointer py-3 transition-colors duration-150 motion-reduce:transition-none ${i === active ? "text-ink" : "text-ink/75"}`}
    >
      <Marked line={r.first} className="line-clamp-2 font-serif text-[18px] leading-[25px]" />
      {r.match && <Marked line={r.match} className="mt-1 line-clamp-2 font-serif text-[16px] leading-[23px] text-ink-muted" />}
      <div className="mt-1 text-[12px] leading-4 text-ink-muted">{r.season} · {r.style}</div>
    </li>
  );

  return (
    <>
      {wide && <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-40 bg-scrim" />}
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Search your writing"
        onKeyDown={onKeyDown}
        className={`z-50 box-border flex flex-col overflow-hidden bg-surface ${
          wide
            ? "fixed top-[88px] left-1/2 max-h-[560px] w-[640px] -translate-x-1/2 rounded-panel shadow-[0_24px_60px_rgba(0,0,0,0.20)]"
            : "fixed inset-0"
        }`}
      >
        <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line pr-3 pl-[18px] text-ink">
          <SearchIcon size={19} />
          <input
            ref={input}
            autoFocus
            role="combobox"
            aria-label="Search"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results.length ? optionId(active) : undefined}
            aria-autocomplete="list"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your writing"
            spellCheck={false}
            className="min-w-0 grow border-0 bg-transparent font-serif text-[20px] text-ink outline-none placeholder:text-ink-muted"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <CloseIcon />
          </button>
        </div>
        <FadeScroll className="grow px-[18px] pt-1.5 pb-3">
          <ul id={listId} role="listbox" aria-label="Results" className="m-0 list-none p-0">
            {query && words.length > 0 && label("Your words", false, true)}
            {words.map((r, i) => row(r, i))}
            {hiddenWords > 0 && (
              <li role="presentation" className="py-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAll(true);
                    // The link goes away; keep focus in the dialog so Esc and Tab still work.
                    input.current?.focus();
                  }}
                  className={`relative cursor-pointer border-0 border-b-[1.5px] border-dotted border-accent bg-transparent p-0 text-[14px] text-accent ${wide ? "" : "before:absolute before:-inset-x-3 before:-inset-y-[14px] before:content-['']"} ${focus}`}
                >
                  Show {hiddenWords} more
                </button>
              </li>
            )}
            {close.length > 0 && label("Close in meaning", true, words.length === 0)}
            {close.map((r, i) => row(r, words.length + i))}
          </ul>
          {searching && <ScreenLoader label="Searching" className="py-10" />}
          {closing && <Loader size={16} label="Looking for close writing" delayMs={300} className="my-4" />}
          {query && !searching && !closing && found && !results.length && !failed && <p className="m-0 pt-2 text-ink-muted">Nothing with those words yet.</p>}
          {failed && <p className="m-0 pt-2 text-ink-muted">Search isn't working right now. Check your connection.</p>}
        </FadeScroll>
      </div>
    </>
  );
}

// The writer's line, with the found words in the accent colour.
function Marked({ line, className }: { line: MarkedLine; className: string }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  line.marks.forEach(([start, end], i) => {
    if (start > at) parts.push(line.text.slice(at, start));
    parts.push(
      <mark key={i} className="bg-transparent text-accent">
        {line.text.slice(start, end)}
      </mark>
    );
    at = end;
  });
  if (at < line.text.length) parts.push(line.text.slice(at));
  return <div className={className}>{parts}</div>;
}

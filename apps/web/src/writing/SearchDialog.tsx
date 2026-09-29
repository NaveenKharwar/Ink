import type { LibraryItem, MarkedLine } from "@ink/schemas";
import { useEffect, useId, useRef, useState } from "react";
import { pieces } from "../lib/api";
import { deviceTimeZone, seasonText, type SeasonSet } from "../lib/seasons";
import { CloseIcon, SearchIcon } from "./icons";

type Result = { id: string; first: MarkedLine; match: MarkedLine | null; season: string };

type Props = {
  wide: boolean;
  /** Shown before anything is typed: the pieces worked on most recently. */
  recent: LibraryItem[];
  seasonSet: SeasonSet;
  onOpen: (id: string) => void;
  onClose: () => void;
};

const WAIT_MS = 200;

// Search your writing by its words. ⌘K or Search opens it; a result opens the piece.
export function SearchDialog({ wide, recent, seasonSet, onOpen, onClose }: Props) {
  const season = (createdAt: string) => seasonText(new Date(createdAt), new Date(), deviceTimeZone(), seasonSet);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Result[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const dialog = useRef<HTMLDivElement>(null);

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
    const abort = new AbortController();
    const timer = setTimeout(() => {
      pieces.search(query, abort.signal).then(
        (res) => {
          setFound(
            res.items.map((r) => ({ id: r.id, first: r.firstLine, match: r.match, season: season(r.createdAt) }))
          );
          setFailed(false);
          setActive(0);
        },
        () => !abort.signal.aborted && setFailed(true)
      );
    }, WAIT_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query]);

  const results: Result[] = query
    ? (found ?? [])
    : recent.map((item) => ({
        id: item.id,
        first: { text: item.lines[0] ?? item.title ?? "Untitled", marks: [] },
        match: null,
        season: season(item.createdAt)
      }));

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
        <div className="grow overflow-y-auto px-[18px] pt-1.5 pb-3">
          <ul id={listId} role="listbox" aria-label="Results" className="m-0 list-none p-0">
            {results.map((r, i) => (
              <li
                key={r.id}
                id={optionId(i)}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onClick={() => onOpen(r.id)}
                onMouseMove={() => active !== i && setActive(i)}
                className={`-mx-2.5 cursor-pointer rounded-md border-b border-surface-hover px-2.5 py-3 ${i === active ? "bg-surface-hover" : ""}`}
              >
                <Marked line={r.first} className="font-serif text-[18px] leading-[25px]" />
                {r.match && <Marked line={r.match} className="mt-1 font-serif text-[16px] leading-[23px] text-ink-muted" />}
                <div className="mt-1 text-[12px] leading-4 text-ink-muted">{r.season}</div>
              </li>
            ))}
          </ul>
          {query && found && !found.length && !failed && <p className="m-0 pt-2 text-ink-muted">Nothing with those words yet.</p>}
          {failed && <p className="m-0 pt-2 text-ink-muted">Search isn't working right now. Check your connection.</p>}
        </div>
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

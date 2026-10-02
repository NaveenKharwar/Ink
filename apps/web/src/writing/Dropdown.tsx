import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronIcon } from "./icons";

export type DropdownOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  /** What the choice is, for screen readers ("Language"). */
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  /** Opens above the button (a bar at the bottom) or below it (a bar at the top). */
  placement?: "up" | "down";
  /** Which edge of the button the list lines up with. */
  align?: "start" | "end";
  /** What the button shows; the chosen option's label when not given. */
  display?: ReactNode;
};

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Ink's own dropdown: a quiet button with the choice and a small chevron, opening a list in the
// same look as the account menu (surface, strong line, soft shadow, rounded rows, a check on
// the chosen one). Keyboard: Enter, Space or the arrow keys open it on the current choice; the
// arrow keys, Home and End move; Enter or Space picks; Escape or Tab closes it.
export function Dropdown<T extends string>({ label, value, options, onChange, placement = "up", align = "end", display }: Props<T>) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const chosen = options.find((o) => o.value === value);

  // Opening lands on the current choice; clicking anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>("[aria-selected='true']")?.focus() ??
      list.current?.querySelector<HTMLElement>("[role='option']")?.focus();
    const close = (e: MouseEvent) => wrap.current?.contains(e.target as Node) || setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const shut = () => {
    setOpen(false);
    button.current?.focus();
  };
  const pick = (next: T) => {
    if (next !== value) onChange(next);
    shut();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>("[role='option']") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const move = (i: number) => {
      e.preventDefault();
      items[(i + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") move(at + 1);
    else if (e.key === "ArrowUp") move(at - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      shut();
    } else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${chosen?.label ?? value}`}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`touch-44 flex h-9 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2.5 text-[14px] transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${
          open ? "text-ink" : "text-ink/75 hover:text-ink"
        }`}
      >
        <span>{display ?? chosen?.label ?? value}</span>
        <span className="text-ink-muted">
          <ChevronIcon size={12} up={placement === "up" ? !open : open} />
        </span>
      </button>

      {open && (
        <div
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          onKeyDown={onListKey}
          className={`absolute z-30 min-w-[168px] rounded-md border border-line-strong bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.10)] ${
            placement === "up" ? "bottom-full mb-2" : "top-full mt-2"
          } ${align === "end" ? "right-0" : "left-0"}`}
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <div
                key={o.value}
                role="option"
                tabIndex={-1}
                aria-selected={selected}
                onClick={() => pick(o.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pick(o.value);
                  }
                }}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-[6px] px-2.5 py-2 text-[13px] outline-none transition-colors duration-150 hover:text-ink focus:text-ink motion-reduce:transition-none ${
                  selected ? "font-semibold text-ink" : "text-ink/70"
                }`}
              >
                {o.label}
                {selected && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

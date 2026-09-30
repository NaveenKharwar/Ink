import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../writing/icons";

type Props = {
  title: string;
  wide: boolean;
  onClose: () => void;
  /** Desktop size of the panel; phones always get the whole screen. */
  className?: string;
  children: ReactNode;
};

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * Ink's dialog: a panel over a soft scrim on desktop, the whole screen on phones. Escape or ×
 * closes it, Tab stays inside, and focus goes back to where the writer was. Drawn on the page's
 * body, so a moving parent (the phone track) never shifts it.
 */
export function Dialog({ title, wide, onClose, className = "w-[720px] h-[620px]", children }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = panel.current;
    el?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      // Unless the choice already moved focus elsewhere (a picture put into the writing).
      const now = document.activeElement;
      const unclaimed = !now || now === document.body || (el?.contains(now) ?? false);
      if (unclaimed && before?.isConnected) before.focus();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      const focusable = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first && last && e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (first && last && !e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return createPortal(
    <>
      {wide && <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-40 bg-scrim" />}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={onKeyDown}
        className={`z-50 box-border flex flex-col overflow-hidden bg-surface text-ink ${
          wide
            ? `fixed top-1/2 left-1/2 max-h-[calc(100vh-48px)] max-w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-line-strong shadow-[0_24px_60px_rgba(0,0,0,0.20)] ${className}`
            : "fixed inset-0 h-dvh"
        }`}
      >
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-line pr-3 pl-[var(--page-gutter)] wide:pl-6">
          <h2 className="m-0 font-serif text-[20px] leading-7 font-normal">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink/75 transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </>,
    document.body
  );
}

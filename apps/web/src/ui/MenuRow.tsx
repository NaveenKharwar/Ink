import type { ButtonHTMLAttributes, ReactNode } from "react";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const TONES = {
  ink: "text-ink",
  // Quiet until the writer reaches for it: darkens on hover and press (never a grey background).
  muted: "text-ink-muted hover:text-ink active:text-ink",
  danger: "text-danger"
};

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  /** The mark in front of the label (an icon, a season mark). */
  icon?: ReactNode;
  /** What sits at the end of the row: a count, a chevron, a switch. */
  trailing?: ReactNode;
  /** The row for the screen or choice that is open: a soft background and a bold label. */
  selected?: boolean;
  tone?: keyof typeof TONES;
  /** Two lines (a label and what it does): at least 56px tall, not 44px. */
  tall?: boolean;
  /** Lines up under the labels of rows that have an icon (Drafts and Finished under All writing). */
  indent?: boolean;
  /** A field-like row on the page's ground (Search), not a list row. */
  field?: boolean;
  /** As wide as its words, for answers that share a row. */
  inline?: boolean;
};

// The one row of every menu: the left menu, the foot of "Ink sees this too". Every row is at least
// 44px tall (a thumb) at every width, with one padding and one way to show the open one, so rows
// that do the same job always look the same.
export function MenuRow({ icon, trailing, selected = false, tone = "ink", tall = false, indent = false, field = false, inline = false, className = "", children, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-current={selected ? "page" : undefined}
      {...rest}
      className={`box-border flex ${tall ? "min-h-14" : "min-h-11"} ${inline ? "w-auto" : "w-full"} cursor-pointer items-center gap-3 rounded-md border-0 text-left text-[14px] leading-5 disabled:cursor-default ${
        indent ? "pr-3 pl-10" : "px-3"
      } ${field ? "bg-ground" : selected ? "bg-surface-hover" : "bg-transparent"} ${TONES[tone]} ${focusRing} ${className}`}
    >
      {icon && <span className="flex w-4 shrink-0 justify-center">{icon}</span>}
      <span className={`min-w-0 grow ${selected ? "font-semibold" : ""}`}>{children}</span>
      {trailing}
    </button>
  );
}

/** The hairline between groups of rows. */
export function MenuDivider({ className = "" }: { className?: string }) {
  return <div role="separator" className={`mx-1 h-px shrink-0 bg-line ${className}`} />;
}

/**
 * The foot of a menu: a hairline, then the options under it. It sits on a solid surface so a list
 * that fades above it never runs into it. The host gives it its side and bottom room.
 */
export function MenuFoot({ children, className = "", ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={`shrink-0 bg-surface ${className}`}>
      <MenuDivider />
      <div className="pt-2">{children}</div>
    </div>
  );
}

/** The switch at the end of a switch row; the row itself carries role="switch". */
export function MenuSwitch({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 motion-reduce:transition-none ${on ? "bg-accent" : "bg-line-strong"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface transition-[left] duration-150 motion-reduce:transition-none ${on ? "left-[18px]" : "left-0.5"}`} />
    </span>
  );
}

/** A small grey heading over a group of rows ("Library", "Seasons"). */
export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 pb-1.5 text-[13px] text-ink-muted">{children}</div>;
}

/** A count at the end of a row. */
export function MenuCount({ children }: { children: ReactNode }) {
  return <span className="text-[13px] font-normal text-ink-muted">{children}</span>;
}

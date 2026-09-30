// Inline stroke icons on a 24px grid, drawn in the current text colour.
import type { ReactNode } from "react";

type P = { size?: number };

export const MenuIcon = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const PencilIcon = ({ size = 17 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5 4 20z" />
  </svg>
);

export const SparkleIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.8 5.6L19.5 10l-5.7 1.4L12 17l-1.8-5.6L4.5 10l5.7-1.4z" />
  </svg>
);

export const CloseIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const CloudIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 10.6 3.8 3.8 0 0 0 7 18z" />
  </svg>
);

export const QuoteIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 17c2 0 3.5-1.5 3.5-4V8H4.5v5H8M15 17c2 0 3.5-1.5 3.5-4V8h-4v5H18" />
  </svg>
);

export const SceneBreakIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12h5M16 12h5M12 9l3 3-3 3-3-3z" />
  </svg>
);

// Put the phone keyboard away: a small keyboard with an arrow pointing down.
export const KeyboardDownIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="11" rx="2" />
    <path d="M7 8h.01M10.5 8h.01M14 8h.01M17 8h.01M8 11.5h8M9.5 18.5L12 21l2.5-2.5" />
  </svg>
);

export const IndentIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 6h16M11 10.5h9M11 14.5h9M4 19h16M4 9.5l3 2.5-3 2.5" />
  </svg>
);

export const BulletListIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <path d="M10 7h10M10 12h10M10 17h10" />
    <circle cx="5" cy="7" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="5" cy="17" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const NumberedListIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 7h10M10 12h10M10 17h10M4.5 5.5L6 4.5v4.5M4.5 13.5a1.4 1.4 0 0 1 2.6.6c0 .9-2.6 2-2.6 3h2.8" />
  </svg>
);

export const LinkIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

// A plain note: something needs the writer's attention (never red).
export const NoteIcon = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5v.01" />
  </svg>
);

export const CheckCircleIcon = ({ size = 20, saving = false }: P & { saving?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d={saving ? "M12 7v5l3 2" : "M8 12.5l2.7 2.7L16 9.8"} />
  </svg>
);

export const SearchIcon = ({ size = 17 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);

export const DocumentIcon = ({ size = 17 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M10 12h5M10 16h5" />
  </svg>
);

export const ChevronIcon = ({ size = 14, up = false }: P & { up?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
  </svg>
);

// One small mark per season, beside its name in the menu.
const seasonPaths: Record<string, ReactNode> = {
  winter: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" />,
  spring: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M12 10c-1.6-2.4-1.6-4.6 0-6.5 1.6 1.9 1.6 4.1 0 6.5zM13.9 11.4c1.1-2.7 3-3.9 5.4-3.6-.3 2.4-2.1 3.8-5.4 3.6zM13.2 13.9c2.8.4 4.3 2 4.4 4.4-2.4.2-4.1-1.3-4.4-4.4zM10.8 13.9c-.3 3.1-2 4.6-4.4 4.4.1-2.4 1.6-4 4.4-4.4zM10.1 11.4c-3.3.2-5.1-1.2-5.4-3.6 2.4-.3 4.3.9 5.4 3.6z" />
    </>
  ),
  summer: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  monsoon: <path d="M7 15.5a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.2 8 3.8 3.8 0 0 1 17 15.5H7zM8.5 18.5l-1 2M12.5 18.5l-1 2M16.5 18.5l-1 2" />,
  autumn: <path d="M5 19c0-8 5-13.5 14-14-.5 9-6 14-14 14zM5 19l7.5-7.5" />
};

// Each season's mark has its own colour, taken from its painting.
const seasonColours: Record<string, string> = {
  winter: "text-season-winter",
  spring: "text-season-spring",
  summer: "text-season-summer",
  monsoon: "text-season-monsoon",
  autumn: "text-season-autumn"
};

export const SeasonIcon = ({ name, size = 16 }: P & { name: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={seasonColours[name.toLowerCase()] ?? "text-ink-muted"}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {seasonPaths[name.toLowerCase()] ?? <circle cx="12" cy="12" r="3" />}
  </svg>
);

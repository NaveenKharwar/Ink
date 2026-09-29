import { useState } from "react";
import { AccountMenu } from "./AccountMenu";
import { MenuIcon, PencilIcon } from "./icons";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// The collapsed desktop sidebar.
type Props = { email: string; onExpand: () => void; onWrite: () => void; onSignOut: () => void };

export function Rail({ email, onExpand, onWrite, onSignOut }: Props) {
  const [tip, setTip] = useState(false);
  return (
    <nav
      aria-label="Main"
      className="box-border flex w-[58px] shrink-0 flex-col items-center gap-1.5 rounded-panel border border-line bg-surface py-2.5"
    >
      <div className="relative" onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
        <button
          type="button"
          onClick={onExpand}
          onFocus={() => setTip(true)}
          onBlur={() => setTip(false)}
          aria-label="Open menu"
          className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border-0 bg-surface-hover p-0 text-ink ${focusRing}`}
        >
          <MenuIcon />
        </button>
        {tip && (
          <div
            role="tooltip"
            className="absolute top-0.5 left-[52px] z-10 flex items-center gap-[18px] rounded-md bg-tooltip px-3 py-[9px] text-[13px] whitespace-nowrap text-white shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
          >
            Open menu <span className="rounded-sm bg-tooltip-key px-[7px] py-0.5 text-[12px]">⌘ \</span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onWrite}
        aria-label="Write"
        aria-current="page"
        className={`mt-1.5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border-0 bg-surface-hover p-0 text-ink ${focusRing}`}
      >
        <PencilIcon />
      </button>
      <div className="grow" />
      <AccountMenu compact email={email} onSignOut={onSignOut} />
    </nav>
  );
}

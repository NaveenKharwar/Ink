import { ApiCheck } from "../dev/ApiCheck";
import { MenuIcon, PencilIcon } from "./icons";

type Props = {
  phone?: boolean;
  onCollapse: () => void;
  onWrite: () => void;
  onSignOut: () => void;
};

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Search, Home, All writing and the seasons arrive with the library view.
export function Sidebar({ phone = false, onCollapse, onWrite, onSignOut }: Props) {
  return (
    <nav
      aria-label="Main"
      className={`box-border flex shrink-0 flex-col overflow-y-auto bg-surface px-3 py-4 ${
        phone ? "h-full w-[300px] border-r border-line" : "w-[264px] rounded-panel border border-line"
      }`}
    >
      <div className="flex items-start gap-3 px-2 pt-1 pb-[18px]">
        <button
          type="button"
          onClick={onCollapse}
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
        onClick={onWrite}
        aria-current="page"
        className={`box-border flex h-9 w-full cursor-pointer items-center gap-3 rounded-md border-0 bg-surface-hover px-3 text-left font-semibold text-ink ${focusRing}`}
      >
        <PencilIcon />
        Write
      </button>
      <div className="grow" />
      {import.meta.env.DEV && <ApiCheck />}
      <button
        type="button"
        onClick={onSignOut}
        className={`self-start cursor-pointer rounded-md border-0 bg-transparent px-3 py-1 text-[13px] text-ink-muted hover:text-ink ${focusRing}`}
      >
        Sign out
      </button>
    </nav>
  );
}

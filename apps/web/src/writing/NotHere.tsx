import { MenuIcon } from "./icons";

type Props = {
  showMenuButton: boolean;
  onMenu: () => void;
  /** The note in the middle of the page, or nothing while a wait or a loader fills it. */
  children: React.ReactNode;
};

// The quiet page shown when there is nothing to open: the menu button and a note in the middle.
export function QuietPage({ showMenuButton, onMenu, children }: Props) {
  return (
    <>
      {showMenuButton && (
        <div className="flex h-[52px] shrink-0 items-center pl-1">
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open menu"
            className="touch-44 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <MenuIcon />
          </button>
        </div>
      )}
      <div className="flex grow flex-col items-center justify-center gap-4 px-6 text-center text-ink-muted">{children}</div>
    </>
  );
}

// A piece or a page that is not here, with one way on: a new piece.
export function NotHere({ what, onWrite, ...page }: Omit<Props, "children"> & { what: "piece" | "page"; onWrite: () => void }) {
  return (
    <QuietPage {...page}>
      <p className="m-0">This {what} isn't here.</p>
      <button
        type="button"
        onClick={onWrite}
        className="cursor-pointer rounded-md border border-line bg-transparent px-3 py-1.5 text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Write something new
      </button>
    </QuietPage>
  );
}

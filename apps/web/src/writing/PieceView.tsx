import { Loader } from "../lib/Loader";
import { MenuIcon } from "./icons";
import { Page } from "./Page";
import { usePieceLoad } from "./usePieceLoad";

type PageProps = Omit<React.ComponentProps<typeof Page>, "opened">;

type Props = PageProps & {
  /** True when the piece already exists and has to be loaded; false for a new blank piece. */
  open: boolean;
  onWrite: () => void;
};

// A piece: the page once it is loaded, or a quiet note while it loads or if it cannot be opened.
export function PieceView({ open, onWrite, ...page }: Props) {
  const load = usePieceLoad(page.userId, open ? page.pieceId : null);

  if (load.status === "ready") return <Page {...page} opened={load.piece} />;

  return (
    <>
      {!page.wide && (
        <div className="flex h-[52px] shrink-0 items-center pl-1">
          <button
            type="button"
            onClick={page.onMenu}
            aria-label="Open menu"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <MenuIcon />
          </button>
        </div>
      )}
      <div className="flex grow flex-col items-center justify-center gap-4 px-6 text-center text-ink-muted">
        {load.status === "loading" && <Loader size={28} delayMs={300} label="Opening" />}
        {load.status === "missing" && (
          <>
            <p className="m-0">This piece isn't here.</p>
            <NoteButton onClick={onWrite}>Write something new</NoteButton>
          </>
        )}
        {load.status === "error" && (
          <>
            <p className="m-0">Couldn't open this piece. Check your connection.</p>
            <NoteButton onClick={load.retry}>Try again</NoteButton>
          </>
        )}
      </div>
    </>
  );
}

function NoteButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-md border border-line bg-transparent px-3 py-1.5 text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  );
}

import { useEffect } from "react";
import { ScreenLoader } from "../ui/Loader";
import { NotHere, QuietPage } from "./NotHere";
import { Page } from "./Page";
import { usePieceLoad } from "./usePieceLoad";

type PageProps = Omit<React.ComponentProps<typeof Page>, "opened">;

type Props = PageProps & {
  /** True when the piece already exists and has to be loaded; false for a new blank piece. */
  open: boolean;
  onWrite: () => void;
  /** Told once the piece turns out not to be here, so the screen can leave out what belongs to a piece. */
  onMissing: (id: string) => void;
};

// A piece: the page once it is loaded, or a quiet note while it loads or if it cannot be opened.
export function PieceView({ open, onWrite, onMissing, ...page }: Props) {
  const load = usePieceLoad(page.userId, open ? page.pieceId : null);
  const missing = load.status === "missing";
  useEffect(() => {
    if (missing) onMissing(page.pieceId);
  }, [missing, page.pieceId, onMissing]);

  if (load.status === "ready") return <Page {...page} opened={load.piece} />;
  if (load.status === "missing") return <NotHere what="piece" showMenuButton={page.showMenuButton} onMenu={page.onMenu} onWrite={onWrite} />;

  return (
    <QuietPage showMenuButton={page.showMenuButton} onMenu={page.onMenu}>
      {load.status === "loading" && <ScreenLoader label="Opening" />}
    </QuietPage>
  );
}

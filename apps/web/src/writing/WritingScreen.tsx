import { useEffect, useRef, useState, type PointerEvent } from "react";
import { sync } from "../lib/localSave";
import { supabase } from "../lib/supabase";
import { useMediaQuery } from "../lib/useMediaQuery";
import { InkSeesPanel } from "./InkSeesPanel";
import { parseRoute } from "../lib/route";
import { PieceView } from "./PieceView";
import { Rail } from "./Rail";
import { Sidebar } from "./Sidebar";

type PhonePos = "menu" | "page" | "panel";

const PHONE_OFFSET: Record<PhonePos, string> = {
  menu: "0px",
  page: "-300px",
  // The panel slides in until only 90px of the page is left.
  panel: "calc(-100vw - 210px)"
};

const typingInPage = () => !!document.activeElement?.closest(".ProseMirror");

// What the address says to show: a blank page, or a piece to open. A piece that cannot exist
// (`/p/nonsense`) is shown as not found, like someone else's piece.
type Target = { id: string; open: boolean };
const blank = (): Target => ({ id: crypto.randomUUID(), open: false });
function targetFromAddress(): Target {
  const route = parseRoute(window.location.pathname);
  if (route.kind === "piece") return { id: route.id, open: true };
  if (route.kind === "missing") return { id: crypto.randomUUID(), open: true };
  return blank();
}

export function WritingScreen({ email, userId }: { email: string; userId: string }) {
  const wide = useMediaQuery("(min-width: 1024px)");
  const [target, setTarget] = useState<Target>(targetFromAddress);
  const [collapsed, setCollapsed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [pos, setPos] = useState<PhonePos>("page");
  const swipeStart = useRef<number | null>(null);

  const newPiece = () => {
    if (window.location.pathname !== "/") window.history.pushState(null, "", "/");
    setTarget(blank());
    setPos("page");
  };

  // Back and forward move between pieces.
  useEffect(() => {
    const onPop = () => setTarget(targetFromAddress());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // Send what is still on the device before the token goes away (never wait more than 2s).
  const signOut = async () => {
    await Promise.race([sync.syncAll(userId), new Promise((r) => setTimeout(r, 2000))]);
    await supabase.auth.signOut();
    // The next writer must not land on this one's piece.
    window.history.replaceState(null, "", "/");
  };

  // Writing left on this device by an earlier visit (a crash, a closed tab, no connection)
  // goes up now, and again whenever the connection returns.
  useEffect(() => {
    const send = () => void sync.syncAll(userId);
    send();
    window.addEventListener("online", send);
    return () => window.removeEventListener("online", send);
  }, [userId]);

  // ⌘\ opens and closes the menu from anywhere. ⌘B is always Bold.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\" && wide) {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wide]);

  const page = (
    <PieceView
      key={target.id}
      open={target.open}
      onWrite={newPiece}
      pieceId={target.id}
      userId={userId}
      wide={wide}
      showSparkle={!wide || !panelOpen}
      onSparkle={() => (wide ? setPanelOpen(true) : setPos("panel"))}
      onMenu={() => setPos("menu")}
    />
  );

  if (wide) {
    return (
      <div className="fixed inset-0 box-border flex gap-2 bg-ground p-3">
        {collapsed ? (
          <Rail email={email} onExpand={() => setCollapsed(false)} onWrite={newPiece} onSignOut={() => void signOut()} />
        ) : (
          <Sidebar email={email} onCollapse={() => setCollapsed(true)} onWrite={newPiece} onSignOut={() => void signOut()} />
        )}
        <main className="relative flex min-w-0 grow flex-col overflow-hidden rounded-panel border border-line bg-surface">
          {page}
        </main>
        {panelOpen && <InkSeesPanel onClose={() => setPanelOpen(false)} />}
      </div>
    );
  }

  // Phone: menu, page and panel on one track that slides; nothing overlays the page.
  const onPointerDown = (e: PointerEvent) => {
    swipeStart.current = e.pointerType === "touch" && !typingInPage() ? e.clientX : null;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (swipeStart.current == null) return;
    const dx = e.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(dx) < 50) return;
    const order: PhonePos[] = ["menu", "page", "panel"];
    const next = order[Math.min(2, Math.max(0, order.indexOf(pos) + (dx < 0 ? 1 : -1)))];
    setPos(next);
  };

  return (
    <div className="fixed inset-0 touch-pan-y overflow-hidden bg-surface" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <div
        className="absolute top-0 left-0 flex h-full transition-transform duration-[360ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
        style={{ width: "calc(100vw + 600px)", transform: `translateX(${PHONE_OFFSET[pos]})` }}
      >
        <div inert={pos !== "menu"} className="h-full">
          <Sidebar phone email={email} onCollapse={() => setPos("page")} onWrite={newPiece} onSignOut={() => void signOut()} />
        </div>
        <main className="relative flex h-full w-screen shrink-0 flex-col overflow-hidden bg-surface">
          <div inert={pos !== "page"} className="flex h-full flex-col">
            {page}
          </div>
          {pos !== "page" && (
            <button
              type="button"
              aria-label="Back to the page"
              onClick={() => setPos("page")}
              className="absolute inset-0 z-10 cursor-pointer border-0 bg-ground/45 p-0"
            />
          )}
        </main>
        <div inert={pos !== "panel"} className="h-full">
          <InkSeesPanel phone onClose={() => setPos("page")} />
        </div>
      </div>
    </div>
  );
}

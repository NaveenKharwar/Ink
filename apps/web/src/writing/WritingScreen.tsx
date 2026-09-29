import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { sync } from "../lib/localSave";
import { ALL_WRITING, parseRoute, pieceAddress } from "../lib/route";
import { groupBySeason, seasonText } from "../lib/seasons";
import { supabase } from "../lib/supabase";
import { useMediaQuery } from "../lib/useMediaQuery";
import { AllWriting } from "./AllWriting";
import { InkSeesPanel } from "./InkSeesPanel";
import { PieceView } from "./PieceView";
import { SearchDialog } from "./SearchDialog";
import { Sidebar } from "./Sidebar";
import { useLibrary } from "./useLibrary";

type PhonePos = "menu" | "page" | "panel";

const PHONE_OFFSET: Record<PhonePos, string> = {
  menu: "0px",
  page: "-300px",
  // The panel slides in until only 90px of the page is left.
  panel: "calc(-100vw - 210px)"
};

const typingInPage = () => !!document.activeElement?.closest(".ProseMirror");

// What the address says to show: a blank page, a piece to open, or All writing. A piece that
// cannot exist (`/p/nonsense`) is shown as not found, like someone else's piece.
type Target = { id: string; open: boolean };
type View = { kind: "piece"; target: Target } | { kind: "all"; season: string | null };

const blank = (): View => ({ kind: "piece", target: { id: crypto.randomUUID(), open: false } });
function viewFromAddress(): View {
  const route = parseRoute(window.location.pathname);
  if (route.kind === "all") return { kind: "all", season: null };
  if (route.kind === "piece") return { kind: "piece", target: { id: route.id, open: true } };
  if (route.kind === "missing") return { kind: "piece", target: { id: crypto.randomUUID(), open: true } };
  return blank();
}

const SLIDE = "transition-[translate,opacity] duration-[360ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none";

export function WritingScreen({ email, userId }: { email: string; userId: string }) {
  const wide = useMediaQuery("(min-width: 1024px)");
  const [view, setView] = useState<View>(viewFromAddress);
  // Desktop: the menu opens beside the page when asked; Ink sees this too starts open.
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pos, setPos] = useState<PhonePos>("page");
  const swipeStart = useRef<number | null>(null);
  const library = useLibrary();

  const go = (address: string, next: View) => {
    if (window.location.pathname !== address) window.history.pushState(null, "", address);
    setView(next);
    setMenuOpen(false);
    setSearchOpen(false);
    setPos("page");
  };
  const newPiece = () => go("/", blank());
  const openPiece = (id: string) => go(pieceAddress(id), { kind: "piece", target: { id, open: true } });
  const openAll = (season: string | null = null) => go(ALL_WRITING, { kind: "all", season });

  // Back and forward move between pieces and All writing.
  useEffect(() => {
    const onPop = () => setView(viewFromAddress());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // The list is fetched again whenever it is about to be seen, so a piece written a moment ago is in it.
  const menuShown = wide ? menuOpen : pos === "menu";
  const { refresh } = library;
  useEffect(() => {
    if (menuShown || view.kind === "all" || searchOpen) refresh();
  }, [menuShown, view.kind, searchOpen, refresh]);

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

  // ⌘\ opens and closes the menu, ⌘K opens search, from anywhere. ⌘B is always Bold.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "\\" && wide) {
        e.preventDefault();
        setMenuOpen((open) => !open);
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape" && wide && menuOpen && !searchOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wide, menuOpen, searchOpen]);

  const groups = useMemo(() => (library.items ? groupBySeason(library.items) : null), [library.items]);
  const seasons = (groups ?? []).map((g) => ({ key: g.key, label: g.label, divider: g.divider, count: g.items.length }));
  const recent = useMemo(
    () => [...(library.items ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    [library.items]
  );

  const activeSeason = view.kind === "all" ? view.season : null;
  const seasonGroup = activeSeason ? groups?.find((g) => g.key === activeSeason) : null;
  const pieceSeason = (id: string) => {
    const item = library.items?.find((i) => i.id === id);
    return item ? seasonText(new Date(item.createdAt)) : "Now";
  };

  const sidebarProps = {
    email,
    screen: view.kind === "all" ? ("all" as const) : ("write" as const),
    seasons,
    activeSeason,
    onSearch: () => setSearchOpen(true),
    onWrite: newPiece,
    onAll: () => openAll(),
    onSeason: (key: string) => openAll(key),
    onSignOut: () => void signOut()
  };

  const onMenu = () => (wide ? setMenuOpen(true) : setPos("menu"));
  const page =
    view.kind === "all" ? (
      <AllWriting
        wide={wide}
        showMenuButton={!wide || !menuOpen}
        onMenu={onMenu}
        groups={seasonGroup ? [{ ...seasonGroup, divider: null, label: seasonGroup.text }] : activeSeason && groups ? [] : groups}
        failed={library.failed}
        onRetry={refresh}
        season={seasonGroup?.text ?? null}
        onClearSeason={() => setView({ kind: "all", season: null })}
        onOpen={openPiece}
      />
    ) : (
      <PieceView
        key={view.target.id}
        open={view.target.open}
        onWrite={newPiece}
        pieceId={view.target.id}
        userId={userId}
        wide={wide}
        season={pieceSeason(view.target.id)}
        showMenuButton={!wide || !menuOpen}
        showSparkle={!wide || !panelOpen}
        onSparkle={() => (wide ? setPanelOpen(true) : setPos("panel"))}
        onMenu={onMenu}
      />
    );

  const search = searchOpen && (
    <SearchDialog wide={wide} recent={recent} onOpen={openPiece} onClose={() => setSearchOpen(false)} />
  );

  if (wide) {
    const panelShown = panelOpen && view.kind === "piece";
    return (
      <div className="fixed inset-0 bg-ground">
        <main className="relative mx-auto box-border flex h-full w-[820px] max-w-full flex-col overflow-hidden border-x border-line bg-surface">
          {page}
        </main>
        {menuOpen && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-20 cursor-default border-0 bg-transparent p-0"
          />
        )}
        <div
          inert={!menuOpen}
          className={`fixed top-3 bottom-3 left-0 z-30 flex rounded-r-panel shadow-[8px_0_24px_rgba(0,0,0,0.08)] ${SLIDE} ${
            menuOpen ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-[300px] opacity-0"
          }`}
        >
          <Sidebar {...sidebarProps} onClose={() => setMenuOpen(false)} />
        </div>
        <div
          inert={!panelShown}
          className={`fixed top-3 right-0 bottom-3 z-30 flex rounded-l-panel shadow-[-8px_0_24px_rgba(0,0,0,0.08)] ${SLIDE} ${
            panelShown ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[320px] opacity-0"
          }`}
        >
          <InkSeesPanel onClose={() => setPanelOpen(false)} />
        </div>
        {search}
      </div>
    );
  }

  // Phone: menu, page and panel on one track that slides; nothing overlays the page.
  // All writing has no panel, so it moves between the menu and the page only.
  const order: PhonePos[] = view.kind === "all" ? ["menu", "page"] : ["menu", "page", "panel"];
  const onPointerDown = (e: PointerEvent) => {
    swipeStart.current = e.pointerType === "touch" && !typingInPage() && !searchOpen ? e.clientX : null;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (swipeStart.current == null) return;
    const dx = e.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(dx) < 50) return;
    const at = Math.max(0, order.indexOf(pos));
    setPos(order[Math.min(order.length - 1, Math.max(0, at + (dx < 0 ? 1 : -1)))]!);
  };

  return (
    <div className="fixed inset-0 touch-pan-y overflow-hidden bg-surface" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <div
        className="absolute top-0 left-0 flex h-full transition-transform duration-[360ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
        style={{ width: "calc(100vw + 600px)", transform: `translateX(${PHONE_OFFSET[pos]})` }}
      >
        <div inert={pos !== "menu"} className="h-full">
          <Sidebar phone {...sidebarProps} onClose={() => setPos("page")} />
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
      {search}
    </div>
  );
}

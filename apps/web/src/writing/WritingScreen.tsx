import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { PieceStatus, RelatedNote } from "@ink/schemas";
import { TETHER_VISITS, countTetherVisit, type Account } from "../lib/account";
import { sync } from "../lib/localSave";
import { ALL_WRITING, PICTURES, PROFILE, parseRoute, pieceAddress } from "../lib/route";
import { deviceTimeZone, groupBySeason, resolveSeasonSet, seasonText } from "../lib/seasons";
import { supabase } from "../lib/supabase";
import { NARROW_PAPER, READER_GAP, sheetRoom } from "../lib/beside";
import { useViewportWidth } from "../lib/useViewportWidth";
import { useWide } from "../lib/layout";
import { AllWriting } from "./AllWriting";
import { BesidePaper } from "./BesidePaper";
import { InkSeesPanel } from "./InkSeesPanel";
import { PicturesPage } from "./PicturesPage";
import { PieceView } from "./PieceView";
import { Profile } from "./Profile";
import { SearchDialog } from "./SearchDialog";
import { Sidebar } from "./Sidebar";
import { Tether, type TetherState } from "./Tether";
import { useDesktopLayout } from "./useDesktopLayout";
import { useLibrary } from "./useLibrary";
import { newId } from "../lib/newId";
import { useVisibleArea } from "../lib/visibleArea";

type PhonePos = "menu" | "page" | "panel" | "reader";

// The track is menu · page · panel; each sheet is --phone-sheet-width wide (styles.css). The
// panel sits flush with the right edge, mirroring the menu on the left.
const PHONE_OFFSET: Record<PhonePos, string> = {
  menu: "0px",
  page: "calc(-1 * var(--phone-sheet-width))",
  panel: "calc(-2 * var(--phone-sheet-width))",
  // An older piece opened from the panel is one more screen after it, as wide as the phone.
  reader: "calc(-2 * var(--phone-sheet-width) - 100vw)"
};

const typingInPage = () => !!document.activeElement?.closest(".ProseMirror");

// What the address says to show: a blank page, a piece to open, or All writing. A piece that
// cannot exist (`/p/nonsense`) is shown as not found, like someone else's piece.
type Target = { id: string; open: boolean };
type View = { kind: "piece"; target: Target } | { kind: "all"; season: string | null; filter: PieceStatus | null } | { kind: "pictures" } | { kind: "profile" };

const blank = (): View => ({ kind: "piece", target: { id: newId(), open: false } });
function viewFromAddress(): View {
  const route = parseRoute(window.location.pathname);
  if (route.kind === "all") return { kind: "all", season: null, filter: null };
  if (route.kind === "profile") return { kind: "profile" };
  if (route.kind === "pictures") return { kind: "pictures" };
  if (route.kind === "piece") return { kind: "piece", target: { id: route.id, open: true } };
  if (route.kind === "missing") return { kind: "piece", target: { id: newId(), open: true } };
  return blank();
}

// Desktop menu: open or closed is remembered on this device until the writer changes it
// (closed the first time).
function readRemembered(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "1";
  } catch {
    return fallback;
  }
}
function remember(key: string, open: boolean) {
  try {
    localStorage.setItem(key, open ? "1" : "0");
  } catch {
    // Storage blocked: the menu just starts closed next time.
  }
}
function useRememberedOpen(key: string, fallback: boolean) {
  const [open, setOpen] = useState(() => readRemembered(key, fallback));
  useEffect(() => remember(key, open), [key, open]);
  return [open, setOpen] as const;
}

const tetherForced = import.meta.env.DEV && new URLSearchParams(window.location.search).has("tether");

const SLIDE = "transition-[translate,opacity] duration-[360ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none";

export function WritingScreen({ account, userId }: { account: Account; userId: string }) {
  // Desktop or phone, from the app's one breakpoint (lib/layout.ts).
  const wide = useWide();
  const [view, setView] = useState<View>(viewFromAddress);
  // Desktop: the menu stays as the writer left it (until ☰). Ink sees this too opens on every
  // load, so writers always meet it; × hides it for this visit only.
  const [menuOpen, setMenuOpen] = useRememberedOpen("ink-menu-open", false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pos, setPos] = useState<PhonePos>("page");
  // The piece being written; the desktop layout and the older pieces being read belong to it.
  const openPieceId = view.kind === "piece" ? view.target.id : null;
  // How the desktop screen is shared (menu, page, reading paper, panel) and which older pieces are
  // being read: all of it in one place, see useDesktopLayout.
  const shell = useDesktopLayout({ menuPreferred: menuOpen, setMenuPreferred: setMenuOpen, panelOpen, pieceId: openPieceId });
  const { tabs } = shell;
  // The older piece read last: when its words are no longer beside the page (the paper waits, or
  // reading ended) the panel shows that note chosen, so the writer sees which one it was.
  const [lastRead, setLastRead] = useState<string | null>(null);
  useEffect(() => {
    if (shell.active) setLastRead(shell.active);
  }, [shell.active]);
  useEffect(() => setLastRead(null), [openPieceId]);
  // A narrow paper gets smaller side margins so its words keep as much width as they can.
  const viewport = useViewportWidth();
  const pageWidth = shell.layout.reading ? shell.layout.reading.page : viewport - 2 * sheetRoom(viewport);
  const narrowPage = pageWidth < NARROW_PAPER;
  const menuVisible = wide ? shell.menuVisible : menuOpen;
  const swipeStart = useRef<number | null>(null);
  const library = useLibrary();
  // On a writer's first visits, a thread invites them to "Ink sees this too" (then never again).
  // In development, `?tether` in the address shows it anyway, without counting a visit.
  const [tether, setTether] = useState<TetherState | "gone">(() =>
    account.tetherVisits < TETHER_VISITS || tetherForced ? "hang" : "gone"
  );

  const go = (address: string, next: View) => {
    if (window.location.pathname !== address) window.history.pushState(null, "", address);
    setView(next);
    setSearchOpen(false);
    setPos("page");
  };
  const newPiece = () => go("/", blank());
  const openPiece = (id: string) => go(pieceAddress(id), { kind: "piece", target: { id, open: true } });
  const openAll = (season: string | null = null, filter: PieceStatus | null = null) => go(ALL_WRITING, { kind: "all", season, filter });
  const openPictures = () => go(PICTURES, { kind: "pictures" });
  // Back to writing returns to where Profile was opened from (a blank page if opened directly).
  const beforeProfile = useRef<{ address: string; view: View } | null>(null);
  const openProfile = () => {
    if (view.kind !== "profile") beforeProfile.current = { address: window.location.pathname, view };
    go(PROFILE, { kind: "profile" });
  };
  const leaveProfile = () => {
    const back = beforeProfile.current;
    if (back) go(back.address, back.view);
    else newPiece();
  };

  // An older piece to read: beside the page on desktop, the screen after the panel on a phone.
  const openBeside = (note: RelatedNote) => {
    shell.read(note);
    if (!wide) setPos("reader");
  };
  const closeTab = (id: string) => {
    if (wide) shell.close(id);
    else {
      // One piece at a time here: slide back to the panel first, then forget what was being read.
      setPos("panel");
      window.setTimeout(() => shell.stop(), 380);
    }
  };
  // The writer deleted the open piece: the list forgets it and a blank page opens.
  const deleted = () => {
    library.refresh();
    newPiece();
  };
  const readOlderPiece = (id: string) => {
    shell.stop();
    openPiece(id);
  };

  // Back and forward move between pieces and All writing.
  useEffect(() => {
    const onPop = () => setView(viewFromAddress());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // The list is fetched again whenever it is about to be seen, so a piece written a moment ago is in it.
  // The desktop menu can stay open, so moving to another piece or screen fetches it too.
  const menuShown = wide ? menuVisible : pos === "menu";
  const { refresh } = library;
  useEffect(() => {
    if (menuShown || view.kind === "all" || view.kind === "profile" || searchOpen) refresh();
  }, [menuShown, view, searchOpen, refresh]);

  // Send what is still on the device before the token goes away (never wait more than 2s).
  const signOut = async () => {
    await Promise.race([sync.syncAll(userId), new Promise((r) => setTimeout(r, 2000))]);
    // This device only: the writer's other devices stay signed in (a new password ends those).
    await supabase.auth.signOut({ scope: "local" });
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

  useEffect(() => {
    if (account.tetherVisits < TETHER_VISITS && !tetherForced) countTetherVisit(account.tetherVisits);
    // Counted once, for the visit the app opened with.
  }, []);

  // The thread lets go when it has done its job: on desktop once the writer has written three
  // lines (or closes the panel), on phone as soon as they open the panel. It only hangs on a
  // piece: on other screens it waits, and hangs again when the writer is back on a piece.
  const tetherHangs = tether === "hang";
  useEffect(() => {
    if (!tetherHangs || view.kind !== "piece") return;
    if (wide && !panelOpen) setTether("drift");
    else if (!wide && pos === "panel") setTether("fall");
  }, [tetherHangs, view.kind, wide, panelOpen, pos]);
  useEffect(() => {
    if (!tetherHangs || !wide) return;
    let lines = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.isComposing || !typingInPage()) return;
      lines += 1;
      if (lines >= 3) setTether("drift");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tetherHangs, wide]);
  const thread = tether !== "gone" && view.kind === "piece" && (
    <Tether
      key={wide ? "wide" : "phone"}
      anchor={wide ? "panel" : "mark"}
      side={wide ? "left" : "bottom"}
      note={wide ? "Look here." : "Peek inside."}
      state={tether}
      pointerWind={wide}
      onGone={() => setTether("gone")}
    />
  );

  // ⌘\ opens and closes the menu, ⌘K opens search, from anywhere. ⌘B is always Bold.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "\\" && wide) {
        e.preventDefault();
        shell.toggleMenu();
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wide, shell.toggleMenu]);

  // Seasons follow the device's time zone unless the writer chose a set in Profile.
  const timeZone = deviceTimeZone();
  const seasonSet = resolveSeasonSet(account.seasons, timeZone);
  const groups = useMemo(
    () => (library.items ? groupBySeason(library.items, new Date(), timeZone, seasonSet) : null),
    [library.items, timeZone, seasonSet]
  );
  const seasons = (groups ?? []).map((g) => ({ key: g.key, label: g.label, divider: g.divider, count: g.items.length }));
  const recent = useMemo(
    () => [...(library.items ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    [library.items]
  );

  const activeSeason = view.kind === "all" ? view.season : null;
  const activeFilter = view.kind === "all" ? view.filter : null;
  const counts = useMemo(() => {
    const items = library.items ?? [];
    return { draft: items.filter((i) => i.status === "draft").length, finished: items.filter((i) => i.status === "finished").length };
  }, [library.items]);
  // Drafts or Finished: the same seasons, with only those pieces in them.
  const filteredGroups = useMemo(
    () =>
      library.items && activeFilter
        ? groupBySeason(library.items.filter((i) => i.status === activeFilter), new Date(), timeZone, seasonSet)
        : null,
    [library.items, activeFilter, timeZone, seasonSet]
  );
  const seasonGroup = activeSeason ? groups?.find((g) => g.key === activeSeason) : null;
  // What All writing lists: every season, or only the chosen one (under its full name). Kept
  // stable between renders so the list's scroll tracking isn't rebuilt each time.
  const shownGroups = useMemo(
    () =>
      activeFilter
        ? filteredGroups
        : seasonGroup
          ? [{ ...seasonGroup, divider: null, label: seasonGroup.text }]
          : activeSeason && groups
            ? []
            : groups,
    [activeFilter, filteredGroups, seasonGroup, activeSeason, groups]
  );
  const pieceSeason = (id: string) => {
    const item = library.items?.find((i) => i.id === id);
    return item ? seasonText(new Date(item.createdAt), new Date(), timeZone, seasonSet) : "Now";
  };

  // One mark at a time. A saved piece is marked by the season it lives in (All writing, narrowed to
  // a season, marks that season). A new page that is not saved yet marks Write instead, and so
  // does nothing else; until the library has loaded a piece is not known to be new, so nothing is marked.
  const pieceSaved = openPieceId !== null && library.items ? library.items.some((i) => i.id === openPieceId) : null;
  const menuSeason =
    view.kind === "all"
      ? view.season
      : pieceSaved
        ? (groups?.find((g) => g.items.some((i) => i.id === openPieceId))?.key ?? null)
        : null;
  const menuScreen = view.kind === "piece" ? (pieceSaved === false ? ("write" as const) : ("piece" as const)) : view.kind;

  const sidebarProps = {
    name: account.penName ?? account.email,
    screen: menuScreen,
    seasons,
    activeSeason: menuSeason,
    activeFilter,
    counts,
    onSearch: () => setSearchOpen(true),
    onWrite: newPiece,
    onAll: () => openAll(),
    onPictures: openPictures,
    onSeason: (key: string) => openAll(key),
    onFilter: (status: PieceStatus) => openAll(null, status),
    onProfile: openProfile
  };

  const onMenu = () => {
    if (wide) shell.openMenu();
    else setPos("menu");
  };
  const page =
    view.kind === "profile" ? (
      <Profile
        account={account}
        items={library.items}
        wide={wide}
        showMenuButton={!wide || !menuVisible}
        onMenu={onMenu}
        onBack={leaveProfile}
        onSignOut={signOut}
      />
    ) : view.kind === "pictures" ? (
      <PicturesPage
        wide={wide}
        showMenuButton={!wide || !menuVisible}
        onMenu={onMenu}
        seasonOf={(createdAt) => seasonText(new Date(createdAt), new Date(), deviceTimeZone(), seasonSet)}
        onOpenPiece={openPiece}
      />
    ) : view.kind === "all" ? (
      <AllWriting
        wide={wide}
        showMenuButton={!wide || !menuVisible}
        onMenu={onMenu}
        seasonSet={seasonSet}
        groups={shownGroups}
        narrowedTo={seasonGroup ? { label: seasonGroup.text, clear: `Show all seasons, not only ${seasonGroup.text}` } : activeFilter ? { label: activeFilter === "draft" ? "Drafts" : "Finished", clear: `Show all writing, not only ${activeFilter === "draft" ? "drafts" : "finished pieces"}` } : null}
        onClearNarrowing={() => setView({ kind: "all", season: null, filter: null })}
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
        showMenuButton={!wide || !menuVisible}
        panelOpen={wide ? shell.panelVisible : pos === "panel"}
        onPanelToggle={() => {
          if (!wide) setPos(pos === "panel" ? "page" : "panel");
          else if (shell.panelSteppedAside) shell.showPanel();
          else {
            if (panelOpen) shell.panelClosed();
            setPanelOpen((open) => !open);
          }
        }}
        onMenu={onMenu}
      />
    );

  const search = searchOpen && (
    <SearchDialog wide={wide} recent={recent} seasonSet={seasonSet} onOpen={openPiece} onClose={() => setSearchOpen(false)} />
  );

  // Phone: the part of the screen actually showing (the keyboard can cover the rest).
  const visible = useVisibleArea(!wide);

  if (wide) {
    const panelShown = shell.panelVisible && view.kind === "piece";
    const reading = shell.layout.reading;
    return (
      <div className="fixed inset-0 bg-ground">
        <div
          className="absolute inset-0 flex justify-center"
          style={reading ? { paddingLeft: reading.left, paddingRight: reading.right } : undefined}
        >
          <main
            className="relative box-border flex h-full shrink-0 flex-col overflow-hidden border-x border-line bg-surface"
            style={{ width: reading ? reading.page : "var(--paper-width)", ...(narrowPage ? ({ "--page-gutter": "24px" } as React.CSSProperties) : null) }}
          >
            {page}
          </main>
          {reading && (
            <div className="h-full shrink-0" style={{ marginLeft: READER_GAP, width: reading.reader }}>
              <BesidePaper
                narrow={reading.reader < 400}
                tabs={tabs}
                active={shell.active ?? tabs[0]!.id}
                seasonSet={seasonSet}
                onSelect={shell.select}
                onClose={closeTab}
                onOpenPiece={readOlderPiece}
              />
            </div>
          )}
        </div>
        <div
          inert={!menuVisible}
          className={`fixed top-3 bottom-3 left-0 z-30 flex rounded-r-panel shadow-[8px_0_24px_rgba(0,0,0,0.08)] ${SLIDE} ${
            menuVisible ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-[calc(var(--sheet-width)+12px)] opacity-0"
          }`}
        >
          <Sidebar {...sidebarProps} onClose={shell.closeMenu} />
        </div>
        <div
          inert={!panelShown}
          className={`fixed top-3 right-0 bottom-3 z-30 flex rounded-l-panel shadow-[-8px_0_24px_rgba(0,0,0,0.08)] ${SLIDE} ${
            panelShown ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[calc(var(--sheet-width)+12px)] opacity-0"
          }`}
        >
          <InkSeesPanel
            key={openPieceId ?? "none"}
            shown={panelShown}
            chosen={panelShown && !shell.layout.reading ? lastRead : null}
            pieceId={openPieceId}
            exists={view.kind === "piece" && view.target.open}
            seasonSet={seasonSet}
            reading={shell.layout.reading ? shell.tabs.map((t) => t.id) : []}
            onClose={() => {
              shell.panelClosed();
              setPanelOpen(false);
            }}
            onOpenBeside={openBeside}
            userId={userId}
            onDeleted={deleted}
          />
        </div>

        {thread}
        {search}
      </div>
    );
  }

  // Phone: menu, page and panel on one track that slides; nothing overlays the page.
  // All writing and Profile have no panel, so they move between the menu and the page only.
  const order: PhonePos[] = view.kind === "piece" ? ["menu", "page", "panel"] : ["menu", "page"];
  const readerShown = view.kind === "piece" && tabs.length > 0;
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
    // `overflow-clip`, not `hidden`: a hidden box can still be scrolled by the browser (it does,
    // to show the cursor when a new piece's editor takes focus), which would shift the track
    // off its sheets. A clipped box can't scroll at all; only the slide moves it.
    <div
      className="fixed inset-x-0 top-0 h-dvh touch-pan-y overflow-clip bg-surface"
      // Sized and placed to the part of the screen the phone shows, so the keyboard (and the
      // browser's own bars) never cover the top bar, the tool bar or the line being typed.
      style={visible ? { top: visible.top, height: visible.height } : undefined}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div
        className="absolute top-0 left-0 flex h-full transition-transform duration-[360ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
        style={{
          width: readerShown ? "calc(200vw + 2 * var(--phone-sheet-width))" : "calc(100vw + 2 * var(--phone-sheet-width))",
          transform: `translateX(${PHONE_OFFSET[pos]})`
        }}
      >
        <div inert={pos !== "menu"} className="h-full">
          <Sidebar phone {...sidebarProps} onClose={() => setPos("page")} />
        </div>
        <main className="relative flex h-full w-screen shrink-0 flex-col overflow-clip bg-surface">
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
          <InkSeesPanel
            key={openPieceId ?? "none"}
            phone
            shown={pos === "panel"}
            pieceId={openPieceId}
            exists={view.kind === "piece" && view.target.open}
            seasonSet={seasonSet}
            onClose={() => setPos("page")}
            onOpenBeside={openBeside}
            userId={userId}
            onDeleted={deleted}
          />
        </div>
        {readerShown && (
          <div inert={pos !== "reader"} className="h-full">
            <BesidePaper
              phone
              tabs={tabs}
              active={shell.active ?? tabs[0]!.id}
              seasonSet={seasonSet}
              onSelect={shell.select}
              onClose={closeTab}
              onOpenPiece={readOlderPiece}
            />
          </div>
        )}
      </div>
      {thread}
      {search}
    </div>
  );
}

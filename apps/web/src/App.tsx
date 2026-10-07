import { useEffect, useState } from "react";
import { SignIn } from "./auth/SignIn";
import { useSession } from "./auth/useSession";
import { accountOf } from "./lib/account";
import { pieces } from "./lib/api";
import { supabase } from "./lib/supabase";
import { clearTrouble, currentTrouble, useTrouble } from "./lib/trouble";
import { BrokenScreen } from "./ui/BrokenScreen";
import { ScreenLoader } from "./ui/Loader";
import { PrivacyPage } from "./privacy/PrivacyPage";
import { WritingScreen } from "./writing/WritingScreen";

// Signing in lands in a blank new piece.
export function App() {
  // The privacy page is public: no sign-in needed to read it.
  if (window.location.pathname === "/privacy") return <PrivacyPage />;
  return <SignedInOrNot />;
}

function SignedInOrNot() {
  const session = useSession();
  const trouble = useTrouble();
  // Trying again starts the writing screen fresh, so everything asks the server again.
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    clearTrouble();
    setAttempt((n) => n + 1);
  };

  // A fresh sign-in or sign-out starts without yesterday's trouble.
  const signedIn = !!session;
  useEffect(() => clearTrouble(), [signedIn]);

  // When the connection comes back, carry on without asking.
  useEffect(() => {
    if (trouble !== "offline") return;
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [trouble]);

  // Nothing of the writer's is shown until the server has said the sign-in is still accepted, so a
  // page is never drawn and then taken away. A failure is reported to lib/trouble by the call itself;
  // any other answer lets the app in, and the page deals with what it finds.
  const checking = session ? `${session.user.id}:${attempt}` : null;
  const [checked, setChecked] = useState<string | null>(null);
  useEffect(() => {
    if (!checking) return;
    let live = true;
    pieces.session().then(
      () => live && setChecked(checking),
      () => live && !currentTrouble() && setChecked(checking)
    );
    return () => {
      live = false;
    };
  }, [checking]);

  if (session === undefined) {
    return <ScreenLoader className="min-h-dvh bg-ground" />;
  }
  if (!session) return <SignIn />;
  // Trouble replaces the writing screen (it does not sit on top of it), so the old page never shows.
  if (trouble) {
    return <BrokenScreen trouble={trouble} onAction={trouble === "signed-out" ? () => void supabase.auth.signOut({ scope: "local" }) : retry} />;
  }
  if (checked !== checking) return <ScreenLoader className="min-h-dvh bg-ground" />;
  return <WritingScreen key={attempt} userId={session.user.id} account={accountOf(session.user)} />;
}

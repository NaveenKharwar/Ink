import { useEffect, useState } from "react";
import { SignIn } from "./auth/SignIn";
import { useSession } from "./auth/useSession";
import { accountOf } from "./lib/account";
import { supabase } from "./lib/supabase";
import { clearTrouble, useTrouble } from "./lib/trouble";
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

  if (session === undefined) {
    return <ScreenLoader className="min-h-dvh bg-ground" />;
  }
  if (!session) return <SignIn />;
  return (
    <>
      <WritingScreen key={attempt} userId={session.user.id} account={accountOf(session.user)} />
      {trouble && <BrokenScreen trouble={trouble} onAction={trouble === "signed-out" ? () => void supabase.auth.signOut({ scope: "local" }) : retry} />}
    </>
  );
}

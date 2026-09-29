import { SignIn } from "./auth/SignIn";
import { useSession } from "./auth/useSession";
import { accountOf } from "./lib/account";
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
  if (session === undefined) {
    return <ScreenLoader className="min-h-dvh bg-ground" />;
  }
  if (!session) return <SignIn />;
  return <WritingScreen userId={session.user.id} account={accountOf(session.user)} />;
}

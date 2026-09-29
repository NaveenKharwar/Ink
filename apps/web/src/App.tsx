import { SignIn } from "./auth/SignIn";
import { useSession } from "./auth/useSession";
import { accountOf } from "./lib/account";
import { Loader } from "./lib/Loader";
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
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ground text-ink-muted">
        <Loader size={28} delayMs={300} />
      </div>
    );
  }
  if (!session) return <SignIn />;
  return <WritingScreen userId={session.user.id} account={accountOf(session.user)} />;
}

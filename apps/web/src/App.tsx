import { SignIn } from "./auth/SignIn";
import { useSession } from "./auth/useSession";
import { WritingScreen } from "./writing/WritingScreen";

// Signing in lands in a blank new piece.
export function App() {
  const session = useSession();
  if (session === undefined) return null;
  if (!session) return <SignIn />;
  return <WritingScreen />;
}

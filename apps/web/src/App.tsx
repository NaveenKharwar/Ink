import { SignIn } from "./auth/SignIn";
import { useSession } from "./auth/useSession";
import { ApiCheck } from "./dev/ApiCheck";
import { supabase } from "./lib/supabase";

export function App() {
  const session = useSession();
  if (session === undefined) return null;
  if (!session) return <SignIn />;
  return (
    <main className="mx-auto max-w-[480px] p-8">
      <p>Signed in as {session.user.email}.</p>
      <button type="button" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
      {import.meta.env.DEV && <ApiCheck />}
    </main>
  );
}

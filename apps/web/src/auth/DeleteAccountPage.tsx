import type { PendingDeletionResponse } from "@ink/schemas";
import { useEffect, useState } from "react";
import { accountOf } from "../lib/account";
import { deletion } from "../lib/api";
import { readDeleteLink } from "../lib/deleteLink";
import { downloadAllWriting } from "../lib/export/downloadAll";
import { buffer } from "../lib/localSave";
import { deviceTimeZone, resolveSeasonSet } from "../lib/seasons";
import { supabase } from "../lib/supabase";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Eyebrow, Heading, LinkButton, MainButton, Message } from "./parts";

type Step = { kind: "checking" } | { kind: "confirm"; pending: PendingDeletionResponse } | { kind: "done" } | { kind: "expired" };

const PROBLEMS = {
  offline: "You seem to be offline. Check your connection and try again.",
  unknown: "Something went wrong on our side. Nothing was deleted. Try again in a moment."
};

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Where the link in the delete-account email lands, on any device, signed in or not. Opening it only
// shows what will go; the account is deleted when the writer presses "Delete for good".
export function DeleteAccountPage() {
  useDocumentTitle("Delete your account");
  // Read once from the #fragment (never sent to a server), then taken out of the address bar.
  const [token] = useState(() => readDeleteLink(window.location.hash));
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const [step, setStep] = useState<Step>(token ? { kind: "checking" } : { kind: "expired" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Signed in on this device as the same writer: the download is offered here too.
  const [signedInAs, setSignedInAs] = useState<{ userId: string; email: string; seasons: ReturnType<typeof accountOf>["seasons"] } | null>(null);
  const [download, setDownload] = useState<"idle" | "working" | "done" | "failed">("idle");

  useEffect(() => {
    if (!token) return;
    let live = true;
    void deletion.check(token).then((answer) => {
      if (!live) return;
      if (answer.ok) return setStep({ kind: "confirm", pending: answer.value });
      if (answer.problem === "link-expired") return setStep({ kind: "expired" });
      setMessage(PROBLEMS[answer.problem]);
    });
    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (live && user) setSignedInAs({ userId: user.id, email: user.email ?? "", seasons: accountOf(user).seasons });
    });
    return () => {
      live = false;
    };
  }, [token]);

  async function confirm() {
    if (busy || !token) return;
    setBusy(true);
    setMessage(null);
    const answer = await deletion.confirm(token);
    if (!answer.ok) {
      setBusy(false);
      if (answer.problem === "link-expired") return setStep({ kind: "expired" });
      return setMessage(PROBLEMS[answer.problem]);
    }
    // The account is gone on the server; this device forgets it too: its saved copy and its sign-in.
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (userId) {
      const left = await buffer.unsynced(userId).catch(() => []);
      await Promise.all(left.map((piece) => buffer.remove(piece.key).catch(() => undefined)));
    }
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    setBusy(false);
    setStep({ kind: "done" });
  }

  async function downloadHere() {
    if (!signedInAs || download === "working") return;
    setDownload("working");
    try {
      const timeZone = deviceTimeZone();
      await downloadAllWriting(timeZone, resolveSeasonSet(signedInAs.seasons, timeZone));
      setDownload("done");
    } catch {
      setDownload("failed");
    }
  }

  const toInk = () => window.location.assign("/");
  const pending = step.kind === "confirm" ? step.pending : null;
  const sameWriter = !!pending && !!signedInAs && signedInAs.email.toLowerCase() === pending.email.toLowerCase();

  return (
    <div className="auth flex min-h-dvh flex-col items-center bg-auth-cream px-5 pt-16 pb-16 text-auth-ink">
      <main className="w-full max-w-[420px]">
        {step.kind === "checking" && (
          <>
            <Eyebrow>DELETE ACCOUNT</Eyebrow>
            <Heading>Delete your Ink account</Heading>
            {message ? <Message>{message}</Message> : <p className="mt-2.5 mb-0 text-auth-muted">Checking the link…</p>}
          </>
        )}
        {pending && (
          <>
            <Eyebrow>DELETE ACCOUNT</Eyebrow>
            <Heading>Delete your Ink account</Heading>
            <p className="mt-2.5 mb-0 font-medium">{pending.email}</p>
            <p className="mt-2 mb-0 text-auth-muted">
              {count(pending.pieces, "piece", "pieces")}
              {pending.pictures > 0 ? ` and ${count(pending.pictures, "picture", "pictures")}` : ""}, and everything Ink remembers about them, go at once, on
              every device. This can’t be undone.
            </p>
            {sameWriter && (
              <div className="mt-4">
                <LinkButton type="button" onClick={() => void downloadHere()} disabled={download === "working"}>
                  {download === "working" ? "Getting your writing ready…" : "Download all my writing first"}
                </LinkButton>
                {download === "done" && <p className="mt-1 mb-0 text-[13px] text-auth-muted">Downloaded.</p>}
                {download === "failed" && <Message>Ink couldn’t make the download. Check your connection and try again.</Message>}
              </div>
            )}
            {message && <Message>{message}</Message>}
            <MainButton type="button" danger className="mt-6" busy={busy} onClick={() => void confirm()}>
              Delete for good
            </MainButton>
            <div className="mt-3">
              <LinkButton type="button" onClick={toInk}>
                Keep my account
              </LinkButton>
            </div>
          </>
        )}
        {step.kind === "done" && (
          <>
            <Eyebrow>DELETED</Eyebrow>
            <Heading>Your account is deleted</Heading>
            <p className="mt-2.5 mb-0 text-auth-muted">Everything you wrote here is gone, on every device. Thank you for writing with Ink.</p>
          </>
        )}
        {step.kind === "expired" && (
          <>
            <Eyebrow>LINK EXPIRED</Eyebrow>
            <Heading>This link can’t be used</Heading>
            <p className="mt-2.5 mb-0 text-auth-muted">A link works for 1 hour and only once. Nothing was deleted. Ask for a new one in Profile.</p>
            <MainButton type="button" className="mt-6" onClick={toInk}>
              Go to Ink
            </MainButton>
          </>
        )}
      </main>
    </div>
  );
}

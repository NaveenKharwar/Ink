// The link in the password email opens /set-password?token_hash=...&type=recovery. The token is read once and
// then taken out of the address bar, so it is never left in the history or a shared screenshot.
export const SET_PASSWORD = "/set-password";

export function readPasswordLink(search: string): string | null {
  const params = new URLSearchParams(search);
  const hash = params.get("token_hash");
  return params.get("type") === "recovery" && hash && /^[\w-]{8,200}$/.test(hash) ? hash : null;
}

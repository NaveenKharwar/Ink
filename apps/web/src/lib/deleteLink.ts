// The link in the delete-account email opens /delete-account#t=<token>. The token is in the #fragment,
// which browsers never send to a server or in a Referer, and it is read once and then taken out of
// the address bar, so it is never left in the history or a shared screenshot.
export const DELETE_ACCOUNT = "/delete-account";

export function readDeleteLink(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("t");
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

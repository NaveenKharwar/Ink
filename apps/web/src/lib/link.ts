// The link card opens a link only when it leads to a web page or an email: an address with any
// other scheme (javascript:, data:, file:…) is shown as plain words and never followed.
const FOLLOWABLE = new Set(["http:", "https:", "mailto:"]);

export function isFollowable(href: string): boolean {
  try {
    return FOLLOWABLE.has(new URL(href.trim()).protocol);
  } catch {
    return false;
  }
}

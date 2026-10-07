// A short plain sentence about something that just happened ("Piece deleted"). Plain grey words only:
// no box, border or icon and nothing to press, so it never looks like a button. It takes the place of
// the piece's name in the top bar for a few seconds (so it never covers the tool bar or the page and
// takes no room), fades in and out by itself, and is read out politely. The host keeps the sentence in
// state and clears it after NOTE_SHOWN_MS.
export const NOTE_SHOWN_MS = 4500;

export function QuietNote({ children }: { children: string }) {
  return (
    <span role="status" key={children} className="quiet-note font-sans text-[13px] leading-5 text-ink-muted">
      {children}
    </span>
  );
}

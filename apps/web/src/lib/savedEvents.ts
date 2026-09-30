// A tiny announcement that a piece was just saved on the server, so parts of the screen that
// depend on what is written (the related panel) can look again. No data travels with it.
const EVENT = "ink:piece-saved";

export function announceSaved(pieceId: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: pieceId }));
}

/** Calls back whenever `pieceId` is saved. Returns the way to stop listening. */
export function onSaved(pieceId: string, callback: () => void): () => void {
  const handler = (event: Event) => {
    if ((event as CustomEvent<string>).detail === pieceId) callback();
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

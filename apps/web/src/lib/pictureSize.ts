// Pictures are made smaller on the device before they leave it: the picture itself, a small
// copy for grids, and a tiny preview shown blurred while they load.
export const PICTURE_MAX_SIDE = 2400;
export const SMALL_SIDE = 480;
export const PREVIEW_SIDE = 16;

/** The size a picture is drawn at: its longest side at most `max`, never enlarged. */
export function fitWithin(width: number, height: number, max = PICTURE_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

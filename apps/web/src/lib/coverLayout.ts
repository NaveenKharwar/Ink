import type { PictureCrop } from "@ink/schemas";

// The shape a cover is cropped to: the desktop cover band (paper 820 × cover 220).
export const COVER_ASPECT = 820 / 220;

type Size = { width: number; height: number };

/**
 * Where to draw a cover picture inside its band so the writer's crop shows. The crop's width
 * fills the band and its middle sits in the band's middle; a band of another shape (phones are
 * taller for their width) shows a little more above and below, never an empty edge.
 */
export function coverLayout(picture: Size, crop: PictureCrop, band: Size): { width: number; height: number; left: number; top: number } {
  const cropWidth = (crop.width / 100) * picture.width;
  const scale = Math.max(band.width / cropWidth, band.width / picture.width, band.height / picture.height);
  const width = picture.width * scale;
  const height = picture.height * scale;
  const centreX = ((crop.x + crop.width / 2) / 100) * width;
  const centreY = ((crop.y + crop.height / 2) / 100) * height;
  const clamp = (value: number, min: number) => Math.min(0, Math.max(min, value));
  return {
    width,
    height,
    left: clamp(band.width / 2 - centreX, band.width - width),
    top: clamp(band.height / 2 - centreY, band.height - height)
  };
}

/** A crop in the cover's shape across the middle of a picture: the starting point before the writer moves it. */
export function middleCrop(picture: Size): PictureCrop {
  const ratio = picture.width / picture.height;
  if (ratio >= COVER_ASPECT) {
    const width = (COVER_ASPECT / ratio) * 100;
    return { x: (100 - width) / 2, y: 0, width, height: 100 };
  }
  const height = (ratio / COVER_ASPECT) * 100;
  return { x: 0, y: (100 - height) / 2, width: 100, height };
}

/** A crop from the cropper, kept inside the picture (its sums can drift a hair past 100%). */
export function tidyCrop(crop: PictureCrop): PictureCrop {
  const fit = (value: number) => Math.min(100, Math.max(0, Math.round(value * 1000) / 1000));
  const width = Math.max(0.001, fit(crop.width));
  const height = Math.max(0.001, fit(crop.height));
  return { x: Math.min(fit(crop.x), 100 - width), y: Math.min(fit(crop.y), 100 - height), width, height };
}

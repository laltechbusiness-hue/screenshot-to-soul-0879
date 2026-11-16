/**
 * Side ads are 160px wide and sit outside the widest page content (1024px).
 * They only appear when there is room for both without overlap: 1024 + 2 × (160 + 32 gap) = 1408px.
 */
export const SIDE_AD_WIDTH = 160;
export const SIDE_AD_HEIGHT = 600;
export const CONTENT_MAX_WIDTH = 1024;
export const SIDE_AD_GAP = 32;
export const SIDE_ADS_MIN_WIDTH = 1440;
export const SIDE_ADS_MIN_HEIGHT = 720;

export type AdPlacement = "sides" | "bottom";

/** Which ad layout fits a viewport: two side ads on wide screens, one bottom ad everywhere else. */
export function adPlacementFor(width: number, height: number): AdPlacement {
  return width >= SIDE_ADS_MIN_WIDTH && height >= SIDE_ADS_MIN_HEIGHT ? "sides" : "bottom";
}

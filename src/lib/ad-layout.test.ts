import { describe, expect, it } from "vitest";
import { adPlacementFor, CONTENT_MAX_WIDTH, SIDE_AD_GAP, SIDE_AD_WIDTH, SIDE_ADS_MIN_WIDTH } from "./ad-layout";

describe("ad layout", () => {
  it("shows a single bottom ad on phones", () => {
    expect(adPlacementFor(390, 844)).toBe("bottom");
  });

  it("shows left and right ads on wide desktop screens", () => {
    expect(adPlacementFor(1920, 1080)).toBe("sides");
  });

  it("falls back to the bottom ad when side ads would touch page content", () => {
    expect(adPlacementFor(1280, 900)).toBe("bottom");
    expect(SIDE_ADS_MIN_WIDTH).toBeGreaterThanOrEqual(CONTENT_MAX_WIDTH + 2 * (SIDE_AD_WIDTH + SIDE_AD_GAP));
  });
});

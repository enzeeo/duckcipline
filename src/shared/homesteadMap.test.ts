import { describe, expect, it } from "vitest";
import {
  HOMESTEAD_MAX_ZOOM,
  HOMESTEAD_MIN_ZOOM,
  clampCamera,
  getCenteredTileWorldPosition,
  getTileTerrainKindAt,
  getTileTypeAt,
  isManualDuckPlacementValid,
  isObjectBlockingTile
} from "./homesteadMap.js";

describe("homesteadMap", () => {
  it("rejects manual placement on water", () => {
    const waterPosition = getCenteredTileWorldPosition(28, 17);

    expect(getTileTerrainKindAt(28, 17)).toBe("water");
    expect(isManualDuckPlacementValid(waterPosition)).toBe(false);
  });

  it("rejects manual placement on blocking objects", () => {
    const treePosition = getCenteredTileWorldPosition(4, 4);

    expect(isObjectBlockingTile(4, 4)).toBe(true);
    expect(isManualDuckPlacementValid(treePosition)).toBe(false);
  });

  it("accepts manual placement on an open land tile", () => {
    expect(isManualDuckPlacementValid(getCenteredTileWorldPosition(1, 1))).toBe(true);
  });

  it("clamps camera zoom and world edges", () => {
    expect(clampCamera({ x: -20, y: -30, zoom: 0.1 }, 320, 240)).toEqual({
      x: 0,
      y: 0,
      zoom: HOMESTEAD_MIN_ZOOM
    });

    expect(clampCamera({ x: 10_000, y: 10_000, zoom: 10 }, 320, 240).zoom).toBe(HOMESTEAD_MAX_ZOOM);
  });
});

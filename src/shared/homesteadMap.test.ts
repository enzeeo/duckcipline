import { describe, expect, it } from "vitest";
import {
  HOMESTEAD_MAX_ZOOM,
  HOMESTEAD_MIN_ZOOM,
  HOMESTEAD_COLUMNS,
  HOMESTEAD_ROWS,
  clampCamera,
  getCenteredTileWorldPosition,
  getTileTerrainKindAt,
  isDuckAiPositionValid,
  isManualDuckPlacementValid,
  isObjectBlockingTile
} from "./homesteadMap.js";

describe("homesteadMap", () => {
  it("rejects manual placement on water", () => {
    const waterPosition = getCenteredTileWorldPosition(24, 14);

    expect(getTileTerrainKindAt(24, 14)).toBe("water");
    expect(isManualDuckPlacementValid(waterPosition)).toBe(false);
  });

  it("rejects manual placement on blocking objects", () => {
    const treePosition = getCenteredTileWorldPosition(0, 1);

    expect(isObjectBlockingTile(0, 1)).toBe(true);
    expect(isManualDuckPlacementValid(treePosition)).toBe(false);
  });

  it("treats all homestead objects as blocking tiles", () => {
    expect(isObjectBlockingTile(20, 12)).toBe(true);
    expect(isObjectBlockingTile(22, 14)).toBe(true);
    expect(isObjectBlockingTile(14, 11)).toBe(true);
  });

  it("rejects manual placement on land object tiles", () => {
    expect(getTileTerrainKindAt(14, 11)).not.toBe("water");
    expect(isManualDuckPlacementValid(getCenteredTileWorldPosition(14, 11))).toBe(false);
  });

  it("rejects object tiles for AI movement even when water entry is allowed", () => {
    expect(isDuckAiPositionValid(getCenteredTileWorldPosition(22, 14), true)).toBe(false);
    expect(isDuckAiPositionValid(getCenteredTileWorldPosition(20, 12), true)).toBe(false);
  });

  it("uses the cropped homestead dimensions and keeps the pond centered", () => {
    expect(HOMESTEAD_COLUMNS).toBe(40);
    expect(HOMESTEAD_ROWS).toBe(30);
    expect(getTileTerrainKindAt(24, 14)).toBe("water");
  });

  it("accepts manual placement on an open land tile", () => {
    expect(isManualDuckPlacementValid(getCenteredTileWorldPosition(2, 1))).toBe(true);
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

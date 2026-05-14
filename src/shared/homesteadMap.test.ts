import { describe, expect, it } from "vitest";
import {
  getCenteredTileWorldPosition,
  getTileTypeAt,
  isManualDuckPlacementValid,
  isObjectBlockingTile
} from "./homesteadMap.js";

describe("homesteadMap", () => {
  it("rejects manual placement on water", () => {
    const waterPosition = getCenteredTileWorldPosition(28, 17);

    expect(getTileTypeAt(28, 17)).toMatch(/water/i);
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
});

import { describe, expect, it } from "vitest";
import {
  getCenteredTileWorldPosition,
  getTilePositionFromWorldPosition,
  getTileTypeAt,
  isDuckAiPositionValid
} from "../shared/homesteadMap.js";
import type { Duck } from "../shared/types.js";
import {
  createRoamPathForDuck,
  findPathBetweenTiles,
  getDuckMovementActivity,
  simulateDuckMovement
} from "./homesteadSimulation.js";

function createDuck(overrides: Partial<Duck> = {}): Duck {
  return {
    id: "duck-1",
    name: "Quill",
    variantId: "yellow",
    sourceEggProjectId: "meadowEgg",
    growthStage: "duckling",
    seedsFedForCurrentStage: 0,
    placementStatus: "placed",
    position: getCenteredTileWorldPosition(1, 1),
    activity: "idle",
    favoriteActivity: "path patrol",
    hatchedAtTimestampMilliseconds: 1_000,
    lastUpdatedAtTimestampMilliseconds: 1_000,
    ...overrides
  };
}

describe("homesteadSimulation", () => {
  it("returns no path for invalid blocked destinations", () => {
    expect(findPathBetweenTiles({ column: 1, row: 1 }, { column: 4, row: 4 }, false)).toEqual([]);
  });

  it("excludes start tile and includes destination tile in paths", () => {
    const path = findPathBetweenTiles({ column: 1, row: 1 }, { column: 3, row: 1 }, false);

    expect(path[0]).toEqual({ column: 2, row: 1 });
    expect(path.at(-1)).toEqual({ column: 3, row: 1 });
  });

  it("keeps land duck paths off water", () => {
    const path = findPathBetweenTiles({ column: 1, row: 1 }, { column: 20, row: 20 }, false);

    expect(path.every((tile) => !getTileTypeAt(tile.column, tile.row).includes("water"))).toBe(true);
  });

  it("allows pond duck movement activity to become swim on water", () => {
    const pondDuck = createDuck({ variantId: "pond-a", sourceEggProjectId: "pondEgg" });
    const waterPosition = getCenteredTileWorldPosition(28, 17);

    expect(getDuckMovementActivity(pondDuck, waterPosition)).toBe("swim");
    expect(getDuckMovementActivity(createDuck(), waterPosition)).toBe("wander");
  });

  it("creates deterministic roam paths with injected random", () => {
    const duck = createDuck();
    const randomValues = [0.1, 0.1, 0.2, 0.2, 0.4, 0.4];
    let randomIndex = 0;
    const random = () => randomValues[randomIndex++ % randomValues.length];

    const path = createRoamPathForDuck(duck, random);

    expect(path.length).toBeGreaterThan(0);
    expect(path.every((position) => isDuckAiPositionValid(position, false))).toBe(true);
  });

  it("removes roam state for unplaced ducks", () => {
    const duck = createDuck({ placementStatus: "unplaced", position: null });
    const result = simulateDuckMovement({
      ducks: [duck],
      roamStateById: new Map([["duck-1", { path: [getCenteredTileWorldPosition(2, 1)], waypointIndex: 0, idleUntilTimestampMilliseconds: 0 }]]),
      draggedDuckId: null,
      deltaMilliseconds: 100,
      nowTimestampMilliseconds: 2_000,
      random: () => 0.1
    });

    expect(result.ducks[0]).toEqual(duck);
    expect(result.roamStateById.has("duck-1")).toBe(false);
  });

  it("does not advance dragged ducks", () => {
    const duck = createDuck();
    const result = simulateDuckMovement({
      ducks: [duck],
      roamStateById: new Map([["duck-1", { path: [getCenteredTileWorldPosition(2, 1)], waypointIndex: 0, idleUntilTimestampMilliseconds: 0 }]]),
      draggedDuckId: "duck-1",
      deltaMilliseconds: 100,
      nowTimestampMilliseconds: 2_000,
      random: () => 0.1
    });

    expect(result.ducks[0]).toEqual(duck);
  });

  it("advances ducks toward existing waypoints", () => {
    const duck = createDuck();
    const result = simulateDuckMovement({
      ducks: [duck],
      roamStateById: new Map([["duck-1", { path: [getCenteredTileWorldPosition(2, 1)], waypointIndex: 0, idleUntilTimestampMilliseconds: 0 }]]),
      draggedDuckId: null,
      deltaMilliseconds: 1000,
      nowTimestampMilliseconds: 2_000,
      random: () => 0.1
    });
    const position = result.ducks[0].position;

    expect(position?.x).toBeGreaterThan(duck.position?.x ?? 0);
    expect(getTilePositionFromWorldPosition(position ?? getCenteredTileWorldPosition(1, 1)).row).toBe(1);
  });
});

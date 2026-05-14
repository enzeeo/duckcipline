import { describe, expect, it } from "vitest";
import {
  getCenteredTileWorldPosition,
  getTileTerrainKindAt,
  getTilePositionFromWorldPosition,
  isDuckAiPositionValid
} from "../shared/homesteadMap.js";
import type { Duck } from "../shared/types.js";
import {
  createRoamPathForDuck,
  DUCK_HOME_RADIUS_TILES,
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
    homePosition: getCenteredTileWorldPosition(1, 1),
    activity: "idle",
    facingDirection: "right",
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

    expect(path.every((tile) => getTileTerrainKindAt(tile.column, tile.row) !== "water")).toBe(true);
  });

  it("allows all ducks to swim on water", () => {
    const pondDuck = createDuck({ variantId: "pond-a", sourceEggProjectId: "pondEgg" });
    const waterPosition = getCenteredTileWorldPosition(28, 17);

    expect(getDuckMovementActivity(pondDuck, waterPosition)).toBe("swim");
    expect(getDuckMovementActivity(createDuck(), waterPosition)).toBe("swim");
  });

  it("creates deterministic roam paths with injected random", () => {
    const duck = createDuck();
    const randomValues = [0.6, 0.5, 0.4, 0.4];
    let randomIndex = 0;
    const random = () => randomValues[randomIndex++ % randomValues.length];

    const path = createRoamPathForDuck(duck, random);

    expect(path.length).toBeGreaterThan(0);
    expect(path.every((position) => isDuckAiPositionValid(position, false))).toBe(true);
  });

  it("allows non-pond ducks to path onto water within home radius", () => {
    const duck = createDuck({
      position: getCenteredTileWorldPosition(20, 17),
      homePosition: getCenteredTileWorldPosition(20, 17)
    });
    const randomValues = [0.86, 0.48, 0.25, 0.5, 0.75];
    let randomIndex = 0;
    const path = createRoamPathForDuck(duck, () => randomValues[randomIndex++ % randomValues.length], "swim");

    expect(path.length).toBeGreaterThan(0);
    expect(path.some((position) => {
      const tile = getTilePositionFromWorldPosition(position);
      return getTileTerrainKindAt(tile.column, tile.row) === "water";
    })).toBe(true);
  });

  it("keeps roam paths inside the duck home radius", () => {
    const duck = createDuck({
      position: getCenteredTileWorldPosition(20, 17),
      homePosition: getCenteredTileWorldPosition(20, 17)
    });
    const homeTile = getTilePositionFromWorldPosition(duck.homePosition ?? getCenteredTileWorldPosition(20, 17));
    const randomValues = [0.86, 0.48, 0.25, 0.5, 0.75];
    let randomIndex = 0;
    const path = createRoamPathForDuck(duck, () => randomValues[randomIndex++ % randomValues.length], "swim");

    expect(path.length).toBeGreaterThan(0);
    expect(path.every((position) => {
      const tile = getTilePositionFromWorldPosition(position);
      return Math.abs(tile.column - homeTile.column) + Math.abs(tile.row - homeTile.row) <= DUCK_HOME_RADIUS_TILES;
    })).toBe(true);
  });

  it("keeps swim activity while a swim session is active", () => {
    const duck = createDuck({
      position: getCenteredTileWorldPosition(28, 17),
      homePosition: getCenteredTileWorldPosition(28, 17),
      activity: "swim"
    });
    const result = simulateDuckMovement({
      ducks: [duck],
      roamStateById: new Map([["duck-1", { path: [], waypointIndex: 0, behavior: "swim", behaviorUntilTimestampMilliseconds: 10_000, idleUntilTimestampMilliseconds: 0 }]]),
      draggedDuckId: null,
      deltaMilliseconds: 100,
      nowTimestampMilliseconds: 2_000,
      random: () => 0.5
    });

    expect(result.ducks[0].activity).toBe("swim");
  });

  it("allows idle sessions on water", () => {
    const duck = createDuck({
      position: getCenteredTileWorldPosition(28, 17),
      homePosition: getCenteredTileWorldPosition(28, 17),
      activity: "swim"
    });
    const result = simulateDuckMovement({
      ducks: [duck],
      roamStateById: new Map([["duck-1", { path: [], waypointIndex: 0, behavior: "idle", behaviorUntilTimestampMilliseconds: 5_000, idleUntilTimestampMilliseconds: 5_000 }]]),
      draggedDuckId: null,
      deltaMilliseconds: 100,
      nowTimestampMilliseconds: 2_000,
      random: () => 0.5
    });

    expect(result.ducks[0].activity).toBe("idle");
  });

  it("removes roam state for unplaced ducks", () => {
    const duck = createDuck({ placementStatus: "unplaced", position: null });
    const result = simulateDuckMovement({
      ducks: [duck],
      roamStateById: new Map([["duck-1", { path: [getCenteredTileWorldPosition(2, 1)], waypointIndex: 0, behavior: "wander", behaviorUntilTimestampMilliseconds: 0, idleUntilTimestampMilliseconds: 0 }]]),
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
      roamStateById: new Map([["duck-1", { path: [getCenteredTileWorldPosition(2, 1)], waypointIndex: 0, behavior: "wander", behaviorUntilTimestampMilliseconds: 0, idleUntilTimestampMilliseconds: 0 }]]),
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
      roamStateById: new Map([["duck-1", { path: [getCenteredTileWorldPosition(2, 1)], waypointIndex: 0, behavior: "wander", behaviorUntilTimestampMilliseconds: 0, idleUntilTimestampMilliseconds: 0 }]]),
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

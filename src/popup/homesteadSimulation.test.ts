import { describe, expect, it } from "vitest";
import {
  HOMESTEAD_COLUMNS,
  HOMESTEAD_ROWS,
  getCenteredTileWorldPosition,
  getTileTerrainKindAt,
  getTileTypeAt,
  getTilePositionFromWorldPosition,
  isDuckAiPositionValid
} from "../shared/homesteadMap.js";
import type { Duck } from "../shared/types.js";
import { DUCK_EATING_ANIMATION_DURATION_MILLISECONDS } from "../shared/duckAnimation.js";
import {
  chooseDuckRoamBehavior,
  createRoamPathForDuck,
  DUCK_HOME_RADIUS_TILES,
  findEscapePathFromBlockedTile,
  findPathBetweenTiles,
  getDuckBehaviorProfile,
  getDuckMovementActivity,
  normalizeDuckFavoriteActivity,
  scoreDuckDestinationTile,
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
    position: getCenteredTileWorldPosition(2, 1),
    homePosition: getCenteredTileWorldPosition(2, 1),
    activity: "idle",
    facingDirection: "right",
    favoriteActivity: "path patrol",
    hatchedAtTimestampMilliseconds: 1_000,
    lastUpdatedAtTimestampMilliseconds: 1_000,
    ...overrides
  };
}

function findTileByType(tileType: ReturnType<typeof getTileTypeAt>): { column: number; row: number } {
  for (let column = 0; column < HOMESTEAD_COLUMNS; column += 1) {
    for (let row = 0; row < HOMESTEAD_ROWS; row += 1) {
      if (getTileTypeAt(column, row) === tileType && isDuckAiPositionValid(getCenteredTileWorldPosition(column, row), true)) {
        return { column, row };
      }
    }
  }

  throw new Error(`Missing ${tileType} tile.`);
}

describe("homesteadSimulation", () => {
  it("returns no path for invalid blocked destinations", () => {
    expect(findPathBetweenTiles({ column: 1, row: 1 }, { column: 4, row: 4 }, false)).toEqual([]);
  });

  it("excludes start tile and includes destination tile in paths", () => {
    const path = findPathBetweenTiles({ column: 2, row: 1 }, { column: 4, row: 1 }, false);

    expect(path[0]).toEqual({ column: 3, row: 1 });
    expect(path.at(-1)).toEqual({ column: 4, row: 1 });
  });

  it("keeps land duck paths off water", () => {
    const path = findPathBetweenTiles({ column: 1, row: 1 }, { column: 20, row: 20 }, false);

    expect(path.every((tile) => getTileTerrainKindAt(tile.column, tile.row) !== "water")).toBe(true);
  });

  it("does not route through lily pad object tiles", () => {
    const path = findPathBetweenTiles({ column: 21, row: 14 }, { column: 23, row: 14 }, true);

    expect(path.length).toBeGreaterThan(0);
    expect(path).not.toContainEqual({ column: 22, row: 14 });
  });

  it("finds an escape path when a duck starts on a blocked object tile", () => {
    const path = findEscapePathFromBlockedTile({ column: 22, row: 14 }, { column: 22, row: 14 }, () => 0);

    expect(path.length).toBeGreaterThan(0);
    expect(path.every((tile) => isDuckAiPositionValid(getCenteredTileWorldPosition(tile.column, tile.row), true))).toBe(true);
  });

  it("allows all ducks to swim on water", () => {
    const pondDuck = createDuck({ variantId: "pond-a", sourceEggProjectId: "pondEgg" });
    const waterPosition = getCenteredTileWorldPosition(24, 14);

    expect(getDuckMovementActivity(pondDuck, waterPosition)).toBe("swim");
    expect(getDuckMovementActivity(createDuck(), waterPosition)).toBe("swim");
  });

  it("normalizes legacy favorite activities to the default behavior profile", () => {
    const duck = createDuck({ favoriteActivity: "legacy breadcrumb catalog" });

    expect(normalizeDuckFavoriteActivity(duck.favoriteActivity)).toBe("path patrol");
    expect(getDuckBehaviorProfile(duck).favoriteActivity).toBe("path patrol");
  });

  it("lets pond-watching ducks choose swim when water is reachable", () => {
    const duck = createDuck({
      variantId: "pond-a",
      sourceEggProjectId: "pondEgg",
      favoriteActivity: "pond watching",
      position: getCenteredTileWorldPosition(20, 14),
      homePosition: getCenteredTileWorldPosition(20, 14)
    });

    expect(chooseDuckRoamBehavior(duck, { column: 20, row: 14 }, () => 0.99)).toBe("swim");
  });

  it("removes swim from weighted choices when water is unreachable", () => {
    const duck = createDuck({
      favoriteActivity: "pond watching",
      position: getCenteredTileWorldPosition(1, 1),
      homePosition: getCenteredTileWorldPosition(1, 1)
    });

    expect(chooseDuckRoamBehavior(duck, { column: 1, row: 1 }, () => 0.99)).not.toBe("swim");
  });

  it("scores path patrol destinations above plain grass pathing", () => {
    const duck = createDuck({ favoriteActivity: "path patrol" });
    const pathTile = findTileByType("path");
    const grassTile = findTileByType("grass");

    expect(scoreDuckDestinationTile(duck, pathTile, grassTile, "wander")).toBeGreaterThan(
      scoreDuckDestinationTile(duck, grassTile, pathTile, "wander")
    );
  });

  it("scores flower nap destinations above plain grass resting", () => {
    const duck = createDuck({ favoriteActivity: "flower naps" });
    const flowerTile = findTileByType("flower");
    const grassTile = findTileByType("grass");

    expect(scoreDuckDestinationTile(duck, flowerTile, grassTile, "rest")).toBeGreaterThan(
      scoreDuckDestinationTile(duck, grassTile, flowerTile, "rest")
    );
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
      position: getCenteredTileWorldPosition(20, 14),
      homePosition: getCenteredTileWorldPosition(20, 14)
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
      position: getCenteredTileWorldPosition(20, 14),
      homePosition: getCenteredTileWorldPosition(20, 14)
    });
    const homeTile = getTilePositionFromWorldPosition(duck.homePosition ?? getCenteredTileWorldPosition(20, 14));
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
      position: getCenteredTileWorldPosition(24, 14),
      homePosition: getCenteredTileWorldPosition(24, 14),
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
      position: getCenteredTileWorldPosition(24, 14),
      homePosition: getCenteredTileWorldPosition(24, 14),
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

    expect(result.ducks[0].activity).toBe("swim");
  });

  it("allows rest sessions to use the sleep-rendered activity", () => {
    const duck = createDuck({ favoriteActivity: "flower naps" });
    const result = simulateDuckMovement({
      ducks: [duck],
      roamStateById: new Map([["duck-1", { path: [], waypointIndex: 0, behavior: "rest", behaviorUntilTimestampMilliseconds: 5_000, idleUntilTimestampMilliseconds: 5_000 }]]),
      draggedDuckId: null,
      deltaMilliseconds: 100,
      nowTimestampMilliseconds: 2_000,
      random: () => 0.5
    });

    expect(result.ducks[0].activity).toBe("rest");
  });

  it("keeps ducks eating until the first animation cycle completes", () => {
    const duck = createDuck({
      activity: "eat",
      lastUpdatedAtTimestampMilliseconds: 1_000
    });
    const result = simulateDuckMovement({
      ducks: [duck],
      roamStateById: new Map([["duck-1", { path: [getCenteredTileWorldPosition(3, 1)], waypointIndex: 0, behavior: "wander", behaviorUntilTimestampMilliseconds: 0, idleUntilTimestampMilliseconds: 0 }]]),
      draggedDuckId: null,
      deltaMilliseconds: 100,
      nowTimestampMilliseconds: 1_000 + DUCK_EATING_ANIMATION_DURATION_MILLISECONDS - 1,
      random: () => 0.5
    });

    expect(result.ducks[0]).toEqual(duck);
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
      roamStateById: new Map([["duck-1", { path: [getCenteredTileWorldPosition(3, 1)], waypointIndex: 0, behavior: "wander", behaviorUntilTimestampMilliseconds: 0, idleUntilTimestampMilliseconds: 0 }]]),
      draggedDuckId: null,
      deltaMilliseconds: 1000,
      nowTimestampMilliseconds: 2_000,
      random: () => 0.1
    });
    const position = result.ducks[0].position;

    expect(position?.x).toBeGreaterThan(duck.position?.x ?? 0);
    expect(getTilePositionFromWorldPosition(position ?? getCenteredTileWorldPosition(2, 1)).row).toBe(1);
  });

  it("discards stale roam waypoints on blocked object tiles before movement", () => {
    const duck = createDuck({
      position: getCenteredTileWorldPosition(21, 14),
      homePosition: getCenteredTileWorldPosition(21, 14)
    });
    const blockedWaypoint = getCenteredTileWorldPosition(22, 14);
    const result = simulateDuckMovement({
      ducks: [duck],
      roamStateById: new Map([["duck-1", { path: [blockedWaypoint], waypointIndex: 0, behavior: "wander", behaviorUntilTimestampMilliseconds: 0, idleUntilTimestampMilliseconds: 0 }]]),
      draggedDuckId: null,
      deltaMilliseconds: 1000,
      nowTimestampMilliseconds: 2_000,
      random: () => 0
    });
    const position = result.ducks[0].position ?? getCenteredTileWorldPosition(21, 14);

    expect(getTilePositionFromWorldPosition(position)).not.toEqual({ column: 22, row: 14 });
    expect(result.roamStateById.get("duck-1")?.path[0]).not.toEqual(blockedWaypoint);
  });
});

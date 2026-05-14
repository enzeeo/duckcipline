import { getDuckVariantFamily } from "../shared/duckDefinitions.js";
import {
  HOMESTEAD_COLUMNS,
  HOMESTEAD_ROWS,
  getCenteredTileWorldPosition,
  getTilePositionFromWorldPosition,
  getTileTerrainKindAt,
  isDuckAiPositionValid
} from "../shared/homesteadMap.js";
import type { Duck, DuckActivity, DuckPosition } from "../shared/types.js";

const DUCK_RANDOM_DESTINATION_ATTEMPTS = 40;
const DUCK_MINIMUM_DESTINATION_TILE_DISTANCE = 2;
export const DUCK_HOME_RADIUS_TILES = 10;
const DUCK_WALK_SPEED_PIXELS_PER_SECOND = 38;
const DUCK_SWIM_SPEED_PIXELS_PER_SECOND = 30;
const DUCK_WAYPOINT_REACHED_DISTANCE_PIXELS = 2;
const MINIMUM_IDLE_MILLISECONDS = 2_000;
const MAXIMUM_IDLE_MILLISECONDS = 6_000;
const MINIMUM_SWIM_SESSION_MILLISECONDS = 8_000;
const MAXIMUM_SWIM_SESSION_MILLISECONDS = 15_000;

export interface HomesteadTileCoordinate {
  column: number;
  row: number;
}

type DuckRoamBehavior = "idle" | "wander" | "swim";

export interface DuckRoamState {
  path: DuckPosition[];
  waypointIndex: number;
  behavior: DuckRoamBehavior;
  behaviorUntilTimestampMilliseconds: number;
  idleUntilTimestampMilliseconds: number;
}

export interface SimulateDuckMovementInput {
  ducks: Duck[];
  roamStateById: ReadonlyMap<string, DuckRoamState>;
  draggedDuckId: string | null;
  deltaMilliseconds: number;
  nowTimestampMilliseconds: number;
  random: () => number;
}

export interface SimulateDuckMovementResult {
  ducks: Duck[];
  roamStateById: Map<string, DuckRoamState>;
}

interface WeightedBehavior {
  behavior: DuckRoamBehavior;
  weight: number;
}

function isPondDuck(duck: Duck): boolean {
  return getDuckVariantFamily(duck.variantId) === "pond";
}

function isWaterWorldPosition(position: DuckPosition): boolean {
  const tilePosition = getTilePositionFromWorldPosition(position);
  return getTileTerrainKindAt(tilePosition.column, tilePosition.row) === "water";
}

function isDuckTileValid(tileCoordinate: HomesteadTileCoordinate): boolean {
  return isDuckAiPositionValid(getCenteredTileWorldPosition(tileCoordinate.column, tileCoordinate.row), true);
}

export function getDuckMovementActivity(_duck: Duck, position: DuckPosition): DuckActivity {
  return isWaterWorldPosition(position) ? "swim" : "wander";
}

function getFacingDirection(currentPosition: DuckPosition, nextPosition: DuckPosition, fallback: Duck["facingDirection"]): Duck["facingDirection"] {
  if (nextPosition.x > currentPosition.x) {
    return "right";
  }

  if (nextPosition.x < currentPosition.x) {
    return "left";
  }

  return fallback;
}

function getDurationMilliseconds(minimumMilliseconds: number, maximumMilliseconds: number, random: () => number): number {
  return minimumMilliseconds + Math.floor(random() * (maximumMilliseconds - minimumMilliseconds + 1));
}

function createTileKey(tileCoordinate: HomesteadTileCoordinate): string {
  return `${tileCoordinate.column},${tileCoordinate.row}`;
}

function parseTileKey(tileKey: string): HomesteadTileCoordinate {
  const [columnText, rowText] = tileKey.split(",");

  return {
    column: Number(columnText),
    row: Number(rowText)
  };
}

function getManhattanTileDistance(leftTile: HomesteadTileCoordinate, rightTile: HomesteadTileCoordinate): number {
  return Math.abs(leftTile.column - rightTile.column) + Math.abs(leftTile.row - rightTile.row);
}

function isInsideHomeRadius(tileCoordinate: HomesteadTileCoordinate, homeTile: HomesteadTileCoordinate): boolean {
  return getManhattanTileDistance(tileCoordinate, homeTile) <= DUCK_HOME_RADIUS_TILES;
}

function getHomeTileForDuck(duck: Duck): HomesteadTileCoordinate | null {
  const homePosition = duck.homePosition ?? duck.position;
  return homePosition === null ? null : getTilePositionFromWorldPosition(homePosition);
}

function getNeighborTileCoordinates(tileCoordinate: HomesteadTileCoordinate, random: () => number): HomesteadTileCoordinate[] {
  const neighbors = [
    { column: tileCoordinate.column + 1, row: tileCoordinate.row },
    { column: tileCoordinate.column - 1, row: tileCoordinate.row },
    { column: tileCoordinate.column, row: tileCoordinate.row + 1 },
    { column: tileCoordinate.column, row: tileCoordinate.row - 1 }
  ];

  for (let index = neighbors.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const neighbor = neighbors[index];
    neighbors[index] = neighbors[swapIndex];
    neighbors[swapIndex] = neighbor;
  }

  return neighbors;
}

export function findPathBetweenTiles(
  startTile: HomesteadTileCoordinate,
  destinationTile: HomesteadTileCoordinate,
  canEnterWater: boolean,
  homeTile: HomesteadTileCoordinate | null = null,
  random: () => number = Math.random
): HomesteadTileCoordinate[] {
  if (!canEnterWater && getTileTerrainKindAt(destinationTile.column, destinationTile.row) === "water") {
    return [];
  }

  if (
    !isDuckTileValid(startTile) ||
    !isDuckTileValid(destinationTile) ||
    (homeTile !== null && (!isInsideHomeRadius(startTile, homeTile) || !isInsideHomeRadius(destinationTile, homeTile)))
  ) {
    return [];
  }

  const startKey = createTileKey(startTile);
  const destinationKey = createTileKey(destinationTile);
  const frontier = [startTile];
  const previousTileKeyByKey = new Map<string, string | null>([[startKey, null]]);

  for (let frontierIndex = 0; frontierIndex < frontier.length; frontierIndex += 1) {
    const currentTile = frontier[frontierIndex];
    const currentKey = createTileKey(currentTile);

    if (currentKey === destinationKey) {
      break;
    }

    for (const neighborTile of getNeighborTileCoordinates(currentTile, random)) {
      if (
        neighborTile.column < 0 ||
        neighborTile.row < 0 ||
        neighborTile.column >= HOMESTEAD_COLUMNS ||
        neighborTile.row >= HOMESTEAD_ROWS ||
        (homeTile !== null && !isInsideHomeRadius(neighborTile, homeTile)) ||
        !isDuckTileValid(neighborTile) ||
        (!canEnterWater && getTileTerrainKindAt(neighborTile.column, neighborTile.row) === "water")
      ) {
        continue;
      }

      const neighborKey = createTileKey(neighborTile);

      if (previousTileKeyByKey.has(neighborKey)) {
        continue;
      }

      previousTileKeyByKey.set(neighborKey, currentKey);
      frontier.push(neighborTile);
    }
  }

  if (!previousTileKeyByKey.has(destinationKey)) {
    return [];
  }

  const path: HomesteadTileCoordinate[] = [];
  let currentKey: string | null = destinationKey;

  while (currentKey !== null) {
    path.push(parseTileKey(currentKey));
    currentKey = previousTileKeyByKey.get(currentKey) ?? null;
  }

  path.reverse();
  return path.slice(1);
}

function hasReachableWaterTile(duck: Duck, startTile: HomesteadTileCoordinate, random: () => number): boolean {
  const homeTile = getHomeTileForDuck(duck);

  if (homeTile === null) {
    return false;
  }

  for (let column = Math.max(0, homeTile.column - DUCK_HOME_RADIUS_TILES); column <= Math.min(HOMESTEAD_COLUMNS - 1, homeTile.column + DUCK_HOME_RADIUS_TILES); column += 1) {
    for (let row = Math.max(0, homeTile.row - DUCK_HOME_RADIUS_TILES); row <= Math.min(HOMESTEAD_ROWS - 1, homeTile.row + DUCK_HOME_RADIUS_TILES); row += 1) {
      const tile = { column, row };

      if (
        isInsideHomeRadius(tile, homeTile) &&
        getTileTerrainKindAt(column, row) === "water" &&
        findPathBetweenTiles(startTile, tile, true, homeTile, random).length > 0
      ) {
        return true;
      }
    }
  }

  return false;
}

function chooseBehavior(duck: Duck, startTile: HomesteadTileCoordinate, random: () => number): DuckRoamBehavior {
  const canSwim = hasReachableWaterTile(duck, startTile, random);
  const weightedBehaviors: WeightedBehavior[] = canSwim
    ? [
        { behavior: "wander", weight: isPondDuck(duck) ? 35 : 45 },
        { behavior: "idle", weight: isPondDuck(duck) ? 25 : 30 },
        { behavior: "swim", weight: isPondDuck(duck) ? 40 : 25 }
      ]
    : [
        { behavior: "wander", weight: 65 },
        { behavior: "idle", weight: 35 }
      ];
  const totalWeight = weightedBehaviors.reduce((sum, entry) => sum + entry.weight, 0);
  let selectedWeight = random() * totalWeight;

  for (const entry of weightedBehaviors) {
    selectedWeight -= entry.weight;

    if (selectedWeight <= 0) {
      return entry.behavior;
    }
  }

  return weightedBehaviors[0].behavior;
}

function getRandomValidDestinationTile(
  duck: Duck,
  startTile: HomesteadTileCoordinate,
  behavior: DuckRoamBehavior,
  random: () => number
): HomesteadTileCoordinate | null {
  const homeTile = getHomeTileForDuck(duck);

  if (homeTile === null) {
    return null;
  }

  let fallbackTile: HomesteadTileCoordinate | null = null;

  for (let attemptIndex = 0; attemptIndex < DUCK_RANDOM_DESTINATION_ATTEMPTS; attemptIndex += 1) {
    const destinationTile = {
      column: homeTile.column + Math.floor(random() * (DUCK_HOME_RADIUS_TILES * 2 + 1)) - DUCK_HOME_RADIUS_TILES,
      row: homeTile.row + Math.floor(random() * (DUCK_HOME_RADIUS_TILES * 2 + 1)) - DUCK_HOME_RADIUS_TILES
    };

    if (
      destinationTile.column < 0 ||
      destinationTile.row < 0 ||
      destinationTile.column >= HOMESTEAD_COLUMNS ||
      destinationTile.row >= HOMESTEAD_ROWS ||
      !isInsideHomeRadius(destinationTile, homeTile) ||
      !isDuckTileValid(destinationTile) ||
      (behavior === "swim" && getTileTerrainKindAt(destinationTile.column, destinationTile.row) !== "water")
    ) {
      continue;
    }

    const path = findPathBetweenTiles(startTile, destinationTile, true, homeTile, random);

    if (path.length === 0) {
      continue;
    }

    fallbackTile = destinationTile;

    if (getManhattanTileDistance(destinationTile, startTile) >= DUCK_MINIMUM_DESTINATION_TILE_DISTANCE) {
      return destinationTile;
    }
  }

  return fallbackTile;
}

export function createRoamPathForDuck(
  duck: Duck,
  random: () => number,
  behavior: DuckRoamBehavior = "wander"
): DuckPosition[] {
  if (duck.position === null) {
    return [];
  }

  const homeTile = getHomeTileForDuck(duck);

  if (homeTile === null) {
    return [];
  }

  const startTile = getTilePositionFromWorldPosition(duck.position);
  const destinationTile = getRandomValidDestinationTile(duck, startTile, behavior, random);

  if (destinationTile === null) {
    return [];
  }

  return findPathBetweenTiles(startTile, destinationTile, true, homeTile, random).map((tileCoordinate) =>
    getCenteredTileWorldPosition(tileCoordinate.column, tileCoordinate.row)
  );
}

export function pruneDuckRoamStates(
  ducks: Duck[],
  roamStateById: ReadonlyMap<string, DuckRoamState>
): Map<string, DuckRoamState> {
  const activeDuckIds = new Set(ducks.map((duck) => duck.id));
  const prunedRoamStateById = new Map<string, DuckRoamState>();

  for (const [duckId, roamState] of roamStateById.entries()) {
    if (activeDuckIds.has(duckId)) {
      prunedRoamStateById.set(duckId, roamState);
    }
  }

  return prunedRoamStateById;
}

function createIdleState(nowTimestampMilliseconds: number, random: () => number): DuckRoamState {
  const idleUntilTimestampMilliseconds =
    nowTimestampMilliseconds + getDurationMilliseconds(MINIMUM_IDLE_MILLISECONDS, MAXIMUM_IDLE_MILLISECONDS, random);

  return {
    path: [],
    waypointIndex: 0,
    behavior: "idle",
    behaviorUntilTimestampMilliseconds: idleUntilTimestampMilliseconds,
    idleUntilTimestampMilliseconds
  };
}

function createMovementState(
  duck: Duck,
  behavior: "wander" | "swim",
  nowTimestampMilliseconds: number,
  random: () => number,
  existingBehaviorUntilTimestampMilliseconds: number = 0
): DuckRoamState {
  const behaviorUntilTimestampMilliseconds =
    behavior === "swim" && existingBehaviorUntilTimestampMilliseconds === 0
      ? nowTimestampMilliseconds +
        getDurationMilliseconds(MINIMUM_SWIM_SESSION_MILLISECONDS, MAXIMUM_SWIM_SESSION_MILLISECONDS, random)
      : existingBehaviorUntilTimestampMilliseconds;

  return {
    path: createRoamPathForDuck(duck, random, behavior),
    waypointIndex: 0,
    behavior,
    behaviorUntilTimestampMilliseconds,
    idleUntilTimestampMilliseconds: 0
  };
}

function chooseNextRoamState(duck: Duck, nowTimestampMilliseconds: number, random: () => number): DuckRoamState {
  if (duck.position === null) {
    return createIdleState(nowTimestampMilliseconds, random);
  }

  const behavior = chooseBehavior(duck, getTilePositionFromWorldPosition(duck.position), random);

  if (behavior === "idle") {
    return createIdleState(nowTimestampMilliseconds, random);
  }

  const movementState = createMovementState(duck, behavior, nowTimestampMilliseconds, random);
  return movementState.path.length > 0 ? movementState : createIdleState(nowTimestampMilliseconds, random);
}

export function simulateDuckMovement(input: SimulateDuckMovementInput): SimulateDuckMovementResult {
  const deltaSeconds = Math.min(0.1, input.deltaMilliseconds / 1000);
  const nextRoamStateById = new Map(input.roamStateById);

  const ducks = input.ducks.map((duck) => {
    if (duck.placementStatus !== "placed" || duck.position === null) {
      nextRoamStateById.delete(duck.id);
      return duck;
    }

    if (input.draggedDuckId === duck.id) {
      return duck;
    }

    let roamState = nextRoamStateById.get(duck.id);

    if (roamState === undefined) {
      roamState = chooseNextRoamState(duck, input.nowTimestampMilliseconds, input.random);
      nextRoamStateById.set(duck.id, roamState);
    }

    if (roamState.behavior === "idle" && roamState.idleUntilTimestampMilliseconds > input.nowTimestampMilliseconds) {
      return { ...duck, activity: "idle" as const };
    }

    if (roamState.waypointIndex >= roamState.path.length) {
      if (roamState.behavior === "swim" && roamState.behaviorUntilTimestampMilliseconds > input.nowTimestampMilliseconds) {
        roamState = createMovementState(
          duck,
          "swim",
          input.nowTimestampMilliseconds,
          input.random,
          roamState.behaviorUntilTimestampMilliseconds
        );
      } else {
        roamState = chooseNextRoamState(duck, input.nowTimestampMilliseconds, input.random);
      }

      nextRoamStateById.set(duck.id, roamState);

      if (roamState.path.length === 0) {
        const activity: DuckActivity =
          roamState.behavior === "swim" && isWaterWorldPosition(duck.position) ? "swim" : "idle";

        return {
          ...duck,
          activity
        };
      }
    }

    const waypoint = roamState.path[roamState.waypointIndex];
    const distanceX = waypoint.x - duck.position.x;
    const distanceY = waypoint.y - duck.position.y;
    const distanceToWaypoint = Math.hypot(distanceX, distanceY);
    const movementActivity = getDuckMovementActivity(duck, duck.position);
    const speed = movementActivity === "swim" ? DUCK_SWIM_SPEED_PIXELS_PER_SECOND : DUCK_WALK_SPEED_PIXELS_PER_SECOND;
    const travelDistance = speed * deltaSeconds;
    const didReachWaypoint =
      distanceToWaypoint <= DUCK_WAYPOINT_REACHED_DISTANCE_PIXELS || travelDistance >= distanceToWaypoint;
    const nextPosition = didReachWaypoint
      ? waypoint
      : {
          x: duck.position.x + (distanceX / distanceToWaypoint) * travelDistance,
          y: duck.position.y + (distanceY / distanceToWaypoint) * travelDistance
        };
    const nextWaypointIndex = didReachWaypoint ? roamState.waypointIndex + 1 : roamState.waypointIndex;
    const nextFacingDirection = getFacingDirection(duck.position, nextPosition, duck.facingDirection);

    if (nextWaypointIndex >= roamState.path.length) {
      nextRoamStateById.set(duck.id, {
        ...roamState,
        path: [],
        waypointIndex: 0
      });

      return {
        ...duck,
        position: nextPosition,
        activity: getDuckMovementActivity(duck, nextPosition),
        facingDirection: nextFacingDirection,
        lastUpdatedAtTimestampMilliseconds: input.nowTimestampMilliseconds
      };
    }

    nextRoamStateById.set(duck.id, {
      ...roamState,
      waypointIndex: nextWaypointIndex
    });

    return {
      ...duck,
      position: nextPosition,
      activity: getDuckMovementActivity(duck, nextPosition),
      facingDirection: nextFacingDirection,
      lastUpdatedAtTimestampMilliseconds: input.nowTimestampMilliseconds
    };
  });

  return {
    ducks,
    roamStateById: nextRoamStateById
  };
}

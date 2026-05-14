import { getDuckVariantFamily } from "../shared/duckDefinitions.js";
import {
  HOMESTEAD_COLUMNS,
  HOMESTEAD_ROWS,
  getCenteredTileWorldPosition,
  getTilePositionFromWorldPosition,
  getTileTypeAt,
  isDuckAiPositionValid
} from "../shared/homesteadMap.js";
import type { Duck, DuckPosition } from "../shared/types.js";

const DUCK_IDLE_BETWEEN_WALKS_MILLISECONDS = 3000;
const DUCK_RANDOM_DESTINATION_ATTEMPTS = 28;
const DUCK_MINIMUM_DESTINATION_TILE_DISTANCE = 6;
const DUCK_WALK_SPEED_PIXELS_PER_SECOND = 38;
const DUCK_SWIM_SPEED_PIXELS_PER_SECOND = 30;
const DUCK_WAYPOINT_REACHED_DISTANCE_PIXELS = 2;

export interface HomesteadTileCoordinate {
  column: number;
  row: number;
}

export interface DuckRoamState {
  path: DuckPosition[];
  waypointIndex: number;
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

function isPondDuck(duck: Duck): boolean {
  return getDuckVariantFamily(duck.variantId) === "pond";
}

function isWaterWorldPosition(position: DuckPosition): boolean {
  const tilePosition = getTilePositionFromWorldPosition(position);
  const tileType = getTileTypeAt(tilePosition.column, tilePosition.row);

  return tileType === "water" || tileType === "waterRipple";
}

function isDuckTileValid(tileCoordinate: HomesteadTileCoordinate, canEnterWater: boolean): boolean {
  return isDuckAiPositionValid(getCenteredTileWorldPosition(tileCoordinate.column, tileCoordinate.row), canEnterWater);
}

export function getDuckMovementActivity(duck: Duck, position: DuckPosition): Duck["activity"] {
  return isPondDuck(duck) && isWaterWorldPosition(position) ? "swim" : "wander";
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

function getNeighborTileCoordinates(tileCoordinate: HomesteadTileCoordinate): HomesteadTileCoordinate[] {
  return [
    { column: tileCoordinate.column + 1, row: tileCoordinate.row },
    { column: tileCoordinate.column - 1, row: tileCoordinate.row },
    { column: tileCoordinate.column, row: tileCoordinate.row + 1 },
    { column: tileCoordinate.column, row: tileCoordinate.row - 1 }
  ];
}

export function findPathBetweenTiles(
  startTile: HomesteadTileCoordinate,
  destinationTile: HomesteadTileCoordinate,
  canEnterWater: boolean
): HomesteadTileCoordinate[] {
  if (!isDuckTileValid(startTile, canEnterWater) || !isDuckTileValid(destinationTile, canEnterWater)) {
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

    for (const neighborTile of getNeighborTileCoordinates(currentTile)) {
      if (
        neighborTile.column < 0 ||
        neighborTile.row < 0 ||
        neighborTile.column >= HOMESTEAD_COLUMNS ||
        neighborTile.row >= HOMESTEAD_ROWS ||
        !isDuckTileValid(neighborTile, canEnterWater)
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

function getRandomValidDestinationTile(
  duck: Duck,
  startTile: HomesteadTileCoordinate,
  random: () => number
): HomesteadTileCoordinate | null {
  const canEnterWater = isPondDuck(duck);
  let fallbackTile: HomesteadTileCoordinate | null = null;

  for (let attemptIndex = 0; attemptIndex < DUCK_RANDOM_DESTINATION_ATTEMPTS; attemptIndex += 1) {
    const destinationTile = {
      column: Math.floor(random() * HOMESTEAD_COLUMNS),
      row: Math.floor(random() * HOMESTEAD_ROWS)
    };

    if (!isDuckTileValid(destinationTile, canEnterWater)) {
      continue;
    }

    fallbackTile = destinationTile;

    const tileDistance =
      Math.abs(destinationTile.column - startTile.column) + Math.abs(destinationTile.row - startTile.row);

    if (tileDistance >= DUCK_MINIMUM_DESTINATION_TILE_DISTANCE) {
      return destinationTile;
    }
  }

  return fallbackTile;
}

export function createRoamPathForDuck(duck: Duck, random: () => number): DuckPosition[] {
  if (duck.position === null) {
    return [];
  }

  const startTile = getTilePositionFromWorldPosition(duck.position);
  const destinationTile = getRandomValidDestinationTile(duck, startTile, random);

  if (destinationTile === null) {
    return [];
  }

  return findPathBetweenTiles(startTile, destinationTile, isPondDuck(duck)).map((tileCoordinate) =>
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
      roamState = {
        path: [],
        waypointIndex: 0,
        idleUntilTimestampMilliseconds: input.nowTimestampMilliseconds
      };
      nextRoamStateById.set(duck.id, roamState);
    }

    if (roamState.idleUntilTimestampMilliseconds > input.nowTimestampMilliseconds) {
      return { ...duck, activity: "idle" as const };
    }

    if (roamState.waypointIndex >= roamState.path.length) {
      const path = createRoamPathForDuck(duck, input.random);

      if (path.length === 0) {
        nextRoamStateById.set(duck.id, {
          path: [],
          waypointIndex: 0,
          idleUntilTimestampMilliseconds: input.nowTimestampMilliseconds + DUCK_IDLE_BETWEEN_WALKS_MILLISECONDS
        });
        return { ...duck, activity: "idle" as const };
      }

      roamState = {
        path,
        waypointIndex: 0,
        idleUntilTimestampMilliseconds: 0
      };
      nextRoamStateById.set(duck.id, roamState);
    }

    const waypoint = roamState.path[roamState.waypointIndex];
    const distanceX = waypoint.x - duck.position.x;
    const distanceY = waypoint.y - duck.position.y;
    const distanceToWaypoint = Math.hypot(distanceX, distanceY);
    const speed = getDuckMovementActivity(duck, duck.position) === "swim"
      ? DUCK_SWIM_SPEED_PIXELS_PER_SECOND
      : DUCK_WALK_SPEED_PIXELS_PER_SECOND;
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

    if (nextWaypointIndex >= roamState.path.length) {
      nextRoamStateById.set(duck.id, {
        path: [],
        waypointIndex: 0,
        idleUntilTimestampMilliseconds: input.nowTimestampMilliseconds + DUCK_IDLE_BETWEEN_WALKS_MILLISECONDS
      });

      return {
        ...duck,
        position: nextPosition,
        activity: "idle" as const,
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
      lastUpdatedAtTimestampMilliseconds: input.nowTimestampMilliseconds
    };
  });

  return {
    ducks,
    roamStateById: nextRoamStateById
  };
}

import { getDuckVariantFamily } from "../shared/duckDefinitions.js";
import {
  HOMESTEAD_COLUMNS,
  HOMESTEAD_ROWS,
  getCenteredTileWorldPosition,
  getTilePositionFromWorldPosition,
  getTileTerrainKindAt,
  getTileTypeAt,
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
const DEFAULT_FAVORITE_ACTIVITY = "path patrol";

export interface HomesteadTileCoordinate {
  column: number;
  row: number;
}

type DuckRoamBehavior = "idle" | "wander" | "swim" | "rest";
type DuckFavoriteActivity =
  | "pond watching"
  | "seed sorting"
  | "path patrol"
  | "flower naps"
  | "muddy walks"
  | "sun patches";

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

interface DuckBehaviorProfile {
  favoriteActivity: DuckFavoriteActivity;
  behaviorWeights: Record<DuckRoamBehavior, number>;
  preferredTileTypes: ReadonlyArray<ReturnType<typeof getTileTypeAt>>;
  swimDestinationScore: number;
  nearWaterDestinationScore: number;
}

const DUCK_BEHAVIOR_PROFILES: Record<DuckFavoriteActivity, DuckBehaviorProfile> = {
  "pond watching": {
    favoriteActivity: "pond watching",
    behaviorWeights: { idle: 12, wander: 18, swim: 46, rest: 24 },
    preferredTileTypes: ["water", "waterRipple"],
    swimDestinationScore: 24,
    nearWaterDestinationScore: 16
  },
  "seed sorting": {
    favoriteActivity: "seed sorting",
    behaviorWeights: { idle: 34, wander: 26, swim: 14, rest: 26 },
    preferredTileTypes: ["grass", "grassVariant"],
    swimDestinationScore: 4,
    nearWaterDestinationScore: 2
  },
  "path patrol": {
    favoriteActivity: "path patrol",
    behaviorWeights: { idle: 16, wander: 56, swim: 14, rest: 14 },
    preferredTileTypes: ["path", "dirtPath"],
    swimDestinationScore: 0,
    nearWaterDestinationScore: 0
  },
  "flower naps": {
    favoriteActivity: "flower naps",
    behaviorWeights: { idle: 18, wander: 22, swim: 12, rest: 48 },
    preferredTileTypes: ["flower"],
    swimDestinationScore: 0,
    nearWaterDestinationScore: 3
  },
  "muddy walks": {
    favoriteActivity: "muddy walks",
    behaviorWeights: { idle: 8, wander: 66, swim: 18, rest: 8 },
    preferredTileTypes: ["dirtPath", "grassVariant"],
    swimDestinationScore: 2,
    nearWaterDestinationScore: 5
  },
  "sun patches": {
    favoriteActivity: "sun patches",
    behaviorWeights: { idle: 38, wander: 18, swim: 10, rest: 34 },
    preferredTileTypes: ["grass", "grassVariant", "flower"],
    swimDestinationScore: 0,
    nearWaterDestinationScore: 0
  }
};

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

export function normalizeDuckFavoriteActivity(favoriteActivity: string): DuckFavoriteActivity {
  return favoriteActivity in DUCK_BEHAVIOR_PROFILES
    ? (favoriteActivity as DuckFavoriteActivity)
    : DEFAULT_FAVORITE_ACTIVITY;
}

export function getDuckBehaviorProfile(duck: Duck): DuckBehaviorProfile {
  return DUCK_BEHAVIOR_PROFILES[normalizeDuckFavoriteActivity(duck.favoriteActivity)];
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

function getCurrentTileBehaviorWeights(duck: Duck, startTile: HomesteadTileCoordinate): Record<DuckRoamBehavior, number> {
  const profile = getDuckBehaviorProfile(duck);
  const behaviorWeights = { ...profile.behaviorWeights };
  const currentTerrainKind = getTileTerrainKindAt(startTile.column, startTile.row);

  if (isPondDuck(duck)) {
    behaviorWeights.swim += 12;
    behaviorWeights.wander -= 4;
  }

  if (currentTerrainKind === "water") {
    behaviorWeights.swim += 12;
    behaviorWeights.rest += 6;
  }

  if (duck.activity === "eat" && profile.favoriteActivity === "seed sorting") {
    behaviorWeights.idle += 18;
    behaviorWeights.rest += 10;
    behaviorWeights.wander -= 8;
  }

  return behaviorWeights;
}

export function chooseDuckRoamBehavior(duck: Duck, startTile: HomesteadTileCoordinate, random: () => number): DuckRoamBehavior {
  const canSwim = hasReachableWaterTile(duck, startTile, random);
  const behaviorWeights = getCurrentTileBehaviorWeights(duck, startTile);
  const weightedBehaviorCandidates: WeightedBehavior[] = [
    { behavior: "wander", weight: behaviorWeights.wander },
    { behavior: "idle", weight: behaviorWeights.idle },
    { behavior: "rest", weight: behaviorWeights.rest },
    { behavior: "swim", weight: canSwim ? behaviorWeights.swim : 0 }
  ];
  const weightedBehaviors = weightedBehaviorCandidates.filter((entry) => entry.weight > 0);
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

function isNearWaterTile(tileCoordinate: HomesteadTileCoordinate): boolean {
  const neighborTiles = [
    tileCoordinate,
    { column: tileCoordinate.column + 1, row: tileCoordinate.row },
    { column: tileCoordinate.column - 1, row: tileCoordinate.row },
    { column: tileCoordinate.column, row: tileCoordinate.row + 1 },
    { column: tileCoordinate.column, row: tileCoordinate.row - 1 }
  ];

  return neighborTiles.some((neighborTile) => {
    return (
      neighborTile.column >= 0 &&
      neighborTile.row >= 0 &&
      neighborTile.column < HOMESTEAD_COLUMNS &&
      neighborTile.row < HOMESTEAD_ROWS &&
      getTileTerrainKindAt(neighborTile.column, neighborTile.row) === "water"
    );
  });
}

export function scoreDuckDestinationTile(
  duck: Duck,
  destinationTile: HomesteadTileCoordinate,
  startTile: HomesteadTileCoordinate,
  behavior: DuckRoamBehavior
): number {
  const profile = getDuckBehaviorProfile(duck);
  const tileType = getTileTypeAt(destinationTile.column, destinationTile.row);
  const distanceScore = Math.min(8, getManhattanTileDistance(destinationTile, startTile));
  let score = distanceScore;

  if (profile.preferredTileTypes.includes(tileType)) {
    score += 20;
  }

  if (behavior === "swim" && getTileTerrainKindAt(destinationTile.column, destinationTile.row) === "water") {
    score += profile.swimDestinationScore;
  }

  if (isNearWaterTile(destinationTile)) {
    score += profile.nearWaterDestinationScore;
  }

  if (behavior === "rest" && tileType === "flower") {
    score += 10;
  }

  if (behavior === "wander" && (tileType === "path" || tileType === "dirtPath")) {
    score += 6;
  }

  return score;
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
  let bestTile: HomesteadTileCoordinate | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

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
      const score = scoreDuckDestinationTile(duck, destinationTile, startTile, behavior) + random();

      if (score > bestScore) {
        bestTile = destinationTile;
        bestScore = score;
      }
    }
  }

  return bestTile ?? fallbackTile;
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

function createRestState(nowTimestampMilliseconds: number, random: () => number): DuckRoamState {
  const restUntilTimestampMilliseconds =
    nowTimestampMilliseconds + getDurationMilliseconds(MINIMUM_IDLE_MILLISECONDS, MAXIMUM_IDLE_MILLISECONDS, random);

  return {
    path: [],
    waypointIndex: 0,
    behavior: "rest",
    behaviorUntilTimestampMilliseconds: restUntilTimestampMilliseconds,
    idleUntilTimestampMilliseconds: restUntilTimestampMilliseconds
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

  const behavior = chooseDuckRoamBehavior(duck, getTilePositionFromWorldPosition(duck.position), random);

  if (behavior === "idle") {
    return createIdleState(nowTimestampMilliseconds, random);
  }

  if (behavior === "rest") {
    return createRestState(nowTimestampMilliseconds, random);
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

    if (
      (roamState.behavior === "idle" || roamState.behavior === "rest") &&
      roamState.idleUntilTimestampMilliseconds > input.nowTimestampMilliseconds
    ) {
      const activity: DuckActivity = roamState.behavior === "rest" ? "rest" : "idle";
      return { ...duck, activity };
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
          roamState.behavior === "swim" && isWaterWorldPosition(duck.position)
            ? "swim"
            : roamState.behavior === "rest"
              ? "rest"
              : "idle";

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

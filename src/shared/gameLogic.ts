import { DUCK_GROWTH_SEED_REQUIREMENTS, MAX_DUCK_COUNT, getProjectDurationSeconds } from "./balance.js";
import { DUCK_VARIANT_IDS, createDefaultDuckName, createFavoriteActivity } from "./duckDefinitions.js";
import { PROJECT_DEFINITION_BY_ID, isEggProjectId, isProjectId } from "./projectDefinitions.js";
import type {
  Duck,
  DuckActivity,
  DuckFacingDirection,
  DuckGrowthStage,
  DuckPosition,
  DuckSimulationStateUpdate,
  DuckVariantId,
  EggProjectId,
  FeedDuckMode,
  GameState,
  HomesteadCameraState,
  ProjectId,
  ProjectProgressState,
  TimerState
} from "./types.js";

const MILLISECONDS_PER_SECOND = 1000;
const MAX_DUCK_NAME_LENGTH = 18;

interface LegacyDuck {
  id?: unknown;
  sourceDuckRewardItemId?: unknown;
  hatchedAtTimestampMilliseconds?: unknown;
}

interface LegacyDuckRewardsState {
  selectedDuckRewardItemId?: unknown;
  selectedDuckRewardItemProgressSeconds?: unknown;
  ducks?: unknown;
  totalCompletedSessions?: unknown;
  totalCompletedFocusSeconds?: unknown;
}

export interface GameLogicResult {
  gameState: GameState;
  statusMessage: string | null;
}

export interface ClaimActiveProjectDependencies {
  random: () => number;
  createId: () => string;
}

const DEFAULT_CLAIM_ACTIVE_PROJECT_DEPENDENCIES: ClaimActiveProjectDependencies = {
  random: () => Math.random(),
  createId: () => crypto.randomUUID()
};

export function createDefaultGameState(): GameState {
  return {
    activeProjectId: null,
    projectProgressById: {},
    ducks: [],
    seedCount: 0,
    totalCompletedSessions: 0,
    totalCompletedFocusSeconds: 0,
    homesteadCamera: { x: 0, y: 0, zoom: 1 }
  };
}

export function calculateElapsedSecondsSinceTimestamp(
  fromTimestampMilliseconds: number,
  toTimestampMilliseconds: number
): number {
  if (toTimestampMilliseconds <= fromTimestampMilliseconds) {
    return 0;
  }

  return Math.floor((toTimestampMilliseconds - fromTimestampMilliseconds) / MILLISECONDS_PER_SECOND);
}

export function sanitizeDuckName(submittedName: string, fallbackName: string): string {
  const trimmedName = submittedName.trim();

  if (trimmedName.length === 0) {
    return fallbackName;
  }

  return trimmedName.slice(0, MAX_DUCK_NAME_LENGTH);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDuckVariantId(value: unknown): value is DuckVariantId {
  return typeof value === "string" && DUCK_VARIANT_IDS.includes(value as DuckVariantId);
}

function isDuckGrowthStage(value: unknown): value is DuckGrowthStage {
  return value === "duckling" || value === "youngDuck" || value === "adultDuck";
}

function isDuckActivity(value: unknown): value is DuckActivity {
  return value === "idle" || value === "wander" || value === "swim" || value === "rest" || value === "eat";
}

function isDuckFacingDirection(value: unknown): value is DuckFacingDirection {
  return value === "left" || value === "right";
}

function isDuckPosition(value: unknown): value is DuckPosition {
  if (!isObjectRecord(value)) {
    return false;
  }

  return typeof value.x === "number" && typeof value.y === "number";
}

function isHomesteadCameraState(value: unknown): value is HomesteadCameraState {
  if (!isObjectRecord(value)) {
    return false;
  }

  return typeof value.x === "number" && typeof value.y === "number";
}

function normalizeHomesteadCameraState(value: unknown): HomesteadCameraState {
  if (!isHomesteadCameraState(value)) {
    return { x: 0, y: 0, zoom: 1 };
  }

  return {
    x: value.x,
    y: value.y,
    zoom: typeof value.zoom === "number" ? value.zoom : 1
  };
}

function normalizeProgressState(projectId: ProjectId, value: unknown): ProjectProgressState {
  if (!isObjectRecord(value)) {
    return {
      projectId,
      progressSeconds: 0,
      isReadyToClaim: false,
      progressStartedAtTimestampMilliseconds: null
    };
  }

  const progressSeconds = typeof value.progressSeconds === "number" ? Math.max(0, value.progressSeconds) : 0;
  const requiredProgressSeconds = getProjectDurationSeconds(projectId);
  const normalizedProgressSeconds = Math.min(progressSeconds, requiredProgressSeconds);
  const progressStartedAtTimestampMilliseconds =
    typeof value.progressStartedAtTimestampMilliseconds === "number"
      ? value.progressStartedAtTimestampMilliseconds
      : null;

  return {
    projectId,
    progressSeconds: normalizedProgressSeconds,
    isReadyToClaim: value.isReadyToClaim === true || normalizedProgressSeconds >= requiredProgressSeconds,
    progressStartedAtTimestampMilliseconds
  };
}

function normalizeDuck(value: unknown, duckIndex: number, nowTimestampMilliseconds: number): Duck | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  if (typeof value.id !== "string") {
    return null;
  }

  const sourceEggProjectId = isProjectId(value.sourceEggProjectId) && isEggProjectId(value.sourceEggProjectId)
    ? value.sourceEggProjectId
    : "meadowEgg";
  const variantId = isDuckVariantId(value.variantId) ? value.variantId : "yellow";
  const hatchedAtTimestampMilliseconds =
    typeof value.hatchedAtTimestampMilliseconds === "number"
      ? value.hatchedAtTimestampMilliseconds
      : nowTimestampMilliseconds;
  const fallbackName = createDefaultDuckName(duckIndex);
  const placementStatus = value.placementStatus === "placed" ? "placed" : "unplaced";
  const position = isDuckPosition(value.position) ? value.position : null;
  const homePosition = isDuckPosition(value.homePosition)
    ? value.homePosition
    : placementStatus === "placed"
      ? position
      : null;

  return {
    id: value.id,
    name: typeof value.name === "string" ? sanitizeDuckName(value.name, fallbackName) : fallbackName,
    variantId,
    sourceEggProjectId,
    growthStage: isDuckGrowthStage(value.growthStage) ? value.growthStage : "duckling",
    seedsFedForCurrentStage:
      typeof value.seedsFedForCurrentStage === "number" ? Math.max(0, value.seedsFedForCurrentStage) : 0,
    placementStatus,
    position,
    homePosition,
    activity: isDuckActivity(value.activity) ? value.activity : "idle",
    facingDirection: isDuckFacingDirection(value.facingDirection) ? value.facingDirection : "right",
    favoriteActivity:
      typeof value.favoriteActivity === "string" ? value.favoriteActivity : createFavoriteActivity(duckIndex),
    hatchedAtTimestampMilliseconds,
    lastUpdatedAtTimestampMilliseconds:
      typeof value.lastUpdatedAtTimestampMilliseconds === "number"
        ? value.lastUpdatedAtTimestampMilliseconds
        : hatchedAtTimestampMilliseconds
  };
}

function migrateLegacyDuck(legacyDuck: LegacyDuck, duckIndex: number, nowTimestampMilliseconds: number): Duck | null {
  if (typeof legacyDuck.id !== "string") {
    return null;
  }

  const sourceEggProjectId: EggProjectId = legacyDuck.sourceDuckRewardItemId === "duckEgg2" ? "pondEgg" : "meadowEgg";
  const hatchedAtTimestampMilliseconds =
    typeof legacyDuck.hatchedAtTimestampMilliseconds === "number"
      ? legacyDuck.hatchedAtTimestampMilliseconds
      : nowTimestampMilliseconds;

  return {
    id: legacyDuck.id,
    name: createDefaultDuckName(duckIndex),
    variantId: sourceEggProjectId === "pondEgg" ? "brown-green" : "yellow",
    sourceEggProjectId,
    growthStage: "duckling",
    seedsFedForCurrentStage: 0,
    placementStatus: "unplaced",
    position: null,
    homePosition: null,
    activity: "idle",
    facingDirection: "right",
    favoriteActivity: createFavoriteActivity(duckIndex),
    hatchedAtTimestampMilliseconds,
    lastUpdatedAtTimestampMilliseconds: hatchedAtTimestampMilliseconds
  };
}

export function normalizeGameState(value: unknown, nowTimestampMilliseconds: number): GameState {
  const defaultGameState = createDefaultGameState();

  if (!isObjectRecord(value)) {
    return defaultGameState;
  }

  const activeProjectId = isProjectId(value.activeProjectId) ? value.activeProjectId : null;
  const projectProgressById: Partial<Record<ProjectId, ProjectProgressState>> = {};

  if (isObjectRecord(value.projectProgressById)) {
    for (const projectId of Object.keys(PROJECT_DEFINITION_BY_ID)) {
      if (isProjectId(projectId) && value.projectProgressById[projectId] !== undefined) {
        projectProgressById[projectId] = normalizeProgressState(projectId, value.projectProgressById[projectId]);
      }
    }
  }

  const ducks = Array.isArray(value.ducks)
    ? value.ducks
        .map((duck, duckIndex) => normalizeDuck(duck, duckIndex, nowTimestampMilliseconds))
        .filter((duck): duck is Duck => duck !== null)
        .slice(0, MAX_DUCK_COUNT)
    : [];

  return {
    activeProjectId,
    projectProgressById,
    ducks,
    seedCount: typeof value.seedCount === "number" ? Math.max(0, Math.floor(value.seedCount)) : 0,
    totalCompletedSessions:
      typeof value.totalCompletedSessions === "number" ? Math.max(0, value.totalCompletedSessions) : 0,
    totalCompletedFocusSeconds:
      typeof value.totalCompletedFocusSeconds === "number" ? Math.max(0, value.totalCompletedFocusSeconds) : 0,
    homesteadCamera: normalizeHomesteadCameraState(value.homesteadCamera)
  };
}

export function migrateLegacyDuckRewardsState(
  value: unknown,
  nowTimestampMilliseconds: number
): GameState | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const legacyState = value as LegacyDuckRewardsState;
  const defaultGameState = createDefaultGameState();
  const activeProjectId =
    legacyState.selectedDuckRewardItemId === "duckEgg1"
      ? "meadowEgg"
      : legacyState.selectedDuckRewardItemId === "duckEgg2"
        ? "pondEgg"
        : null;
  const migratedState: GameState = {
    ...defaultGameState,
    activeProjectId,
    ducks: Array.isArray(legacyState.ducks)
      ? legacyState.ducks
          .map((duck, duckIndex) => migrateLegacyDuck(duck as LegacyDuck, duckIndex, nowTimestampMilliseconds))
          .filter((duck): duck is Duck => duck !== null)
      : [],
    totalCompletedSessions:
      typeof legacyState.totalCompletedSessions === "number" ? legacyState.totalCompletedSessions : 0,
    totalCompletedFocusSeconds:
      typeof legacyState.totalCompletedFocusSeconds === "number" ? legacyState.totalCompletedFocusSeconds : 0
  };

  if (activeProjectId !== null) {
    const progressSeconds =
      typeof legacyState.selectedDuckRewardItemProgressSeconds === "number"
        ? legacyState.selectedDuckRewardItemProgressSeconds
        : 0;

    migratedState.projectProgressById[activeProjectId] = normalizeProgressState(activeProjectId, {
      progressSeconds,
      isReadyToClaim: progressSeconds >= getProjectDurationSeconds(activeProjectId),
      progressStartedAtTimestampMilliseconds: null
    });
  }

  return migratedState;
}

export function getProjectProgressState(gameState: GameState, projectId: ProjectId): ProjectProgressState {
  return (
    gameState.projectProgressById[projectId] ?? {
      projectId,
      progressSeconds: 0,
      isReadyToClaim: false,
      progressStartedAtTimestampMilliseconds: null
    }
  );
}

export function synchronizeGameProgressStateWithTimer(
  gameState: GameState,
  timerState: TimerState,
  nowTimestampMilliseconds: number
): GameState {
  if (gameState.activeProjectId === null) {
    return gameState;
  }

  const activeProjectId = gameState.activeProjectId;
  const requiredProgressSeconds = getProjectDurationSeconds(activeProjectId);
  const progressState = getProjectProgressState(gameState, activeProjectId);

  if (progressState.isReadyToClaim) {
    return {
      ...gameState,
      projectProgressById: {
        ...gameState.projectProgressById,
        [activeProjectId]: {
          ...progressState,
          progressSeconds: requiredProgressSeconds,
          progressStartedAtTimestampMilliseconds: null,
          isReadyToClaim: true
        }
      }
    };
  }

  if (!timerState.isRunning) {
    if (progressState.progressStartedAtTimestampMilliseconds === null) {
      return gameState;
    }

    const elapsedSeconds = calculateElapsedSecondsSinceTimestamp(
      progressState.progressStartedAtTimestampMilliseconds,
      nowTimestampMilliseconds
    );
    const progressSeconds = Math.min(progressState.progressSeconds + elapsedSeconds, requiredProgressSeconds);

    return {
      ...gameState,
      projectProgressById: {
        ...gameState.projectProgressById,
        [activeProjectId]: {
          ...progressState,
          progressSeconds,
          progressStartedAtTimestampMilliseconds: null,
          isReadyToClaim: progressSeconds >= requiredProgressSeconds
        }
      }
    };
  }

  if (progressState.progressStartedAtTimestampMilliseconds === null) {
    return {
      ...gameState,
      projectProgressById: {
        ...gameState.projectProgressById,
        [activeProjectId]: {
          ...progressState,
          progressStartedAtTimestampMilliseconds: nowTimestampMilliseconds
        }
      }
    };
  }

  const elapsedSeconds = calculateElapsedSecondsSinceTimestamp(
    progressState.progressStartedAtTimestampMilliseconds,
    nowTimestampMilliseconds
  );

  if (elapsedSeconds < 1) {
    return gameState;
  }

  const progressSeconds = Math.min(progressState.progressSeconds + elapsedSeconds, requiredProgressSeconds);

  if (progressSeconds < requiredProgressSeconds) {
    return {
      ...gameState,
      projectProgressById: {
        ...gameState.projectProgressById,
        [activeProjectId]: {
          ...progressState,
          progressSeconds,
          progressStartedAtTimestampMilliseconds: nowTimestampMilliseconds,
          isReadyToClaim: false
        }
      }
    };
  }

  return {
    ...gameState,
    projectProgressById: {
      ...gameState.projectProgressById,
      [activeProjectId]: {
        ...progressState,
        progressSeconds: requiredProgressSeconds,
        progressStartedAtTimestampMilliseconds: null,
        isReadyToClaim: true
      }
    }
  };
}

export function applyCompletedFocusSessionToTotals(gameState: GameState, completedFocusSeconds: number): GameState {
  if (!Number.isFinite(completedFocusSeconds) || completedFocusSeconds < 1) {
    return gameState;
  }

  return {
    ...gameState,
    totalCompletedSessions: gameState.totalCompletedSessions + 1,
    totalCompletedFocusSeconds: gameState.totalCompletedFocusSeconds + Math.floor(completedFocusSeconds)
  };
}

export function selectActiveProject(gameState: GameState, projectId: ProjectId): GameState {
  return {
    ...gameState,
    activeProjectId: projectId,
    projectProgressById: {
      ...gameState.projectProgressById,
      [projectId]: getProjectProgressState(gameState, projectId)
    }
  };
}

export function clearClaimedActiveProject(gameState: GameState, projectId: ProjectId): GameState {
  const updatedProjectProgressById = { ...gameState.projectProgressById };
  delete updatedProjectProgressById[projectId];

  return {
    ...gameState,
    activeProjectId: null,
    projectProgressById: updatedProjectProgressById
  };
}

export function rollDuckVariant(
  hatchTable: ReadonlyArray<{ variantId: DuckVariantId; chanceWeight: number }>,
  random: () => number = Math.random
): DuckVariantId {
  const totalWeight = hatchTable.reduce((sum, entry) => sum + entry.chanceWeight, 0);
  const selectedWeight = random() * totalWeight;
  let cumulativeWeight = 0;

  for (const entry of hatchTable) {
    cumulativeWeight += entry.chanceWeight;

    if (selectedWeight <= cumulativeWeight) {
      return entry.variantId;
    }
  }

  return hatchTable[0].variantId;
}

export function createDuckFromEggProject(
  projectId: EggProjectId,
  variantId: DuckVariantId,
  duckCountBeforeCreate: number,
  nowTimestampMilliseconds: number,
  duckId: string = crypto.randomUUID()
): Duck {
  return {
    id: duckId,
    name: createDefaultDuckName(duckCountBeforeCreate),
    variantId,
    sourceEggProjectId: projectId,
    growthStage: "duckling",
    seedsFedForCurrentStage: 0,
    placementStatus: "unplaced",
    position: null,
    homePosition: null,
    activity: "idle",
    facingDirection: "right",
    favoriteActivity: createFavoriteActivity(duckCountBeforeCreate),
    hatchedAtTimestampMilliseconds: nowTimestampMilliseconds,
    lastUpdatedAtTimestampMilliseconds: nowTimestampMilliseconds
  };
}

export function claimActiveProject(
  gameState: GameState,
  nowTimestampMilliseconds: number,
  dependencies: ClaimActiveProjectDependencies = DEFAULT_CLAIM_ACTIVE_PROJECT_DEPENDENCIES
): GameLogicResult {
  if (gameState.activeProjectId === null) {
    return { gameState, statusMessage: "Pick a project first." };
  }

  const activeProjectId = gameState.activeProjectId;
  const projectProgressState = getProjectProgressState(gameState, activeProjectId);

  if (!projectProgressState.isReadyToClaim) {
    return { gameState, statusMessage: "Project is not ready yet." };
  }

  const projectDefinition = PROJECT_DEFINITION_BY_ID[activeProjectId];

  if (projectDefinition.type === "seeds") {
    return {
      gameState: {
        ...clearClaimedActiveProject(gameState, activeProjectId),
        seedCount: gameState.seedCount + projectDefinition.seedRewardCount
      },
      statusMessage: `Claimed ${projectDefinition.seedRewardCount} seeds.`
    };
  }

  if (gameState.ducks.length >= MAX_DUCK_COUNT) {
    return { gameState, statusMessage: "Duck cap reached. Grow seeds or place ducks first." };
  }

  const variantId = rollDuckVariant(projectDefinition.hatchTable, dependencies.random);
  const duck = createDuckFromEggProject(
    projectDefinition.id,
    variantId,
    gameState.ducks.length,
    nowTimestampMilliseconds,
    dependencies.createId()
  );

  return {
    gameState: {
      ...clearClaimedActiveProject(gameState, activeProjectId),
      ducks: [...gameState.ducks, duck]
    },
    statusMessage: `${duck.name} hatched.`
  };
}

function getSeedsNeededForNextStage(growthStage: DuckGrowthStage): number | null {
  if (growthStage === "adultDuck") {
    return null;
  }

  return DUCK_GROWTH_SEED_REQUIREMENTS[growthStage];
}

function getNextGrowthStage(growthStage: DuckGrowthStage): DuckGrowthStage {
  if (growthStage === "duckling") {
    return "youngDuck";
  }

  if (growthStage === "youngDuck") {
    return "adultDuck";
  }

  return "adultDuck";
}

export function feedDuck(
  gameState: GameState,
  duckId: string,
  feedMode: FeedDuckMode,
  nowTimestampMilliseconds: number
): GameLogicResult {
  const duck = gameState.ducks.find((possibleDuck) => possibleDuck.id === duckId);

  if (!duck) {
    return { gameState, statusMessage: "Duck not found." };
  }

  const seedsNeededForNextStage = getSeedsNeededForNextStage(duck.growthStage);

  if (seedsNeededForNextStage === null) {
    return { gameState, statusMessage: "Adult ducks are fully grown." };
  }

  const remainingSeedsForStage = seedsNeededForNextStage - duck.seedsFedForCurrentStage;
  const seedSpendCount = feedMode === "toNextStage" ? remainingSeedsForStage : 1;

  if (gameState.seedCount < seedSpendCount) {
    return { gameState, statusMessage: "Not enough seeds." };
  }

  let updatedGrowthStage = duck.growthStage;
  let updatedSeedsFedForCurrentStage = duck.seedsFedForCurrentStage + seedSpendCount;

  if (updatedSeedsFedForCurrentStage >= seedsNeededForNextStage) {
    updatedGrowthStage = getNextGrowthStage(duck.growthStage);
    updatedSeedsFedForCurrentStage = 0;
  }

  return {
    gameState: {
      ...gameState,
      seedCount: gameState.seedCount - seedSpendCount,
      ducks: gameState.ducks.map((possibleDuck) =>
        possibleDuck.id === duckId
          ? {
              ...possibleDuck,
              growthStage: updatedGrowthStage,
              seedsFedForCurrentStage: updatedSeedsFedForCurrentStage,
              activity: "eat",
              lastUpdatedAtTimestampMilliseconds: nowTimestampMilliseconds
            }
          : possibleDuck
      )
    },
    statusMessage: updatedGrowthStage !== duck.growthStage ? `${duck.name} grew.` : `${duck.name} ate a seed.`
  };
}

export function renameDuck(gameState: GameState, duckId: string, submittedName: string): GameLogicResult {
  const duckIndex = gameState.ducks.findIndex((possibleDuck) => possibleDuck.id === duckId);

  if (duckIndex < 0) {
    return { gameState, statusMessage: "Duck not found." };
  }

  const fallbackName = createDefaultDuckName(duckIndex);
  const sanitizedName = sanitizeDuckName(submittedName, fallbackName);

  return {
    gameState: {
      ...gameState,
      ducks: gameState.ducks.map((duck) => (duck.id === duckId ? { ...duck, name: sanitizedName } : duck))
    },
    statusMessage: "Duck renamed."
  };
}

export function updateDuckPlacement(
  gameState: GameState,
  duckId: string,
  position: DuckPosition,
  nowTimestampMilliseconds: number
): GameLogicResult {
  if (!gameState.ducks.some((duck) => duck.id === duckId)) {
    return { gameState, statusMessage: "Duck not found." };
  }

  return {
    gameState: {
      ...gameState,
      ducks: gameState.ducks.map((duck) =>
        duck.id === duckId
          ? {
              ...duck,
              placementStatus: "placed",
              position,
              homePosition: duck.homePosition ?? position,
              activity: "idle",
              facingDirection: duck.facingDirection,
              lastUpdatedAtTimestampMilliseconds: nowTimestampMilliseconds
            }
          : duck
      )
    },
    statusMessage: "Duck placed."
  };
}

export function updateDuckSimulationState(gameState: GameState, updates: DuckSimulationStateUpdate[]): GameState {
  const updateByDuckId = new Map(updates.map((update) => [update.duckId, update]));

  return {
    ...gameState,
    ducks: gameState.ducks.map((duck) => {
      const update = updateByDuckId.get(duck.id);

      if (update === undefined || duck.placementStatus !== "placed") {
        return duck;
      }

      return {
        ...duck,
        position: update.position,
        activity: update.activity,
        facingDirection: update.facingDirection,
        lastUpdatedAtTimestampMilliseconds: update.lastUpdatedAtTimestampMilliseconds
      };
    })
  };
}

export function saveHomesteadCamera(gameState: GameState, homesteadCamera: HomesteadCameraState): GameState {
  return {
    ...gameState,
    homesteadCamera
  };
}

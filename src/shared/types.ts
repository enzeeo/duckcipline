export type ProjectType = "egg" | "seeds";

export type EggProjectId = "meadowEgg" | "pondEgg" | "fancyEgg";
export type SeedProjectId = "smallSeedPatch" | "gardenBed" | "bigHarvest";
export type ProjectId = EggProjectId | SeedProjectId;

export type DuckVariantId =
  | "meadow-a"
  | "meadow-b"
  | "pond-a"
  | "pond-b"
  | "fancy-a"
  | "fancy-b"
  | "brown-green"
  | "white"
  | "yellow"
  | "gray"
  | "light-brown"
  | "gold"
  | "white-black";

export type DuckGrowthStage = "duckling" | "youngDuck" | "adultDuck";
export type DuckPlacementStatus = "unplaced" | "placed";
export type DuckActivity = "idle" | "wander" | "swim" | "rest" | "eat";
export type DuckFacingDirection = "left" | "right";
export type FeedDuckMode = "single" | "toNextStage";

export interface TimerState {
  isRunning: boolean;
  hasStartedAtLeastOnce: boolean;
  configuredDurationSeconds: number;
  startedAtTimestampMilliseconds: number | null;
  remainingSecondsWhenNotRunning: number;
}

export interface ProjectProgressState {
  projectId: ProjectId;
  progressSeconds: number;
  isReadyToClaim: boolean;
  progressStartedAtTimestampMilliseconds: number | null;
}

export interface DuckPosition {
  x: number;
  y: number;
}

export interface Duck {
  id: string;
  name: string;
  variantId: DuckVariantId;
  sourceEggProjectId: EggProjectId;
  growthStage: DuckGrowthStage;
  seedsFedForCurrentStage: number;
  placementStatus: DuckPlacementStatus;
  position: DuckPosition | null;
  homePosition: DuckPosition | null;
  activity: DuckActivity;
  facingDirection: DuckFacingDirection;
  favoriteActivity: string;
  hatchedAtTimestampMilliseconds: number;
  lastUpdatedAtTimestampMilliseconds: number;
}

export interface DuckSimulationStateUpdate {
  duckId: string;
  position: DuckPosition;
  activity: DuckActivity;
  facingDirection: DuckFacingDirection;
  lastUpdatedAtTimestampMilliseconds: number;
}

export interface HomesteadCameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface GameState {
  activeProjectId: ProjectId | null;
  projectProgressById: Partial<Record<ProjectId, ProjectProgressState>>;
  ducks: Duck[];
  seedCount: number;
  totalCompletedSessions: number;
  totalCompletedFocusSeconds: number;
  homesteadCamera: HomesteadCameraState;
}

export interface HatchTableEntry {
  variantId: DuckVariantId;
  chanceWeight: number;
}

export interface ProjectDefinitionResponse {
  id: ProjectId;
  type: ProjectType;
  displayName: string;
  requiredProgressSeconds: number;
  rewardDescription: string;
}

export interface TimerStatusResponse {
  isRunning: boolean;
  hasStartedAtLeastOnce: boolean;
  remainingSeconds: number;
  configuredDurationSeconds: number;
}

export interface GameStatusResponse {
  gameState: GameState;
  projectDefinitions: ProjectDefinitionResponse[];
  maxDuckCount: number;
  nowTimestampMilliseconds: number;
  statusMessage: string | null;
}

export interface ErrorResponse {
  error: string;
}

export type TimerMessageResponse = TimerStatusResponse | ErrorResponse;
export type GameMessageResponse = GameStatusResponse | ErrorResponse;

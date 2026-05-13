import type {
  Duck,
  FeedDuckMode,
  GameMessageResponse,
  GameStatusResponse,
  HomesteadCameraState,
  ProjectId,
  TimerMessageResponse,
  TimerStatusResponse
} from "./types.js";
import { isProjectId } from "./projectDefinitions.js";

export const START_TIMER_MESSAGE_TYPE = "startTimer";
export const STOP_TIMER_MESSAGE_TYPE = "stopTimer";
export const PAUSE_TIMER_MESSAGE_TYPE = "pauseTimer";
export const RESET_TIMER_MESSAGE_TYPE = "resetTimer";
export const GET_TIMER_STATE_MESSAGE_TYPE = "getTimerState";

export const GET_GAME_STATE_MESSAGE_TYPE = "getGameState";
export const SELECT_PROJECT_MESSAGE_TYPE = "selectProject";
export const CLAIM_ACTIVE_PROJECT_MESSAGE_TYPE = "claimActiveProject";
export const RENAME_DUCK_MESSAGE_TYPE = "renameDuck";
export const FEED_DUCK_MESSAGE_TYPE = "feedDuck";
export const PLACE_DUCK_MESSAGE_TYPE = "placeDuck";
export const MOVE_DUCK_MESSAGE_TYPE = "moveDuck";
export const UPDATE_DUCK_SIMULATION_STATE_MESSAGE_TYPE = "updateDuckSimulationState";
export const SAVE_HOMESTEAD_CAMERA_MESSAGE_TYPE = "saveHomesteadCamera";

export interface StartTimerMessage {
  type: typeof START_TIMER_MESSAGE_TYPE;
  durationSeconds: number;
}

export interface StopTimerMessage {
  type: typeof STOP_TIMER_MESSAGE_TYPE;
}

export interface PauseTimerMessage {
  type: typeof PAUSE_TIMER_MESSAGE_TYPE;
}

export interface ResetTimerMessage {
  type: typeof RESET_TIMER_MESSAGE_TYPE;
  durationSeconds: number;
}

export interface GetTimerStateMessage {
  type: typeof GET_TIMER_STATE_MESSAGE_TYPE;
}

export interface GetGameStateMessage {
  type: typeof GET_GAME_STATE_MESSAGE_TYPE;
}

export interface SelectProjectMessage {
  type: typeof SELECT_PROJECT_MESSAGE_TYPE;
  projectId: ProjectId;
}

export interface ClaimActiveProjectMessage {
  type: typeof CLAIM_ACTIVE_PROJECT_MESSAGE_TYPE;
}

export interface RenameDuckMessage {
  type: typeof RENAME_DUCK_MESSAGE_TYPE;
  duckId: string;
  name: string;
}

export interface FeedDuckMessage {
  type: typeof FEED_DUCK_MESSAGE_TYPE;
  duckId: string;
  feedMode: FeedDuckMode;
}

export interface PlaceDuckMessage {
  type: typeof PLACE_DUCK_MESSAGE_TYPE;
  duckId: string;
  x: number;
  y: number;
}

export interface MoveDuckMessage {
  type: typeof MOVE_DUCK_MESSAGE_TYPE;
  duckId: string;
  x: number;
  y: number;
}

export interface UpdateDuckSimulationStateMessage {
  type: typeof UPDATE_DUCK_SIMULATION_STATE_MESSAGE_TYPE;
  ducks: Duck[];
}

export interface SaveHomesteadCameraMessage {
  type: typeof SAVE_HOMESTEAD_CAMERA_MESSAGE_TYPE;
  homesteadCamera: HomesteadCameraState;
}

export type TimerRequestMessage =
  | StartTimerMessage
  | StopTimerMessage
  | PauseTimerMessage
  | ResetTimerMessage
  | GetTimerStateMessage;

export type GameRequestMessage =
  | GetGameStateMessage
  | SelectProjectMessage
  | ClaimActiveProjectMessage
  | RenameDuckMessage
  | FeedDuckMessage
  | PlaceDuckMessage
  | MoveDuckMessage
  | UpdateDuckSimulationStateMessage
  | SaveHomesteadCameraMessage;

export type ExtensionRequestMessage = TimerRequestMessage | GameRequestMessage;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isErrorResponse(value: unknown): value is { error: string } {
  return isObjectRecord(value) && typeof value.error === "string";
}

function isTimerStatusResponse(value: unknown): value is TimerStatusResponse {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.isRunning === "boolean" &&
    typeof value.hasStartedAtLeastOnce === "boolean" &&
    typeof value.remainingSeconds === "number" &&
    typeof value.configuredDurationSeconds === "number"
  );
}

function isGameStatusResponse(value: unknown): value is GameStatusResponse {
  if (!isObjectRecord(value)) {
    return false;
  }

  const gameState = value.gameState;

  return (
    isObjectRecord(gameState) &&
    Array.isArray(value.projectDefinitions) &&
    typeof value.maxDuckCount === "number" &&
    typeof value.nowTimestampMilliseconds === "number" &&
    (typeof value.statusMessage === "string" || value.statusMessage === null)
  );
}

function isFeedDuckMode(value: unknown): value is FeedDuckMode {
  return value === "single" || value === "toNextStage";
}

function isDuckArray(value: unknown): value is Duck[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((duck) => isObjectRecord(duck) && typeof duck.id === "string");
}

function isHomesteadCameraState(value: unknown): value is HomesteadCameraState {
  if (!isObjectRecord(value)) {
    return false;
  }

  return typeof value.x === "number" && typeof value.y === "number";
}

export function isTimerMessageResponse(value: unknown): value is TimerMessageResponse {
  return isErrorResponse(value) || isTimerStatusResponse(value);
}

export function isGameMessageResponse(value: unknown): value is GameMessageResponse {
  return isErrorResponse(value) || isGameStatusResponse(value);
}

export function isExtensionRequestMessage(value: unknown): value is ExtensionRequestMessage {
  if (!isObjectRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type === START_TIMER_MESSAGE_TYPE) {
    return typeof value.durationSeconds === "number";
  }

  if (value.type === STOP_TIMER_MESSAGE_TYPE) {
    return true;
  }

  if (value.type === PAUSE_TIMER_MESSAGE_TYPE) {
    return true;
  }

  if (value.type === RESET_TIMER_MESSAGE_TYPE) {
    return typeof value.durationSeconds === "number";
  }

  if (value.type === GET_TIMER_STATE_MESSAGE_TYPE || value.type === GET_GAME_STATE_MESSAGE_TYPE) {
    return true;
  }

  if (value.type === SELECT_PROJECT_MESSAGE_TYPE) {
    return isProjectId(value.projectId);
  }

  if (value.type === CLAIM_ACTIVE_PROJECT_MESSAGE_TYPE) {
    return true;
  }

  if (value.type === RENAME_DUCK_MESSAGE_TYPE) {
    return typeof value.duckId === "string" && typeof value.name === "string";
  }

  if (value.type === FEED_DUCK_MESSAGE_TYPE) {
    return typeof value.duckId === "string" && isFeedDuckMode(value.feedMode);
  }

  if (value.type === PLACE_DUCK_MESSAGE_TYPE || value.type === MOVE_DUCK_MESSAGE_TYPE) {
    return typeof value.duckId === "string" && typeof value.x === "number" && typeof value.y === "number";
  }

  if (value.type === UPDATE_DUCK_SIMULATION_STATE_MESSAGE_TYPE) {
    return isDuckArray(value.ducks);
  }

  if (value.type === SAVE_HOMESTEAD_CAMERA_MESSAGE_TYPE) {
    return isHomesteadCameraState(value.homesteadCamera);
  }

  return false;
}

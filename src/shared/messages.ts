import type {
  Duck,
  DuckRewardItemId,
  DuckRewardsMessageResponse,
  DuckRewardsStatusResponse,
  ErrorResponse,
  TimerMessageResponse,
  TimerStatusResponse
} from "./types.js";

export const START_TIMER_MESSAGE_TYPE = "startTimer";
export const STOP_TIMER_MESSAGE_TYPE = "stopTimer";
export const PAUSE_TIMER_MESSAGE_TYPE = "pauseTimer";
export const RESET_TIMER_MESSAGE_TYPE = "resetTimer";
export const GET_TIMER_STATE_MESSAGE_TYPE = "getTimerState";
export const GET_DUCK_REWARDS_STATE_MESSAGE_TYPE = "getDuckRewardsState";
export const SELECT_DUCK_REWARD_ITEM_MESSAGE_TYPE = "selectDuckRewardItem";
export const CLAIM_SELECTED_DUCK_REWARD_MESSAGE_TYPE = "claimSelectedDuckReward";

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

export interface GetDuckRewardsStateMessage {
  type: typeof GET_DUCK_REWARDS_STATE_MESSAGE_TYPE;
}

export interface SelectDuckRewardItemMessage {
  type: typeof SELECT_DUCK_REWARD_ITEM_MESSAGE_TYPE;
  duckRewardItemId: DuckRewardItemId;
}

export interface ClaimSelectedDuckRewardMessage {
  type: typeof CLAIM_SELECTED_DUCK_REWARD_MESSAGE_TYPE;
}

export type TimerRequestMessage =
  | StartTimerMessage
  | StopTimerMessage
  | PauseTimerMessage
  | ResetTimerMessage
  | GetTimerStateMessage;

export type DuckRewardsRequestMessage =
  | GetDuckRewardsStateMessage
  | SelectDuckRewardItemMessage
  | ClaimSelectedDuckRewardMessage;

export type ExtensionRequestMessage = TimerRequestMessage | DuckRewardsRequestMessage;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  if (!isObjectRecord(value)) {
    return false;
  }

  return typeof value.error === "string";
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

function isDuckRewardItemId(value: unknown): value is DuckRewardItemId {
  return value === "duckEgg1" || value === "duckEgg2";
}

function isDuck(value: unknown): value is Duck {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    isDuckRewardItemId(value.sourceDuckRewardItemId) &&
    typeof value.hatchedAtTimestampMilliseconds === "number"
  );
}

function isDuckRewardsStatusResponse(value: unknown): value is DuckRewardsStatusResponse {
  if (!isObjectRecord(value)) {
    return false;
  }

  const duckRewardDefinitionsById = value.duckRewardDefinitionsById;
  if (!isObjectRecord(duckRewardDefinitionsById)) {
    return false;
  }

  const duckEggOneDefinition = duckRewardDefinitionsById.duckEgg1;
  const duckEggTwoDefinition = duckRewardDefinitionsById.duckEgg2;

  if (!isObjectRecord(duckEggOneDefinition) || !isObjectRecord(duckEggTwoDefinition)) {
    return false;
  }

  return (
    (value.selectedDuckRewardItemId === null || isDuckRewardItemId(value.selectedDuckRewardItemId)) &&
    typeof value.selectedDuckRewardItemProgressSeconds === "number" &&
    typeof value.isSelectedDuckRewardClaimAvailable === "boolean" &&
    Array.isArray(value.ducks) &&
    value.ducks.every((duck) => isDuck(duck)) &&
    typeof value.totalCompletedSessions === "number" &&
    typeof value.totalCompletedFocusSeconds === "number" &&
    typeof duckEggOneDefinition.displayName === "string" &&
    duckEggOneDefinition.rewardType === "duckEgg" &&
    typeof duckEggOneDefinition.requiredProgressSeconds === "number" &&
    typeof duckEggTwoDefinition.displayName === "string" &&
    duckEggTwoDefinition.rewardType === "duckEgg" &&
    typeof duckEggTwoDefinition.requiredProgressSeconds === "number"
  );
}

export function isTimerMessageResponse(value: unknown): value is TimerMessageResponse {
  return isErrorResponse(value) || isTimerStatusResponse(value);
}

export function isDuckRewardsMessageResponse(value: unknown): value is DuckRewardsMessageResponse {
  return isErrorResponse(value) || isDuckRewardsStatusResponse(value);
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

  if (value.type === GET_TIMER_STATE_MESSAGE_TYPE) {
    return true;
  }

  if (value.type === GET_DUCK_REWARDS_STATE_MESSAGE_TYPE) {
    return true;
  }

  if (value.type === SELECT_DUCK_REWARD_ITEM_MESSAGE_TYPE) {
    return isDuckRewardItemId(value.duckRewardItemId);
  }

  if (value.type === CLAIM_SELECTED_DUCK_REWARD_MESSAGE_TYPE) {
    return true;
  }

  return false;
}

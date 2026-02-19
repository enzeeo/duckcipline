import type { TimerErrorResponse, TimerMessageResponse, TimerStatusResponse } from "./types.js";

export const START_TIMER_MESSAGE_TYPE = "startTimer";
export const STOP_TIMER_MESSAGE_TYPE = "stopTimer";
export const PAUSE_TIMER_MESSAGE_TYPE = "pauseTimer";
export const RESET_TIMER_MESSAGE_TYPE = "resetTimer";
export const GET_TIMER_STATE_MESSAGE_TYPE = "getTimerState";

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

export type TimerRequestMessage =
  | StartTimerMessage
  | StopTimerMessage
  | PauseTimerMessage
  | ResetTimerMessage
  | GetTimerStateMessage;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTimerErrorResponse(value: unknown): value is TimerErrorResponse {
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
    typeof value.remainingSeconds === "number"
  );
}

export function isTimerMessageResponse(value: unknown): value is TimerMessageResponse {
  return isTimerErrorResponse(value) || isTimerStatusResponse(value);
}

export function isTimerRequestMessage(value: unknown): value is TimerRequestMessage {
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

  return false;
}

import type { TimerState } from "../shared/types.js";

export const DEFAULT_TIMER_DURATION_SECONDS = 25 * 60;

const MILLISECONDS_PER_SECOND = 1000;

export function createDefaultTimerState(): TimerState {
  return {
    isRunning: false,
    hasStartedAtLeastOnce: false,
    configuredDurationSeconds: DEFAULT_TIMER_DURATION_SECONDS,
    startedAtTimestampMilliseconds: null,
    remainingSecondsWhenNotRunning: DEFAULT_TIMER_DURATION_SECONDS
  };
}

export function isTimerState(value: unknown): value is TimerState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const possibleTimerState = value as Record<string, unknown>;
  const hasValidStartTimestamp =
    typeof possibleTimerState.startedAtTimestampMilliseconds === "number" ||
    possibleTimerState.startedAtTimestampMilliseconds === null;
  const hasValidStartHistory =
    typeof possibleTimerState.hasStartedAtLeastOnce === "boolean" ||
    typeof possibleTimerState.hasStartedAtLeastOnce === "undefined";

  return (
    typeof possibleTimerState.isRunning === "boolean" &&
    hasValidStartHistory &&
    typeof possibleTimerState.configuredDurationSeconds === "number" &&
    hasValidStartTimestamp &&
    typeof possibleTimerState.remainingSecondsWhenNotRunning === "number"
  );
}

export function parseTimerDurationSeconds(durationSecondsFromMessage: number): number {
  if (!Number.isFinite(durationSecondsFromMessage) || durationSecondsFromMessage < 1) {
    return DEFAULT_TIMER_DURATION_SECONDS;
  }

  return Math.floor(durationSecondsFromMessage);
}

export function calculateRemainingSecondsForRunningTimer(
  timerState: TimerState,
  nowTimestampMilliseconds: number
): number {
  if (!timerState.startedAtTimestampMilliseconds) {
    return timerState.configuredDurationSeconds;
  }

  const elapsedMilliseconds = nowTimestampMilliseconds - timerState.startedAtTimestampMilliseconds;
  const elapsedSeconds = Math.floor(elapsedMilliseconds / MILLISECONDS_PER_SECOND);
  return Math.max(0, timerState.configuredDurationSeconds - elapsedSeconds);
}

export function calculateStartedAtTimestampMillisecondsForResumedTimer(
  timerState: TimerState,
  nowTimestampMilliseconds: number
): number {
  const elapsedSecondsBeforePause =
    timerState.configuredDurationSeconds - timerState.remainingSecondsWhenNotRunning;
  const elapsedMillisecondsBeforePause = Math.max(0, elapsedSecondsBeforePause) * MILLISECONDS_PER_SECOND;

  return nowTimestampMilliseconds - elapsedMillisecondsBeforePause;
}

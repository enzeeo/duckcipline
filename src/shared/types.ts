export interface TimerState {
  isRunning: boolean;
  hasStartedAtLeastOnce: boolean;
  configuredDurationSeconds: number;
  startedAtTimestampMilliseconds: number | null;
  remainingSecondsWhenNotRunning: number;
}

export interface TimerStatusResponse {
  isRunning: boolean;
  hasStartedAtLeastOnce: boolean;
  remainingSeconds: number;
}

export interface TimerErrorResponse {
  error: string;
}

export type TimerMessageResponse = TimerStatusResponse | TimerErrorResponse;

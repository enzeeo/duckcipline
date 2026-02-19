export type DuckRewardItemId = "duckEgg1" | "duckEgg2";

export interface TimerState {
  isRunning: boolean;
  hasStartedAtLeastOnce: boolean;
  configuredDurationSeconds: number;
  startedAtTimestampMilliseconds: number | null;
  remainingSecondsWhenNotRunning: number;
}

export interface Duck {
  id: string;
  sourceDuckRewardItemId: DuckRewardItemId;
  hatchedAtTimestampMilliseconds: number;
}

export interface DuckRewardsState {
  selectedDuckRewardItemId: DuckRewardItemId | null;
  selectedDuckRewardItemProgressSeconds: number;
  ducks: Duck[];
  totalCompletedSessions: number;
  totalCompletedFocusSeconds: number;
}

export interface TimerStatusResponse {
  isRunning: boolean;
  hasStartedAtLeastOnce: boolean;
  remainingSeconds: number;
}

export interface DuckRewardsStatusResponse {
  selectedDuckRewardItemId: DuckRewardItemId | null;
  selectedDuckRewardItemProgressSeconds: number;
  ducks: Duck[];
  totalCompletedSessions: number;
  totalCompletedFocusSeconds: number;
  requiredSecondsByDuckRewardItemId: Record<DuckRewardItemId, number>;
}

export interface ErrorResponse {
  error: string;
}

export type TimerMessageResponse = TimerStatusResponse | ErrorResponse;
export type DuckRewardsMessageResponse = DuckRewardsStatusResponse | ErrorResponse;

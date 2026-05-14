import { describe, expect, it } from "vitest";
import {
  calculateRemainingSecondsForRunningTimer,
  calculateStartedAtTimestampMillisecondsForResumedTimer,
  createDefaultTimerState,
  parseTimerDurationSeconds
} from "./timerState.js";

describe("timerState", () => {
  it("parses invalid durations as the default duration", () => {
    expect(parseTimerDurationSeconds(0)).toBe(createDefaultTimerState().configuredDurationSeconds);
    expect(parseTimerDurationSeconds(Number.NaN)).toBe(createDefaultTimerState().configuredDurationSeconds);
  });

  it("floors valid timer durations", () => {
    expect(parseTimerDurationSeconds(90.9)).toBe(90);
  });

  it("calculates remaining seconds from the start timestamp", () => {
    const timerState = {
      ...createDefaultTimerState(),
      isRunning: true,
      configuredDurationSeconds: 60,
      startedAtTimestampMilliseconds: 1_000
    };

    expect(calculateRemainingSecondsForRunningTimer(timerState, 12_999)).toBe(49);
  });

  it("calculates resumed start timestamps from paused remaining seconds", () => {
    const timerState = {
      ...createDefaultTimerState(),
      configuredDurationSeconds: 60,
      remainingSecondsWhenNotRunning: 45
    };

    expect(calculateStartedAtTimestampMillisecondsForResumedTimer(timerState, 20_000)).toBe(5_000);
  });
});

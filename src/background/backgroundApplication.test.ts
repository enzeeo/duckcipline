import { describe, expect, it } from "vitest";
import { createDefaultGameState, selectActiveProject } from "../shared/gameLogic.js";
import type { GameState } from "../shared/types.js";
import { createBackgroundApplication } from "./backgroundApplication.js";
import { createMemoryStateStore } from "./stateStore.js";

function createTestClock(startTimestampMilliseconds: number) {
  let currentTimestampMilliseconds = startTimestampMilliseconds;

  return {
    now: () => currentTimestampMilliseconds,
    advanceBy(milliseconds: number): void {
      currentTimestampMilliseconds += milliseconds;
    }
  };
}

describe("backgroundApplication", () => {
  it("returns default timer state from empty memory storage", async () => {
    const clock = createTestClock(1_000);
    const application = createBackgroundApplication({
      clock,
      stateStore: createMemoryStateStore()
    });

    const response = await application.handleMessage({ type: "getTimerState" });

    expect(response).toMatchObject({
      isRunning: false,
      hasStartedAtLeastOnce: false,
      remainingSeconds: 1_500,
      configuredDurationSeconds: 1_500
    });
  });

  it("blocks starting focus without an active project", async () => {
    const clock = createTestClock(1_000);
    const application = createBackgroundApplication({
      clock,
      stateStore: createMemoryStateStore()
    });

    await expect(application.handleMessage({ type: "startTimer", durationSeconds: 60 })).resolves.toEqual({
      error: "Pick a project before starting focus."
    });
  });

  it("selects a project and starts a timer with persisted progress state", async () => {
    const clock = createTestClock(1_000);
    const stateStore = createMemoryStateStore();
    const application = createBackgroundApplication({ clock, stateStore });

    await application.handleMessage({ type: "selectProject", projectId: "smallSeedPatch" });
    await application.handleMessage({ type: "startTimer", durationSeconds: 60 });

    const timerState = await stateStore.readTimerState();
    const gameState = await stateStore.readGameState(clock.now());

    expect(timerState).toMatchObject({
      isRunning: true,
      startedAtTimestampMilliseconds: 1_000,
      configuredDurationSeconds: 60
    });
    expect(gameState.projectProgressById.smallSeedPatch?.progressStartedAtTimestampMilliseconds).toBe(1_000);
  });

  it("completes a running timer once and makes project progress claimable", async () => {
    const clock = createTestClock(1_000);
    const stateStore = createMemoryStateStore();
    const application = createBackgroundApplication({ clock, stateStore });

    await application.handleMessage({ type: "selectProject", projectId: "smallSeedPatch" });
    await application.handleMessage({ type: "startTimer", durationSeconds: 5 });
    clock.advanceBy(5_000);

    const timerResponse = await application.handleMessage({ type: "getTimerState" });
    const gameResponse = await application.handleMessage({ type: "getGameState" });

    expect(timerResponse).toMatchObject({
      isRunning: false,
      remainingSeconds: 0
    });
    expect("gameState" in gameResponse && gameResponse.gameState.totalCompletedSessions).toBe(1);
    expect("gameState" in gameResponse && gameResponse.gameState.projectProgressById.smallSeedPatch?.isReadyToClaim).toBe(true);

    await application.handleMessage({ type: "getTimerState" });
    const finalGameState = await stateStore.readGameState(clock.now());
    expect(finalGameState.totalCompletedSessions).toBe(1);
  });

  it("pauses and resumes using timestamp math", async () => {
    const clock = createTestClock(1_000);
    const stateStore = createMemoryStateStore();
    const application = createBackgroundApplication({ clock, stateStore });

    await application.handleMessage({ type: "selectProject", projectId: "gardenBed" });
    await application.handleMessage({ type: "startTimer", durationSeconds: 60 });
    clock.advanceBy(5_000);
    await application.handleMessage({ type: "pauseTimer" });
    clock.advanceBy(10_000);
    await application.handleMessage({ type: "startTimer", durationSeconds: 60 });

    const timerState = await stateStore.readTimerState();

    expect(timerState.remainingSecondsWhenNotRunning).toBe(55);
    expect(timerState.startedAtTimestampMilliseconds).toBe(11_000);
  });

  it("blocks new focus when the active project is ready to claim", async () => {
    const gameState: GameState = selectActiveProject(createDefaultGameState(), "smallSeedPatch");
    gameState.projectProgressById.smallSeedPatch = {
      projectId: "smallSeedPatch",
      progressSeconds: 5,
      isReadyToClaim: true,
      progressStartedAtTimestampMilliseconds: null
    };
    const clock = createTestClock(1_000);
    const application = createBackgroundApplication({
      clock,
      stateStore: createMemoryStateStore({ gameState })
    });

    await expect(application.handleMessage({ type: "startTimer", durationSeconds: 60 })).resolves.toEqual({
      error: "Claim or change the ready project before starting."
    });
  });

  it("claims a ready seed project", async () => {
    const gameState: GameState = selectActiveProject(createDefaultGameState(), "smallSeedPatch");
    gameState.projectProgressById.smallSeedPatch = {
      projectId: "smallSeedPatch",
      progressSeconds: 5,
      isReadyToClaim: true,
      progressStartedAtTimestampMilliseconds: null
    };
    const clock = createTestClock(1_000);
    const application = createBackgroundApplication({
      clock,
      stateStore: createMemoryStateStore({ gameState })
    });

    const response = await application.handleMessage({ type: "claimActiveProject" });

    expect("gameState" in response && response.gameState.seedCount).toBe(5);
    expect("gameState" in response && response.gameState.activeProjectId).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  claimActiveProject,
  createDefaultGameState,
  normalizeGameState,
  selectActiveProject,
  synchronizeGameProgressStateWithTimer,
  updateDuckSimulationState
} from "./gameLogic.js";
import type { Duck, GameState } from "./types.js";
import { createDefaultTimerState } from "../timer/timerState.js";

function createTestDuck(overrides: Partial<Duck> = {}): Duck {
  return {
    id: "duck-1",
    name: "Quill",
    variantId: "yellow",
    sourceEggProjectId: "meadowEgg",
    growthStage: "duckling",
    seedsFedForCurrentStage: 0,
    placementStatus: "placed",
    position: { x: 32, y: 32 },
    activity: "idle",
    favoriteActivity: "path patrol",
    hatchedAtTimestampMilliseconds: 1_000,
    lastUpdatedAtTimestampMilliseconds: 1_000,
    ...overrides
  };
}

describe("gameLogic", () => {
  it("normalizes corrupt game state to safe defaults", () => {
    const gameState = normalizeGameState({ seedCount: -10, ducks: [{ id: 123 }] }, 1_000);

    expect(gameState.seedCount).toBe(0);
    expect(gameState.ducks).toEqual([]);
    expect(gameState.activeProjectId).toBeNull();
  });

  it("synchronizes running timer progress into the active project", () => {
    const selectedGameState = selectActiveProject(createDefaultGameState(), "smallSeedPatch");
    const timerState = {
      ...createDefaultTimerState(),
      isRunning: true,
      configuredDurationSeconds: 60,
      startedAtTimestampMilliseconds: 1_000
    };

    const gameState = synchronizeGameProgressStateWithTimer(selectedGameState, timerState, 7_000);

    expect(gameState.projectProgressById.smallSeedPatch?.progressStartedAtTimestampMilliseconds).toBe(7_000);
  });

  it("applies only minimal simulation fields to existing placed ducks", () => {
    const gameState: GameState = {
      ...createDefaultGameState(),
      ducks: [createTestDuck()]
    };

    const updatedGameState = updateDuckSimulationState(gameState, [
      {
        duckId: "duck-1",
        position: { x: 96, y: 128 },
        activity: "wander",
        lastUpdatedAtTimestampMilliseconds: 2_000
      }
    ]);

    expect(updatedGameState.ducks[0]).toMatchObject({
      id: "duck-1",
      name: "Quill",
      position: { x: 96, y: 128 },
      activity: "wander",
      lastUpdatedAtTimestampMilliseconds: 2_000
    });
  });

  it("ignores simulation updates for unplaced ducks", () => {
    const gameState: GameState = {
      ...createDefaultGameState(),
      ducks: [createTestDuck({ placementStatus: "unplaced", position: null })]
    };

    const updatedGameState = updateDuckSimulationState(gameState, [
      {
        duckId: "duck-1",
        position: { x: 96, y: 128 },
        activity: "wander",
        lastUpdatedAtTimestampMilliseconds: 2_000
      }
    ]);

    expect(updatedGameState.ducks[0].position).toBeNull();
  });

  it("claims egg projects with injected random and id dependencies", () => {
    const selectedGameState = selectActiveProject(createDefaultGameState(), "meadowEgg");
    selectedGameState.projectProgressById.meadowEgg = {
      projectId: "meadowEgg",
      progressSeconds: 10,
      isReadyToClaim: true,
      progressStartedAtTimestampMilliseconds: null
    };

    const result = claimActiveProject(selectedGameState, 2_000, {
      random: () => 0,
      createId: () => "duck-fixed"
    });

    expect(result.gameState.ducks[0]).toMatchObject({
      id: "duck-fixed",
      variantId: "yellow",
      hatchedAtTimestampMilliseconds: 2_000
    });
  });
});

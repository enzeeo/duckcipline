import { describe, expect, it } from "vitest";
import {
  claimActiveProject,
  createDefaultGameState,
  normalizeGameState,
  selectActiveProject,
  synchronizeGameProgressStateWithTimer,
  updateDuckPlacement,
  feedDuck,
  renameDuck,
  updateDuckSimulationState
} from "./gameLogic.js";
import { DUCK_EATING_ANIMATION_DURATION_MILLISECONDS } from "./duckAnimation.js";
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
    homePosition: { x: 32, y: 32 },
    activity: "idle",
    facingDirection: "right",
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

  it("normalizes legacy placed duck home, facing, and camera zoom", () => {
    const gameState = normalizeGameState({
      homesteadCamera: { x: 12, y: 24 },
      ducks: [
        {
          id: "duck-1",
          placementStatus: "placed",
          position: { x: 64, y: 96 }
        }
      ]
    }, 1_000);

    expect(gameState.homesteadCamera).toEqual({ x: 12, y: 24, zoom: 1 });
    expect(gameState.lastHomesteadSimulationTimestampMilliseconds).toBe(1_000);
    expect(gameState.ducks[0]).toMatchObject({
      homePosition: { x: 64, y: 96 },
      facingDirection: "right"
    });
  });

  it("normalizes stored duck names to remove numbers and avoid duplicates", () => {
    const gameState = normalizeGameState({
      ducks: [
        { id: "duck-1", name: "Quill1" },
        { id: "duck-2", name: "Quill" }
      ]
    }, 1_000);
    const duckNames = gameState.ducks.map((duck) => duck.name);

    expect(duckNames.every((duckName) => !/\d/.test(duckName))).toBe(true);
    expect(new Set(duckNames.map((duckName) => duckName.toLowerCase())).size).toBe(duckNames.length);
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

    const updatedGameState = updateDuckSimulationState(
      gameState,
      [
        {
          duckId: "duck-1",
          position: { x: 96, y: 128 },
          activity: "wander",
          facingDirection: "left",
          lastUpdatedAtTimestampMilliseconds: 2_000
        }
      ],
      3_000
    );

    expect(updatedGameState.ducks[0]).toMatchObject({
      id: "duck-1",
      name: "Quill",
      position: { x: 96, y: 128 },
      activity: "wander",
      facingDirection: "left",
      lastUpdatedAtTimestampMilliseconds: 2_000
    });
    expect(updatedGameState.lastHomesteadSimulationTimestampMilliseconds).toBe(3_000);
  });

  it("ignores simulation updates for unplaced ducks", () => {
    const gameState: GameState = {
      ...createDefaultGameState(),
      ducks: [createTestDuck({ placementStatus: "unplaced", position: null })]
    };

    const updatedGameState = updateDuckSimulationState(
      gameState,
      [
        {
          duckId: "duck-1",
          position: { x: 96, y: 128 },
          activity: "wander",
          facingDirection: "right",
          lastUpdatedAtTimestampMilliseconds: 2_000
        }
      ],
      3_000
    );

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
      name: "Puddle",
      variantId: "yellow",
      homePosition: null,
      facingDirection: "right",
      hatchedAtTimestampMilliseconds: 2_000
    });
  });

  it("claims egg projects with unique number-free duck names", () => {
    const selectedGameState = selectActiveProject(createDefaultGameState(), "meadowEgg");
    selectedGameState.ducks = [createTestDuck({ id: "duck-existing", name: "Puddle" })];
    selectedGameState.projectProgressById.meadowEgg = {
      projectId: "meadowEgg",
      progressSeconds: 10,
      isReadyToClaim: true,
      progressStartedAtTimestampMilliseconds: null
    };

    const result = claimActiveProject(selectedGameState, 2_000, {
      random: () => 0,
      createId: () => "duck-new"
    });
    const duckNames = result.gameState.ducks.map((duck) => duck.name);

    expect(duckNames).toContain("Puddle");
    expect(result.gameState.ducks[1].name).not.toBe("Puddle");
    expect(result.gameState.ducks[1].name).not.toMatch(/\d/);
    expect(new Set(duckNames.map((duckName) => duckName.toLowerCase())).size).toBe(duckNames.length);
  });

  it("sets placement position as duck home", () => {
    const gameState: GameState = {
      ...createDefaultGameState(),
      ducks: [createTestDuck({ placementStatus: "unplaced", position: null, homePosition: null })]
    };

    const result = updateDuckPlacement(gameState, "duck-1", { x: 160, y: 192 }, 2_000);

    expect(result.gameState.ducks[0]).toMatchObject({
      placementStatus: "placed",
      position: { x: 160, y: 192 },
      homePosition: { x: 160, y: 192 }
    });
  });

  it("starts eating when a non-swimming duck is fed", () => {
    const gameState: GameState = {
      ...createDefaultGameState(),
      seedCount: 2,
      ducks: [createTestDuck({ activity: "idle", lastUpdatedAtTimestampMilliseconds: 1_000 })]
    };

    const result = feedDuck(gameState, "duck-1", "single", 2_000);

    expect(result.gameState.ducks[0]).toMatchObject({
      activity: "eat",
      lastUpdatedAtTimestampMilliseconds: 2_000
    });
  });

  it("keeps swimming when a swimming duck is fed", () => {
    const gameState: GameState = {
      ...createDefaultGameState(),
      seedCount: 2,
      ducks: [createTestDuck({ activity: "swim", lastUpdatedAtTimestampMilliseconds: 1_000 })]
    };

    const result = feedDuck(gameState, "duck-1", "single", 2_000);

    expect(result.gameState.ducks[0]).toMatchObject({
      activity: "swim",
      lastUpdatedAtTimestampMilliseconds: 1_000,
      seedsFedForCurrentStage: 1
    });
  });

  it("keeps repeated single-seed feeds in the same eating animation window", () => {
    const gameState: GameState = {
      ...createDefaultGameState(),
      seedCount: 2,
      ducks: [createTestDuck({ activity: "eat", lastUpdatedAtTimestampMilliseconds: 1_000 })]
    };

    const result = feedDuck(gameState, "duck-1", "single", 1_000 + DUCK_EATING_ANIMATION_DURATION_MILLISECONDS - 1);

    expect(result.gameState.ducks[0]).toMatchObject({
      activity: "eat",
      lastUpdatedAtTimestampMilliseconds: 1_000
    });
  });

  it("starts a new eating animation after the previous cycle ends", () => {
    const gameState: GameState = {
      ...createDefaultGameState(),
      seedCount: 2,
      ducks: [createTestDuck({ activity: "eat", lastUpdatedAtTimestampMilliseconds: 1_000 })]
    };
    const nextTimestampMilliseconds = 1_000 + DUCK_EATING_ANIMATION_DURATION_MILLISECONDS;

    const result = feedDuck(gameState, "duck-1", "single", nextTimestampMilliseconds);

    expect(result.gameState.ducks[0].lastUpdatedAtTimestampMilliseconds).toBe(nextTimestampMilliseconds);
  });

  it("rejects duplicate duck renames", () => {
    const gameState: GameState = {
      ...createDefaultGameState(),
      ducks: [
        createTestDuck({ id: "duck-1", name: "Quill" }),
        createTestDuck({ id: "duck-2", name: "River" })
      ]
    };

    const result = renameDuck(gameState, "duck-2", "quill");

    expect(result.statusMessage).toBe("Duck name already exists.");
    expect(result.gameState.ducks.map((duck) => duck.name)).toEqual(["Quill", "River"]);
  });

  it("removes numbers from duck renames", () => {
    const gameState: GameState = {
      ...createDefaultGameState(),
      ducks: [createTestDuck({ id: "duck-1", name: "Quill" })]
    };

    const result = renameDuck(gameState, "duck-1", "River2");

    expect(result.statusMessage).toBe("Duck renamed.");
    expect(result.gameState.ducks[0].name).toBe("River");
  });
});

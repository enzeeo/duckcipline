// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultGameState } from "../shared/gameLogic.js";
import { createProjectDefinitionResponses } from "../shared/projectDefinitions.js";
import type { GameStatusResponse, ProjectId, TimerStatusResponse } from "../shared/types.js";
import { FocusSessionView } from "./focusSessionView.js";
import type { PopupRuntimeClient } from "./popupRuntimeClient.js";

function installFocusDom(): void {
  document.body.innerHTML = `
    <p id="timerDisplay"></p>
    <p id="timerStateText"></p>
    <div id="timerProgressBar"></div>
    <section id="activeRewardStage"></section>
    <img id="rewardNestImage" />
    <img id="activeRewardImage" />
    <p id="activeRewardNameText"></p>
    <p id="activeRewardPromptText"></p>
    <div id="projectProgressBar"></div>
    <button id="startButton"></button>
    <button id="pauseButton"></button>
    <button id="resetButton"></button>
    <input id="durationHoursInput" />
    <input id="durationMinutesInput" />
    <input id="durationSecondsInput" />
    <button id="clearDurationButton"></button>
    <p id="activeProjectText"></p>
    <p id="projectProgressText"></p>
    <button id="claimProjectButton"></button>
    <div id="eggProjectList"></div>
    <div id="seedProjectList"></div>
    <p id="duckCapacityText"></p>
    <p id="sessionStatsText"></p>
  `;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (element === null) {
    throw new Error(`Missing test element: ${id}`);
  }

  return element as T;
}

function createGameResponse(activeProjectId: ProjectId | null = "meadowEgg"): GameStatusResponse {
  const gameState = createDefaultGameState();
  gameState.activeProjectId = activeProjectId;
  if (activeProjectId !== null) {
    gameState.projectProgressById[activeProjectId] = {
      projectId: activeProjectId,
      progressSeconds: 30,
      isReadyToClaim: false,
      progressStartedAtTimestampMilliseconds: null
    };
  }

  return {
    gameState,
    projectDefinitions: createProjectDefinitionResponses(),
    maxDuckCount: 20,
    nowTimestampMilliseconds: 2_000,
    statusMessage: null
  };
}

function createTimerResponse(overrides: Partial<TimerStatusResponse> = {}): TimerStatusResponse {
  return {
    isRunning: false,
    hasStartedAtLeastOnce: false,
    remainingSeconds: 1_500,
    configuredDurationSeconds: 1_500,
    ...overrides
  };
}

function createView(runtimeClient: Partial<PopupRuntimeClient> = {}): FocusSessionView {
  return new FocusSessionView({
    runtimeClient: runtimeClient as PopupRuntimeClient,
    showStatus: vi.fn(),
    onTimerResponse: vi.fn(async () => {}),
    onGameResponse: vi.fn(async () => {}),
    refreshTimerDisplay: vi.fn(async () => {}),
    refreshGameDisplay: vi.fn(async () => {})
  });
}

describe("FocusSessionView", () => {
  beforeEach(() => {
    installFocusDom();
  });

  it("parses, clamps, pads, clears, and moves between duration inputs", () => {
    const view = createView();
    view.bindEvents();
    const hoursInput = getElement<HTMLInputElement>("durationHoursInput");
    const minutesInput = getElement<HTMLInputElement>("durationMinutesInput");
    const secondsInput = getElement<HTMLInputElement>("durationSecondsInput");

    hoursInput.value = "12x";
    hoursInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(hoursInput.value).toBe("12");
    expect(document.activeElement).toBe(minutesInput);

    minutesInput.value = "99";
    minutesInput.dispatchEvent(new Event("blur", { bubbles: true }));
    expect(minutesInput.value).toBe("59");

    secondsInput.value = "7";
    secondsInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    secondsInput.dispatchEvent(new Event("blur", { bubbles: true }));
    expect(secondsInput.value).toBe("07");

    getElement<HTMLButtonElement>("clearDurationButton").click();
    expect(hoursInput.value).toBe("00");
    expect(minutesInput.value).toBe("00");
    expect(secondsInput.value).toBe("00");
    expect(view.getSelectedDurationSeconds()).toBe(0);
  });

  it("renders start, pause, reset, and claim disabled states", () => {
    const view = createView();
    view.renderGame(createGameResponse("meadowEgg"));
    view.renderTimer(createTimerResponse({ isRunning: true, hasStartedAtLeastOnce: true, remainingSeconds: 100 }));
    view.updateActionButtons();

    expect(getElement<HTMLButtonElement>("startButton").disabled).toBe(true);
    expect(getElement<HTMLButtonElement>("pauseButton").disabled).toBe(false);
    expect(getElement<HTMLButtonElement>("resetButton").disabled).toBe(false);
    expect(getElement<HTMLButtonElement>("claimProjectButton").disabled).toBe(true);

    view.renderTimer(createTimerResponse({ isRunning: false, hasStartedAtLeastOnce: true, remainingSeconds: 100 }));
    view.updateActionButtons();
    expect(getElement<HTMLButtonElement>("startButton").textContent).toBe("Resume");
    expect(getElement<HTMLButtonElement>("pauseButton").disabled).toBe(true);
  });

  it("renders project picker disabled and selected states", () => {
    const gameResponse = createGameResponse("meadowEgg");
    gameResponse.gameState.ducks = Array.from({ length: 20 }, (_value, i) => ({
      id: `duck-${i}`,
      name: "Duck",
      variantId: "yellow",
      sourceEggProjectId: "meadowEgg",
      growthStage: "duckling",
      seedsFedForCurrentStage: 0,
      placementStatus: "unplaced",
      position: null,
      homePosition: null,
      activity: "idle",
      facingDirection: "right",
      favoriteActivity: "wandering",
      hatchedAtTimestampMilliseconds: 1_000,
      lastUpdatedAtTimestampMilliseconds: 1_000
    }));
    const view = createView();
    view.renderGame(gameResponse);

    const eggButtons = Array.from(getElement<HTMLDivElement>("eggProjectList").querySelectorAll("button"));
    const seedButtons = Array.from(getElement<HTMLDivElement>("seedProjectList").querySelectorAll("button"));

    expect(eggButtons[0].classList.contains("is-selected")).toBe(true);
    expect(eggButtons.every((button) => button.disabled)).toBe(true);
    expect(seedButtons.every((button) => button.disabled)).toBe(false);
  });

  it("renders egg reward in the nest and project progress", () => {
    const view = createView();
    view.renderGame(createGameResponse("meadowEgg"));

    expect(getElement<HTMLImageElement>("rewardNestImage").hidden).toBe(false);
    expect(getElement<HTMLElement>("activeRewardStage").classList.contains("is-egg-reward")).toBe(true);
    expect(getElement<HTMLImageElement>("activeRewardImage").hidden).toBe(false);
    expect(getElement<HTMLParagraphElement>("activeRewardNameText").textContent).toBe("Meadow Egg");
    expect(getElement<HTMLParagraphElement>("projectProgressText").textContent).toBe("10 / 10 seconds");
    expect(getElement<HTMLDivElement>("projectProgressBar").style.width).not.toBe("0%");
  });

  it("hides the nest for seed rewards", () => {
    const view = createView();
    view.renderGame(createGameResponse("smallSeedPatch"));

    expect(getElement<HTMLImageElement>("rewardNestImage").hidden).toBe(true);
    expect(getElement<HTMLElement>("activeRewardStage").classList.contains("is-seed-reward")).toBe(true);
    expect(getElement<HTMLImageElement>("activeRewardImage").hidden).toBe(false);
    expect(getElement<HTMLParagraphElement>("activeRewardNameText").textContent).toBe("Small Seed Patch");
  });

  it("renders empty reward state with the nest", () => {
    const view = createView();

    view.renderGame(createGameResponse(null));
    expect(getElement<HTMLImageElement>("rewardNestImage").hidden).toBe(false);
    expect(getElement<HTMLImageElement>("activeRewardImage").hidden).toBe(true);
    expect(getElement<HTMLParagraphElement>("activeRewardNameText").textContent).toBe("Pick a project");
  });
});

// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultGameState } from "../shared/gameLogic.js";
import { getCenteredTileWorldPosition } from "../shared/homesteadMap.js";
import type { Duck, GameMessageResponse, GameStatusResponse } from "../shared/types.js";
import { HomesteadView } from "./homesteadView.js";
import type { PopupRuntimeClient } from "./popupRuntimeClient.js";

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function installHomesteadDom(): void {
  document.body.innerHTML = `
    <section id="homesteadTab">
      <div id="homesteadFrame"><canvas id="homesteadCanvas" width="320" height="320"></canvas></div>
      <p id="placementHintText"></p>
      <div id="unplacedDuckTray"></div>
      <p id="duckDetailsEmptyText"></p>
      <div id="duckDetailsContent" hidden>
        <input id="selectedDuckNameText" />
        <p id="selectedDuckStageText"></p>
        <p id="selectedDuckMetaText"></p>
        <button id="feedOneSeedButton"></button>
        <button id="feedToNextStageButton"></button>
        <button id="followDuckButton"></button>
      </div>
    </section>
  `;
  Object.defineProperty(getElement<HTMLDivElement>("homesteadFrame"), "getBoundingClientRect", {
    value: () => ({ width: 360, height: 360, left: 0, top: 0, right: 360, bottom: 360 })
  });
  Object.defineProperty(getElement<HTMLCanvasElement>("homesteadCanvas"), "getBoundingClientRect", {
    value: () => ({ width: 320, height: 320, left: 0, top: 0, right: 320, bottom: 320 })
  });
}

function installBrowserStubs(): void {
  globalThis.ResizeObserver = TestResizeObserver;
  window.requestAnimationFrame = vi.fn(() => 1);
  window.cancelAnimationFrame = vi.fn();
  HTMLElement.prototype.setPointerCapture = vi.fn();
  if (!globalThis.CSS) {
    globalThis.CSS = {} as typeof CSS;
  }
  globalThis.CSS.escape = (value: string) => value;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (element === null) {
    throw new Error(`Missing test element: ${id}`);
  }

  return element as T;
}

function createDuck(overrides: Partial<Duck> = {}): Duck {
  return {
    id: "duck-1",
    name: "Quill",
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
    lastUpdatedAtTimestampMilliseconds: 1_000,
    ...overrides
  };
}

function createGameResponse(ducks: Duck[] = [createDuck()]): GameStatusResponse {
  const gameState = createDefaultGameState();
  gameState.ducks = ducks;
  gameState.seedCount = 4;

  return {
    gameState,
    projectDefinitions: [],
    maxDuckCount: 20,
    nowTimestampMilliseconds: 3_000,
    statusMessage: null
  };
}

function createPointerEvent(type: string, x: number, y: number): PointerEvent {
  return new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button: 0
  }) as PointerEvent;
}

describe("HomesteadView", () => {
  beforeEach(() => {
    installBrowserStubs();
    installHomesteadDom();
  });

  it("renders unplaced duck tray and selected duck details", async () => {
    const view = new HomesteadView({
      runtimeClient: {} as PopupRuntimeClient,
      showStatus: vi.fn(),
      onGameResponse: vi.fn(async () => {}),
      isHomesteadActive: () => true
    });
    view.bindEvents();

    const placedDuck = createDuck({
      id: "duck-2",
      name: "Pebble",
      placementStatus: "placed",
      position: getCenteredTileWorldPosition(2, 1),
      homePosition: getCenteredTileWorldPosition(2, 1)
    });
    await view.syncGameResponse(createGameResponse([createDuck(), placedDuck]));
    view.renderGame();
    expect(getElement<HTMLDivElement>("unplacedDuckTray").querySelector(".duck-thumbnail")).not.toBeNull();
    expect(getElement<HTMLParagraphElement>("duckDetailsEmptyText").hidden).toBe(false);

    const validPosition = getCenteredTileWorldPosition(2, 1);
    getElement<HTMLCanvasElement>("homesteadCanvas").dispatchEvent(createPointerEvent("pointerdown", validPosition.x, validPosition.y));
    view.renderGame();
    expect(getElement<HTMLDivElement>("duckDetailsContent").hidden).toBe(false);
    expect(getElement<HTMLInputElement>("selectedDuckNameText").value).toBe("Pebble");
    expect(getElement<HTMLParagraphElement>("selectedDuckMetaText").textContent).toContain("yellow");
  });

  it("wires placement, rename, feed, follow, and homestead state save", async () => {
    const placedDuck = createDuck({
      placementStatus: "placed",
      position: getCenteredTileWorldPosition(2, 1),
      homePosition: getCenteredTileWorldPosition(2, 1)
    });
    const placedGameResponse = createGameResponse([placedDuck]);
    const runtimeClient = {
      placeDuck: vi.fn(async () => placedGameResponse),
      renameDuck: vi.fn(async () => placedGameResponse),
      feedDuck: vi.fn(async () => placedGameResponse),
      saveHomesteadState: vi.fn(async () => placedGameResponse)
    };
    let view: HomesteadView;
    const onGameResponse = vi.fn(async (gameResponse: GameMessageResponse) => {
      if (!("error" in gameResponse)) {
        await view.syncGameResponse(gameResponse);
      }
    });
    view = new HomesteadView({
      runtimeClient: runtimeClient as unknown as PopupRuntimeClient,
      showStatus: vi.fn(),
      onGameResponse,
      isHomesteadActive: () => true
    });
    view.bindEvents();

    await view.syncGameResponse(createGameResponse());
    view.renderGame();
    getElement<HTMLButtonElement>("unplacedDuckTray").querySelector<HTMLButtonElement>(".duck-thumbnail")?.click();
    const validPosition = getCenteredTileWorldPosition(2, 1);
    getElement<HTMLCanvasElement>("homesteadCanvas").dispatchEvent(createPointerEvent("pointerdown", validPosition.x, validPosition.y));
    getElement<HTMLCanvasElement>("homesteadCanvas").dispatchEvent(createPointerEvent("pointerup", validPosition.x, validPosition.y));
    await Promise.resolve();
    await view.syncGameResponse(placedGameResponse);
    getElement<HTMLCanvasElement>("homesteadCanvas").dispatchEvent(createPointerEvent("pointerdown", validPosition.x, validPosition.y));
    view.renderGame();

    expect(runtimeClient.placeDuck).toHaveBeenCalledWith("duck-1", validPosition);

    getElement<HTMLInputElement>("selectedDuckNameText").value = "River";
    getElement<HTMLInputElement>("selectedDuckNameText").dispatchEvent(new Event("blur"));
    getElement<HTMLButtonElement>("feedOneSeedButton").click();
    getElement<HTMLButtonElement>("followDuckButton").click();
    await Promise.resolve();
    view.renderGame();
    await view.saveHomesteadState();
    await Promise.resolve();

    expect(runtimeClient.renameDuck).toHaveBeenCalledWith("duck-1", "River");
    expect(runtimeClient.feedDuck).toHaveBeenCalledWith("duck-1", "single");
    expect(getElement<HTMLButtonElement>("followDuckButton")).toBeInstanceOf(HTMLButtonElement);
    expect(runtimeClient.saveHomesteadState).toHaveBeenCalledTimes(1);
    expect(runtimeClient.saveHomesteadState).toHaveBeenCalledWith(
      expect.objectContaining({
        camera: expect.any(Object),
        duckSimulationUpdates: expect.any(Array)
      })
    );
  });
});

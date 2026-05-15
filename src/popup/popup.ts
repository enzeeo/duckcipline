import type { GameMessageResponse, GameStatusResponse, TimerMessageResponse } from "../shared/types.js";
import { createAssetUrl, loadPixelSprites } from "./assetLoader.js";
import { FocusSessionView } from "./focusSessionView.js";
import { HomesteadView } from "./homesteadView.js";
import { PopupRuntimeClient } from "./popupRuntimeClient.js";

const UPDATE_INTERVAL_MILLISECONDS = 1000;

type ActiveTab = "focus" | "homestead";

function getRequiredElement<T extends HTMLElement>(elementId: string, constructor: { new (): T }): T {
  const element = document.getElementById(elementId);

  if (!(element instanceof constructor)) {
    throw new Error(`Required element not found: ${elementId}`);
  }

  return element;
}

const statusMessageElement = getRequiredElement("statusMessage", HTMLParagraphElement);
const headerLogoImageElement = getRequiredElement("headerLogoImage", HTMLImageElement);
const seedCountTextElement = getRequiredElement("seedCountText", HTMLParagraphElement);
const focusTabButtonElement = getRequiredElement("focusTabButton", HTMLButtonElement);
const homesteadTabButtonElement = getRequiredElement("homesteadTabButton", HTMLButtonElement);
const focusTabElement = getRequiredElement("focusTab", HTMLElement);
const homesteadTabElement = getRequiredElement("homesteadTab", HTMLElement);

let activeTab: ActiveTab = "focus";

const runtimeClient = new PopupRuntimeClient(chrome.runtime);

function showStatus(message: string | null, isError: boolean = false): void {
  if (message !== null) {
    statusMessageElement.textContent = message;
  }

  statusMessageElement.classList.toggle("is-error", isError);
}

async function updateTimerDisplay(timerResponse: TimerMessageResponse): Promise<void> {
  focusSessionView.renderTimer(timerResponse);
  focusSessionView.updateActionButtons();
}

async function updateGameDisplay(gameResponse: GameMessageResponse): Promise<void> {
  if ("error" in gameResponse) {
    showStatus(gameResponse.error, true);
    return;
  }

  const gameResponseForDisplay = await homesteadView.syncGameResponse(gameResponse);

  if (gameResponseForDisplay.statusMessage !== null) {
    showStatus(gameResponseForDisplay.statusMessage);
  } else if (gameResponseForDisplay.gameState.activeProjectId === null) {
    showStatus("Pick a project to begin.");
  }

  seedCountTextElement.textContent = `${gameResponseForDisplay.gameState.seedCount} seeds`;
  focusSessionView.renderGame(gameResponseForDisplay);
  homesteadView.renderGame();
}

async function refreshTimerDisplay(): Promise<void> {
  await updateTimerDisplay(await runtimeClient.getTimerState());
}

async function refreshGameDisplay(): Promise<void> {
  await updateGameDisplay(await runtimeClient.getGameState());
}

async function refreshAllDisplays(): Promise<void> {
  await refreshTimerDisplay();
  await refreshGameDisplay();
}

async function catchUpHomesteadAfterAway(): Promise<void> {
  await refreshGameDisplay();

  if (activeTab !== "homestead") {
    return;
  }

  await homesteadView.activate();
}

function setActiveTab(nextActiveTab: ActiveTab): void {
  activeTab = nextActiveTab;
  const isFocusActive = nextActiveTab === "focus";
  focusTabElement.hidden = !isFocusActive;
  homesteadTabElement.hidden = isFocusActive;
  focusTabButtonElement.classList.toggle("is-selected", isFocusActive);
  homesteadTabButtonElement.classList.toggle("is-selected", !isFocusActive);
  focusTabButtonElement.setAttribute("aria-selected", String(isFocusActive));
  homesteadTabButtonElement.setAttribute("aria-selected", String(!isFocusActive));

  if (nextActiveTab === "homestead") {
    catchUpHomesteadAfterAway().catch(() => {
      showStatus("Homestead unavailable.", true);
    });
  } else {
    homesteadView.deactivate().catch(() => {});
  }
}

const focusSessionView = new FocusSessionView({
  runtimeClient,
  showStatus,
  onTimerResponse: updateTimerDisplay,
  onGameResponse: updateGameDisplay,
  refreshTimerDisplay,
  refreshGameDisplay
});
const homesteadView = new HomesteadView({
  runtimeClient,
  showStatus,
  onGameResponse: updateGameDisplay,
  isHomesteadActive: () => activeTab === "homestead"
});

headerLogoImageElement.src = createAssetUrl("src/assets/pixel/ui/duck-footprint.png");
focusSessionView.bindEvents();
homesteadView.bindEvents();

focusTabButtonElement.addEventListener("click", () => {
  setActiveTab("focus");
});

homesteadTabButtonElement.addEventListener("click", () => {
  setActiveTab("homestead");
});

loadPixelSprites()
  .then((loadedSpriteMap) => {
    homesteadView.setSpriteMap(loadedSpriteMap);
  })
  .catch(() => {
    homesteadView.setSpriteMap({});
  });

refreshAllDisplays().catch(() => {
  showStatus("State unavailable.", true);
});

setInterval(() => {
  refreshAllDisplays().catch(() => {
    showStatus("State unavailable.", true);
  });
}, UPDATE_INTERVAL_MILLISECONDS);

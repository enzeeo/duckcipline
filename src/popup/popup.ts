import { DUCK_GROWTH_SEED_REQUIREMENTS } from "../shared/balance.js";
import { getActivityLabel } from "../shared/duckDefinitions.js";
import { HOMESTEAD_FRAME_GUTTER } from "../shared/homesteadMap.js";
import {
  CLAIM_ACTIVE_PROJECT_MESSAGE_TYPE,
  FEED_DUCK_MESSAGE_TYPE,
  GET_GAME_STATE_MESSAGE_TYPE,
  GET_TIMER_STATE_MESSAGE_TYPE,
  PAUSE_TIMER_MESSAGE_TYPE,
  PLACE_DUCK_MESSAGE_TYPE,
  RENAME_DUCK_MESSAGE_TYPE,
  RESET_TIMER_MESSAGE_TYPE,
  SAVE_HOMESTEAD_CAMERA_MESSAGE_TYPE,
  SELECT_PROJECT_MESSAGE_TYPE,
  START_TIMER_MESSAGE_TYPE,
  UPDATE_DUCK_SIMULATION_STATE_MESSAGE_TYPE,
  isGameMessageResponse,
  isTimerMessageResponse,
  type ClaimActiveProjectMessage,
  type FeedDuckMessage,
  type GameRequestMessage,
  type GetGameStateMessage,
  type GetTimerStateMessage,
  type PauseTimerMessage,
  type PlaceDuckMessage,
  type RenameDuckMessage,
  type ResetTimerMessage,
  type SaveHomesteadCameraMessage,
  type SelectProjectMessage,
  type StartTimerMessage,
  type TimerRequestMessage,
  type UpdateDuckSimulationStateMessage
} from "../shared/messages.js";
import type {
  Duck,
  DuckPosition,
  FeedDuckMode,
  GameMessageResponse,
  GameStatusResponse,
  ProjectDefinitionResponse,
  ProjectId,
  TimerMessageResponse,
  TimerStatusResponse
} from "../shared/types.js";
import { createAssetUrl, loadPixelSprites, type SpriteMap } from "./assetLoader.js";
import { renderHomesteadCanvas } from "./canvasRenderer.js";
import { createHomesteadInteraction, type HomesteadCanvasMetrics } from "./homesteadInteraction.js";
import { getFocusRewardArt } from "./rewardArt.js";

const UPDATE_INTERVAL_MILLISECONDS = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const PRESET_TWENTY_FIVE_MINUTES = 25;
const PRESET_FIFTY_MINUTES = 50;
const DEFAULT_CUSTOM_DURATION_MINUTES = PRESET_TWENTY_FIVE_MINUTES;

type DurationSelectionMode = "twentyFive" | "fifty" | "custom";
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
const timerDisplayElement = getRequiredElement("timerDisplay", HTMLParagraphElement);
const timerStateTextElement = getRequiredElement("timerStateText", HTMLParagraphElement);
const timerProgressBarElement = getRequiredElement("timerProgressBar", HTMLDivElement);
const activeRewardStageElement = getRequiredElement("activeRewardStage", HTMLElement);
const activeRewardImageElement = getRequiredElement("activeRewardImage", HTMLImageElement);
const activeRewardNameTextElement = getRequiredElement("activeRewardNameText", HTMLParagraphElement);
const activeRewardPromptTextElement = getRequiredElement("activeRewardPromptText", HTMLParagraphElement);
const projectProgressBarElement = getRequiredElement("projectProgressBar", HTMLDivElement);
const startButtonElement = getRequiredElement("startButton", HTMLButtonElement);
const pauseButtonElement = getRequiredElement("pauseButton", HTMLButtonElement);
const resetButtonElement = getRequiredElement("resetButton", HTMLButtonElement);
const presetTwentyFiveMinutesButtonElement = getRequiredElement("presetTwentyFiveMinutesButton", HTMLButtonElement);
const presetFiftyMinutesButtonElement = getRequiredElement("presetFiftyMinutesButton", HTMLButtonElement);
const presetCustomDurationButtonElement = getRequiredElement("presetCustomDurationButton", HTMLButtonElement);
const durationMinutesInputElement = getRequiredElement("durationMinutesInput", HTMLInputElement);
const changeProjectButtonElement = getRequiredElement("changeProjectButton", HTMLButtonElement);
const activeProjectTextElement = getRequiredElement("activeProjectText", HTMLParagraphElement);
const projectProgressTextElement = getRequiredElement("projectProgressText", HTMLParagraphElement);
const claimProjectButtonElement = getRequiredElement("claimProjectButton", HTMLButtonElement);
const projectPickerElement = getRequiredElement("projectPicker", HTMLElement);
const eggProjectListElement = getRequiredElement("eggProjectList", HTMLDivElement);
const seedProjectListElement = getRequiredElement("seedProjectList", HTMLDivElement);
const duckCapacityTextElement = getRequiredElement("duckCapacityText", HTMLParagraphElement);
const sessionStatsTextElement = getRequiredElement("sessionStatsText", HTMLParagraphElement);
const homesteadFrameElement = getRequiredElement("homesteadFrame", HTMLDivElement);
const homesteadCanvasElement = getRequiredElement("homesteadCanvas", HTMLCanvasElement);
const placementHintTextElement = getRequiredElement("placementHintText", HTMLParagraphElement);
const unplacedDuckTrayElement = getRequiredElement("unplacedDuckTray", HTMLDivElement);
const duckDetailsEmptyTextElement = getRequiredElement("duckDetailsEmptyText", HTMLParagraphElement);
const duckDetailsContentElement = getRequiredElement("duckDetailsContent", HTMLDivElement);
const selectedDuckNameTextElement = getRequiredElement("selectedDuckNameText", HTMLInputElement);
const selectedDuckStageTextElement = getRequiredElement("selectedDuckStageText", HTMLParagraphElement);
const selectedDuckMetaTextElement = getRequiredElement("selectedDuckMetaText", HTMLParagraphElement);
const feedOneSeedButtonElement = getRequiredElement("feedOneSeedButton", HTMLButtonElement);
const feedToNextStageButtonElement = getRequiredElement("feedToNextStageButton", HTMLButtonElement);
const followDuckButtonElement = getRequiredElement("followDuckButton", HTMLButtonElement);

let selectedDurationSelectionMode: DurationSelectionMode = "twentyFive";
let activeTab: ActiveTab = "focus";
let isProjectPickerVisible = true;
let timerStateSnapshot: TimerStatusResponse | null = null;
let gameStateSnapshot: GameStatusResponse | null = null;
let spriteMap: SpriteMap = {};
const homesteadInteraction = createHomesteadInteraction();
let animationFrameId: number | null = null;

headerLogoImageElement.src = createAssetUrl("src/assets/pixel/ui/duck-footprint.png");

function createErrorResponse(message: string): { error: string } {
  return { error: message };
}

function padTimeSegment(segmentValue: number): string {
  return String(segmentValue).padStart(2, "0");
}

function formatAsHoursMinutesSeconds(totalSeconds: number): string {
  const normalizedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(normalizedSeconds / (MINUTES_PER_HOUR * SECONDS_PER_MINUTE));
  const minutes = Math.floor((normalizedSeconds % (MINUTES_PER_HOUR * SECONDS_PER_MINUTE)) / SECONDS_PER_MINUTE);
  const seconds = normalizedSeconds % SECONDS_PER_MINUTE;

  return `${padTimeSegment(hours)}:${padTimeSegment(minutes)}:${padTimeSegment(seconds)}`;
}

function formatProjectSeconds(totalSeconds: number): string {
  if (totalSeconds < SECONDS_PER_MINUTE) {
    return `${Math.floor(totalSeconds)}s`;
  }

  return `${Math.floor(totalSeconds / SECONDS_PER_MINUTE)}m`;
}

function readCustomDurationMinutesFromInput(): number {
  const parsedDurationMinutes = Number.parseFloat(durationMinutesInputElement.value);

  if (!Number.isFinite(parsedDurationMinutes) || parsedDurationMinutes <= 0) {
    return DEFAULT_CUSTOM_DURATION_MINUTES;
  }

  return parsedDurationMinutes;
}

function getSelectedDurationSeconds(): number {
  if (selectedDurationSelectionMode === "twentyFive") {
    return PRESET_TWENTY_FIVE_MINUTES * SECONDS_PER_MINUTE;
  }

  if (selectedDurationSelectionMode === "fifty") {
    return PRESET_FIFTY_MINUTES * SECONDS_PER_MINUTE;
  }

  return Math.max(1, Math.round(readCustomDurationMinutesFromInput() * SECONDS_PER_MINUTE));
}

function setDurationSelectionMode(durationSelectionMode: DurationSelectionMode): void {
  selectedDurationSelectionMode = durationSelectionMode;

  presetTwentyFiveMinutesButtonElement.classList.toggle("is-selected", durationSelectionMode === "twentyFive");
  presetFiftyMinutesButtonElement.classList.toggle("is-selected", durationSelectionMode === "fifty");
  presetCustomDurationButtonElement.classList.toggle("is-selected", durationSelectionMode === "custom");

  if (durationSelectionMode === "twentyFive") {
    durationMinutesInputElement.value = String(PRESET_TWENTY_FIVE_MINUTES);
    durationMinutesInputElement.disabled = true;
    return;
  }

  if (durationSelectionMode === "fifty") {
    durationMinutesInputElement.value = String(PRESET_FIFTY_MINUTES);
    durationMinutesInputElement.disabled = true;
    return;
  }

  durationMinutesInputElement.disabled = false;
  durationMinutesInputElement.focus();
}

function showStatus(message: string | null, isError: boolean = false): void {
  if (message !== null) {
    statusMessageElement.textContent = message;
  }

  statusMessageElement.classList.toggle("is-error", isError);
}

async function sendTimerRuntimeMessage(message: TimerRequestMessage): Promise<TimerMessageResponse> {
  const response = await chrome.runtime.sendMessage(message);

  if (!isTimerMessageResponse(response)) {
    return createErrorResponse("Unexpected timer response.");
  }

  return response;
}

async function sendGameRuntimeMessage(message: GameRequestMessage): Promise<GameMessageResponse> {
  const response = await chrome.runtime.sendMessage(message);

  if (!isGameMessageResponse(response)) {
    return createErrorResponse("Unexpected game response.");
  }

  return response;
}

function findProjectDefinition(projectId: ProjectId | null): ProjectDefinitionResponse | null {
  if (projectId === null || gameStateSnapshot === null) {
    return null;
  }

  return gameStateSnapshot.projectDefinitions.find((projectDefinition) => projectDefinition.id === projectId) ?? null;
}

function getActiveProjectProgressSeconds(projectDefinition: ProjectDefinitionResponse | null): number {
  if (gameStateSnapshot === null || gameStateSnapshot.gameState.activeProjectId === null || projectDefinition === null) {
    return 0;
  }

  const progressState = gameStateSnapshot.gameState.projectProgressById[gameStateSnapshot.gameState.activeProjectId];
  return Math.min(progressState?.progressSeconds ?? 0, projectDefinition.requiredProgressSeconds);
}

function isActiveProjectReady(): boolean {
  if (gameStateSnapshot === null || gameStateSnapshot.gameState.activeProjectId === null) {
    return false;
  }

  return gameStateSnapshot.gameState.projectProgressById[gameStateSnapshot.gameState.activeProjectId]?.isReadyToClaim === true;
}

function updateActiveRewardStage(projectDefinition: ProjectDefinitionResponse | null): void {
  const rewardArt = getFocusRewardArt(projectDefinition);
  const isEmpty = rewardArt === null || projectDefinition === null;

  activeRewardStageElement.classList.toggle("is-empty", isEmpty);

  if (isEmpty) {
    activeRewardImageElement.hidden = true;
    activeRewardImageElement.removeAttribute("src");
    activeRewardImageElement.alt = "";
    activeRewardNameTextElement.textContent = "Pick a project";
    activeRewardPromptTextElement.textContent = "Your reward will wait in the nest.";
    return;
  }

  activeRewardImageElement.hidden = false;
  activeRewardImageElement.src = createAssetUrl(rewardArt.relativePath);
  activeRewardImageElement.alt = rewardArt.altText;
  activeRewardNameTextElement.textContent = projectDefinition.displayName;
  activeRewardPromptTextElement.textContent = projectDefinition.rewardDescription;
}

function updateTimerDisplay(timerState: TimerMessageResponse): void {
  if ("error" in timerState) {
    showStatus(timerState.error, true);
    return;
  }

  timerStateSnapshot = timerState;
  timerDisplayElement.textContent = formatAsHoursMinutesSeconds(timerState.remainingSeconds);
  timerStateTextElement.textContent = timerState.isRunning
    ? "Focusing"
    : timerState.hasStartedAtLeastOnce && timerState.remainingSeconds > 0
      ? "Paused"
      : "Ready";

  const elapsedSeconds = timerState.configuredDurationSeconds - timerState.remainingSeconds;
  const timerProgressPercent =
    timerState.configuredDurationSeconds > 0 ? (elapsedSeconds / timerState.configuredDurationSeconds) * 100 : 0;
  timerProgressBarElement.style.width = `${Math.min(100, Math.max(0, timerProgressPercent))}%`;
}

function updateActionButtons(): void {
  const isTimerRunning = timerStateSnapshot?.isRunning === true;
  const hasActiveProject = gameStateSnapshot?.gameState.activeProjectId !== null;
  const activeProjectReady = isActiveProjectReady();

  startButtonElement.disabled = isTimerRunning || !hasActiveProject || activeProjectReady;
  pauseButtonElement.disabled = !isTimerRunning;
  resetButtonElement.disabled = false;
  startButtonElement.textContent =
    timerStateSnapshot?.hasStartedAtLeastOnce === true && (timerStateSnapshot?.remainingSeconds ?? 0) > 0
      ? "Resume"
      : "Start";
  changeProjectButtonElement.disabled = isTimerRunning;
  claimProjectButtonElement.disabled = isTimerRunning;
}

function createProjectButton(projectDefinition: ProjectDefinitionResponse): HTMLButtonElement {
  const button = document.createElement("button");
  const isTimerRunning = timerStateSnapshot?.isRunning === true;
  const isSelected = gameStateSnapshot?.gameState.activeProjectId === projectDefinition.id;
  const isDuckCapacityFull =
    projectDefinition.type === "egg" &&
    (gameStateSnapshot?.gameState.ducks.length ?? 0) >= (gameStateSnapshot?.maxDuckCount ?? 20);

  button.className = "project-button";
  button.classList.toggle("is-selected", isSelected);
  button.type = "button";
  button.disabled = isTimerRunning || isDuckCapacityFull;
  button.innerHTML = `<strong>${projectDefinition.displayName}</strong><span>${formatProjectSeconds(
    projectDefinition.requiredProgressSeconds
  )} · ${projectDefinition.rewardDescription}</span>`;
  button.addEventListener("click", () => {
    handleSelectProject(projectDefinition.id).catch(() => {
      showStatus("Project selection failed.", true);
    });
  });

  return button;
}

function renderProjectPicker(): void {
  if (gameStateSnapshot === null) {
    return;
  }

  eggProjectListElement.replaceChildren();
  seedProjectListElement.replaceChildren();

  for (const projectDefinition of gameStateSnapshot.projectDefinitions) {
    const button = createProjectButton(projectDefinition);

    if (projectDefinition.type === "egg") {
      eggProjectListElement.append(button);
    } else {
      seedProjectListElement.append(button);
    }
  }

  projectPickerElement.classList.toggle("is-hidden", !isProjectPickerVisible);
}

function updateGameDisplay(gameResponse: GameMessageResponse): void {
  if ("error" in gameResponse) {
    showStatus(gameResponse.error, true);
    return;
  }

  const gameResponseForDisplay = mergeGameResponseForDisplay(gameResponse);

  if (gameResponseForDisplay.statusMessage !== null) {
    showStatus(gameResponseForDisplay.statusMessage);
  } else if (gameResponseForDisplay.gameState.activeProjectId === null) {
    showStatus("Pick a project to begin.");
  }

  seedCountTextElement.textContent = `${gameResponseForDisplay.gameState.seedCount} seeds`;
  duckCapacityTextElement.textContent =
    `Ducks: ${gameResponseForDisplay.gameState.ducks.length} / ${gameResponseForDisplay.maxDuckCount}`;
  sessionStatsTextElement.textContent =
    `Sessions: ${gameResponseForDisplay.gameState.totalCompletedSessions} · ` +
    `Focus: ${gameResponseForDisplay.gameState.totalCompletedFocusSeconds}s`;

  const activeProjectDefinition = findProjectDefinition(gameResponseForDisplay.gameState.activeProjectId);

  if (activeProjectDefinition === null) {
    activeProjectTextElement.textContent = "No project selected.";
    projectProgressTextElement.textContent = "Choose an egg or seed project.";
    projectProgressBarElement.style.width = "0%";
    claimProjectButtonElement.hidden = true;
  } else {
    const progressSeconds = getActiveProjectProgressSeconds(activeProjectDefinition);
    const progressPercent = (progressSeconds / activeProjectDefinition.requiredProgressSeconds) * 100;
    const isReady = isActiveProjectReady();
    activeProjectTextElement.textContent =
      `${activeProjectDefinition.displayName}: ${activeProjectDefinition.rewardDescription}`;
    projectProgressTextElement.textContent =
      `${Math.floor(progressSeconds)} / ${activeProjectDefinition.requiredProgressSeconds} seconds` +
      (isReady ? " · ready" : "");
    projectProgressBarElement.style.width = `${Math.min(100, progressPercent)}%`;
    claimProjectButtonElement.hidden = !isReady;
    claimProjectButtonElement.textContent = activeProjectDefinition.type === "egg" ? "Claim duck" : "Claim seeds";
  }

  updateActiveRewardStage(activeProjectDefinition);
  renderProjectPicker();
  renderUnplacedDuckTray();
  renderDuckDetails();
  updateActionButtons();
  resizeCanvasToFrame();
  renderCanvas();
}

async function refreshTimerDisplay(): Promise<void> {
  const getTimerStateMessage: GetTimerStateMessage = { type: GET_TIMER_STATE_MESSAGE_TYPE };
  updateTimerDisplay(await sendTimerRuntimeMessage(getTimerStateMessage));
  updateActionButtons();
}

async function refreshGameDisplay(): Promise<void> {
  const getGameStateMessage: GetGameStateMessage = { type: GET_GAME_STATE_MESSAGE_TYPE };
  updateGameDisplay(await sendGameRuntimeMessage(getGameStateMessage));
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

  if (homesteadInteraction.catchUpAfterAway(Date.now(), Math.random)) {
    syncGameStateSnapshotFromHomestead();
    renderDuckDetails();
    renderCanvas();
    await saveHomesteadState();
  }
}

async function handleStartButtonClick(): Promise<void> {
  const startTimerMessage: StartTimerMessage = {
    type: START_TIMER_MESSAGE_TYPE,
    durationSeconds: getSelectedDurationSeconds()
  };
  const timerResponse = await sendTimerRuntimeMessage(startTimerMessage);
  updateTimerDisplay(timerResponse);

  if ("error" in timerResponse) {
    showStatus(timerResponse.error, true);
  }

  await refreshGameDisplay();
}

async function handlePauseButtonClick(): Promise<void> {
  const pauseTimerMessage: PauseTimerMessage = { type: PAUSE_TIMER_MESSAGE_TYPE };
  updateTimerDisplay(await sendTimerRuntimeMessage(pauseTimerMessage));
  await refreshGameDisplay();
}

async function handleResetButtonClick(): Promise<void> {
  const resetTimerMessage: ResetTimerMessage = {
    type: RESET_TIMER_MESSAGE_TYPE,
    durationSeconds: getSelectedDurationSeconds()
  };
  updateTimerDisplay(await sendTimerRuntimeMessage(resetTimerMessage));
  await refreshGameDisplay();
}

async function handleSelectProject(projectId: ProjectId): Promise<void> {
  const selectProjectMessage: SelectProjectMessage = {
    type: SELECT_PROJECT_MESSAGE_TYPE,
    projectId
  };
  updateGameDisplay(await sendGameRuntimeMessage(selectProjectMessage));
  isProjectPickerVisible = false;
  renderProjectPicker();
}

async function handleClaimProjectButtonClick(): Promise<void> {
  const claimProjectMessage: ClaimActiveProjectMessage = { type: CLAIM_ACTIVE_PROJECT_MESSAGE_TYPE };
  updateGameDisplay(await sendGameRuntimeMessage(claimProjectMessage));
  await refreshTimerDisplay();
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
    resizeCanvasToFrame();
    startAnimationLoop();
    catchUpHomesteadAfterAway().catch(() => {
      showStatus("Homestead unavailable.", true);
    });
  } else {
    saveHomesteadState().catch(() => {});
    stopAnimationLoop();
  }
}

function getHomesteadCanvasMetrics(): HomesteadCanvasMetrics {
  const canvasBounds = homesteadCanvasElement.getBoundingClientRect();

  return {
    width: homesteadCanvasElement.width,
    height: homesteadCanvasElement.height,
    boundsLeft: canvasBounds.left,
    boundsTop: canvasBounds.top,
    boundsWidth: canvasBounds.width,
    boundsHeight: canvasBounds.height
  };
}

function getHomesteadCanvasSize(): { width: number; height: number } {
  return {
    width: homesteadCanvasElement.width,
    height: homesteadCanvasElement.height
  };
}

function syncGameStateSnapshotFromHomestead(): void {
  gameStateSnapshot = homesteadInteraction.getGameResponse();
}

function updateFollowDuckButton(): void {
  followDuckButtonElement.textContent = homesteadInteraction.getIsFollowingSelectedDuck() ? "Unfollow" : "Follow";
}

function getPointerWorldPosition(event: PointerEvent | DragEvent): DuckPosition {
  const clientX = "clientX" in event ? event.clientX : 0;
  const clientY = "clientY" in event ? event.clientY : 0;
  return homesteadInteraction.getPointerWorldPosition(clientX, clientY, getHomesteadCanvasMetrics());
}

function mergeGameResponseForDisplay(gameResponse: GameStatusResponse): GameStatusResponse {
  const mergedGameResponse = homesteadInteraction.mergeGameResponse(gameResponse, activeTab === "homestead");
  gameStateSnapshot = mergedGameResponse;
  updateFollowDuckButton();
  return mergedGameResponse;
}

function resizeCanvasToFrame(): void {
  if (gameStateSnapshot === null || homesteadTabElement.hidden) {
    return;
  }

  const frameBounds = homesteadFrameElement.getBoundingClientRect();
  const canvasWidth = Math.max(240, Math.floor(frameBounds.width - HOMESTEAD_FRAME_GUTTER * 2));
  const canvasHeight = Math.max(220, Math.floor(frameBounds.height - HOMESTEAD_FRAME_GUTTER * 2));

  if (homesteadCanvasElement.width !== canvasWidth || homesteadCanvasElement.height !== canvasHeight) {
    homesteadCanvasElement.width = canvasWidth;
    homesteadCanvasElement.height = canvasHeight;
  }

  homesteadInteraction.resizeCanvas({ width: canvasWidth, height: canvasHeight });
  syncGameStateSnapshotFromHomestead();
}

function renderCanvas(): void {
  const renderState = homesteadInteraction.getRenderState();

  if (renderState === null) {
    return;
  }

  renderHomesteadCanvas({
    canvas: homesteadCanvasElement,
    camera: renderState.camera,
    ducks: renderState.ducks,
    animationFrameIndex: Math.floor(Date.now() / 180) % 4,
    currentTimestampMilliseconds: Date.now(),
    spriteMap
  });
}

function getIsClientPointInsideCanvas(clientX: number, clientY: number): boolean {
  return homesteadInteraction.isClientPointInsideCanvas(clientX, clientY, getHomesteadCanvasMetrics());
}

function createDuckThumbnail(duck: Duck): HTMLButtonElement {
  const button = document.createElement("button");
  const sprite = document.createElement("span");

  button.className = "duck-thumbnail";
  button.classList.toggle("is-selected", homesteadInteraction.getSelectedUnplacedDuckId() === duck.id);
  button.type = "button";
  button.draggable = true;
  button.title = duck.name;
  sprite.className = "duck-thumbnail-sprite";
  button.append(sprite);
  button.addEventListener("click", () => {
    if (homesteadInteraction.consumeSuppressedThumbnailClick(duck.id)) {
      return;
    }

    const selectedUnplacedDuckId = homesteadInteraction.toggleUnplacedDuckSelection(duck.id);
    placementHintTextElement.textContent = selectedUnplacedDuckId ? "Click a valid grass/path tile." : "Click a duck, then click the map.";
    renderUnplacedDuckTray();
    renderCanvas();
  });
  button.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData("text/plain", duck.id);
    homesteadInteraction.selectUnplacedDuck(duck.id);
  });
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    homesteadInteraction.startUnplacedDuckPointerDrag(duck.id, {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY
    });
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointermove", (event) => {
    const dragMoveResult = homesteadInteraction.moveUnplacedDuckPointerDrag({
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY
    });

    if (dragMoveResult === null) {
      return;
    }

    button.classList.toggle("is-pointer-dragging", dragMoveResult.hasMoved);
  });
  button.addEventListener("pointerup", (event) => {
    const endedDragState = homesteadInteraction.endUnplacedDuckPointerDrag(event.pointerId);

    if (endedDragState === null) {
      return;
    }

    button.classList.remove("is-pointer-dragging");

    if (!endedDragState.hasMoved) {
      return;
    }

    if (getIsClientPointInsideCanvas(event.clientX, event.clientY)) {
      placeDuckAtWorldPosition(endedDragState.duckId, getPointerWorldPosition(event)).catch(() => {
        showStatus("Placement failed.", true);
      });
    }
  });
  button.addEventListener("pointercancel", () => {
    if (homesteadInteraction.cancelUnplacedDuckPointerDrag(duck.id)) {
      button.classList.remove("is-pointer-dragging");
    }
  });

  return button;
}

function renderUnplacedDuckTray(): void {
  if (gameStateSnapshot === null) {
    return;
  }

  const unplacedDucks = homesteadInteraction.getUnplacedDucks();
  unplacedDuckTrayElement.replaceChildren();

  if (unplacedDucks.length === 0) {
    const emptyText = document.createElement("p");
    emptyText.className = "drawer-empty";
    emptyText.textContent = "No ducks waiting.";
    unplacedDuckTrayElement.append(emptyText);
    return;
  }

  for (const duck of unplacedDucks) {
    unplacedDuckTrayElement.append(createDuckThumbnail(duck));
  }
}

function getSelectedDuck(): Duck | null {
  return homesteadInteraction.getSelectedDuck();
}

function getSeedsNeededForSelectedDuck(duck: Duck): number | null {
  if (duck.growthStage === "adultDuck") {
    return null;
  }

  return DUCK_GROWTH_SEED_REQUIREMENTS[duck.growthStage] - duck.seedsFedForCurrentStage;
}

function renderDuckDetails(): void {
  const selectedDuck = getSelectedDuck();

  if (selectedDuck === null) {
    duckDetailsEmptyTextElement.hidden = false;
    duckDetailsContentElement.hidden = true;
    return;
  }

  const seedsNeeded = getSeedsNeededForSelectedDuck(selectedDuck);
  const ageSeconds = Math.max(
    0,
    Math.floor(((gameStateSnapshot?.nowTimestampMilliseconds ?? Date.now()) - selectedDuck.hatchedAtTimestampMilliseconds) / 1000)
  );
  const seedCount = gameStateSnapshot?.gameState.seedCount ?? 0;

  duckDetailsEmptyTextElement.hidden = true;
  duckDetailsContentElement.hidden = false;
  if (document.activeElement !== selectedDuckNameTextElement) {
    selectedDuckNameTextElement.value = selectedDuck.name;
  }
  selectedDuckStageTextElement.textContent = selectedDuck.growthStage;
  selectedDuckMetaTextElement.textContent =
    `${selectedDuck.variantId} · ${getActivityLabel(selectedDuck.activity)} · ` +
    `${selectedDuck.favoriteActivity} · Age ${ageSeconds}s` +
    (seedsNeeded === null ? " · fully grown" : ` · ${selectedDuck.seedsFedForCurrentStage} fed, ${seedsNeeded} to grow`);
  updateFollowDuckButton();
  feedOneSeedButtonElement.disabled = seedsNeeded === null || seedCount < 1;
  feedToNextStageButtonElement.disabled = seedsNeeded === null || seedCount < seedsNeeded;
}

async function placeDuckAtWorldPosition(duckId: string, worldPosition: DuckPosition): Promise<void> {
  const placementResult = homesteadInteraction.createPlacementResult(worldPosition);

  if (!placementResult.isValid || placementResult.centeredPosition === null) {
    placementHintTextElement.textContent = "That tile is blocked.";
    showStatus("Invalid placement.", true);
    renderCanvas();
    return;
  }

  const placeDuckMessage: PlaceDuckMessage = {
    type: PLACE_DUCK_MESSAGE_TYPE,
    duckId,
    x: placementResult.centeredPosition.x,
    y: placementResult.centeredPosition.y
  };
  updateGameDisplay(await sendGameRuntimeMessage(placeDuckMessage));
  homesteadInteraction.finishDuckPlacement(duckId, getHomesteadCanvasSize(), performance.now());
  syncGameStateSnapshotFromHomestead();
  updateFollowDuckButton();
  placementHintTextElement.textContent = "Duck placed.";
}

function handleCanvasPointerDown(event: PointerEvent): void {
  const pointerDownResult = homesteadInteraction.handleCanvasPointerDown(
    { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY },
    getHomesteadCanvasMetrics(),
    performance.now()
  );
  syncGameStateSnapshotFromHomestead();
  updateFollowDuckButton();

  if (pointerDownResult.shouldCapturePointer) {
    homesteadCanvasElement.setPointerCapture(event.pointerId);
  }

  if (pointerDownResult.isDraggingCamera) {
    homesteadCanvasElement.classList.add("is-dragging");
  }

  if (pointerDownResult.shouldRenderDuckDetails) {
    renderDuckDetails();
  }

  if (pointerDownResult.shouldRenderCanvas) {
    renderCanvas();
  }
}

function handleCanvasPointerMove(event: PointerEvent): void {
  const pointerMoveResult = homesteadInteraction.handleCanvasPointerMove(
    { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY },
    getHomesteadCanvasMetrics()
  );
  syncGameStateSnapshotFromHomestead();

  if (pointerMoveResult.shouldRenderCanvas) {
    renderCanvas();
  }
}

function handleCanvasPointerUp(event: PointerEvent): void {
  const pointerUpResult = homesteadInteraction.handleCanvasPointerUp(
    { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY },
    getHomesteadCanvasMetrics()
  );
  syncGameStateSnapshotFromHomestead();

  if (pointerUpResult.stoppedCameraDrag) {
    homesteadCanvasElement.classList.remove("is-dragging");
  }

  if (pointerUpResult.duckPlacementRequest !== null) {
    placeDuckAtWorldPosition(
      pointerUpResult.duckPlacementRequest.duckId,
      pointerUpResult.duckPlacementRequest.worldPosition
    ).catch(() => {
      showStatus("Placement failed.", true);
    });
  } else if (pointerUpResult.shouldSaveCamera) {
    saveCameraState().catch(() => {});
  }

  if (pointerUpResult.shouldRenderCanvas) {
    renderCanvas();
  }
}

function animationLoop(timestampMilliseconds: number): void {
  const frameResult = homesteadInteraction.advanceAnimationFrame({
    timestampMilliseconds,
    isHomesteadActive: activeTab === "homestead",
    canvasSize: getHomesteadCanvasSize(),
    nowTimestampMilliseconds: Date.now(),
    random: Math.random
  });
  syncGameStateSnapshotFromHomestead();
  updateFollowDuckButton();
  renderCanvas();

  if (frameResult.shouldSaveCamera) {
    saveCameraState().catch(() => {});
  }

  if (frameResult.shouldSaveHomestead) {
    saveHomesteadState().catch(() => {});
  }

  animationFrameId = window.requestAnimationFrame(animationLoop);
}

function startAnimationLoop(): void {
  if (animationFrameId !== null) {
    return;
  }

  homesteadInteraction.resetAnimationClock();
  animationFrameId = window.requestAnimationFrame(animationLoop);
}

function stopAnimationLoop(): void {
  if (animationFrameId === null) {
    return;
  }

  window.cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
}

async function saveCameraState(): Promise<void> {
  const cameraState = homesteadInteraction.createCameraSaveState();

  if (cameraState === null) {
    return;
  }

  const saveCameraMessage: SaveHomesteadCameraMessage = {
    type: SAVE_HOMESTEAD_CAMERA_MESSAGE_TYPE,
    homesteadCamera: cameraState
  };
  await sendGameRuntimeMessage(saveCameraMessage);
}

async function saveHomesteadState(): Promise<void> {
  const saveSnapshot = homesteadInteraction.createHomesteadSaveSnapshot();

  if (saveSnapshot === null) {
    return;
  }

  const updateDuckSimulationStateMessage: UpdateDuckSimulationStateMessage = {
    type: UPDATE_DUCK_SIMULATION_STATE_MESSAGE_TYPE,
    updates: saveSnapshot.duckSimulationUpdates
  };
  await sendGameRuntimeMessage(updateDuckSimulationStateMessage);
  const saveCameraMessage: SaveHomesteadCameraMessage = {
    type: SAVE_HOMESTEAD_CAMERA_MESSAGE_TYPE,
    homesteadCamera: saveSnapshot.camera
  };
  await sendGameRuntimeMessage(saveCameraMessage);
}

async function handleRenameDuck(): Promise<void> {
  const selectedDuck = getSelectedDuck();

  if (selectedDuck === null) {
    return;
  }

  const renameDuckMessage: RenameDuckMessage = {
    type: RENAME_DUCK_MESSAGE_TYPE,
    duckId: selectedDuck.id,
    name: selectedDuckNameTextElement.value
  };
  updateGameDisplay(await sendGameRuntimeMessage(renameDuckMessage));
}

async function handleFeedDuck(feedMode: FeedDuckMode): Promise<void> {
  const selectedDuck = getSelectedDuck();

  if (selectedDuck === null) {
    return;
  }

  const feedDuckMessage: FeedDuckMessage = {
    type: FEED_DUCK_MESSAGE_TYPE,
    duckId: selectedDuck.id,
    feedMode
  };
  updateGameDisplay(await sendGameRuntimeMessage(feedDuckMessage));
}

presetTwentyFiveMinutesButtonElement.addEventListener("click", () => {
  setDurationSelectionMode("twentyFive");
});

presetFiftyMinutesButtonElement.addEventListener("click", () => {
  setDurationSelectionMode("fifty");
});

presetCustomDurationButtonElement.addEventListener("click", () => {
  setDurationSelectionMode("custom");
});

focusTabButtonElement.addEventListener("click", () => {
  setActiveTab("focus");
});

homesteadTabButtonElement.addEventListener("click", () => {
  setActiveTab("homestead");
});

startButtonElement.addEventListener("click", () => {
  handleStartButtonClick().catch(() => {
    showStatus("Start failed.", true);
  });
});

pauseButtonElement.addEventListener("click", () => {
  handlePauseButtonClick().catch(() => {
    showStatus("Pause failed.", true);
  });
});

resetButtonElement.addEventListener("click", () => {
  handleResetButtonClick().catch(() => {
    showStatus("Reset failed.", true);
  });
});

changeProjectButtonElement.addEventListener("click", () => {
  isProjectPickerVisible = !isProjectPickerVisible;
  renderProjectPicker();
});

claimProjectButtonElement.addEventListener("click", () => {
  handleClaimProjectButtonClick().catch(() => {
    showStatus("Claim failed.", true);
  });
});

selectedDuckNameTextElement.addEventListener("blur", () => {
  handleRenameDuck().catch(() => {
    showStatus("Rename failed.", true);
  });
});

selectedDuckNameTextElement.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    selectedDuckNameTextElement.blur();
  }
});

feedOneSeedButtonElement.addEventListener("click", () => {
  handleFeedDuck("single").catch(() => {
    showStatus("Feed failed.", true);
  });
});

feedToNextStageButtonElement.addEventListener("click", () => {
  handleFeedDuck("toNextStage").catch(() => {
    showStatus("Feed failed.", true);
  });
});

followDuckButtonElement.addEventListener("click", () => {
  const isFollowingSelectedDuck = homesteadInteraction.toggleFollowSelectedDuck(getHomesteadCanvasSize(), performance.now());
  syncGameStateSnapshotFromHomestead();
  updateFollowDuckButton();

  if (isFollowingSelectedDuck) {
    renderCanvas();
  }
});

homesteadCanvasElement.addEventListener("pointerdown", handleCanvasPointerDown);
homesteadCanvasElement.addEventListener("pointermove", handleCanvasPointerMove);
homesteadCanvasElement.addEventListener("pointerup", handleCanvasPointerUp);
homesteadCanvasElement.addEventListener("pointercancel", handleCanvasPointerUp);
homesteadCanvasElement.addEventListener("wheel", (event) => {
  if (gameStateSnapshot === null) {
    return;
  }

  event.preventDefault();
  const zoomMultiplier = event.deltaY < 0 ? 1.1 : 0.9;
  homesteadInteraction.handleWheelZoom(
    gameStateSnapshot.gameState.homesteadCamera.zoom * zoomMultiplier,
    event.clientX,
    event.clientY,
    getHomesteadCanvasMetrics()
  );
  syncGameStateSnapshotFromHomestead();
  updateFollowDuckButton();
  saveCameraState().catch(() => {});
  renderDuckDetails();
  renderCanvas();
}, { passive: false });
homesteadCanvasElement.addEventListener("dragover", (event) => {
  event.preventDefault();
});
homesteadCanvasElement.addEventListener("drop", (event) => {
  event.preventDefault();
  const duckId = event.dataTransfer?.getData("text/plain") ?? homesteadInteraction.getSelectedUnplacedDuckId();

  if (!duckId) {
    return;
  }

  placeDuckAtWorldPosition(duckId, getPointerWorldPosition(event)).catch(() => {
    showStatus("Placement failed.", true);
  });
});

new ResizeObserver(() => {
  resizeCanvasToFrame();
  renderCanvas();
}).observe(homesteadFrameElement);

window.addEventListener("beforeunload", () => {
  saveHomesteadState().catch(() => {});
});

setDurationSelectionMode("twentyFive");

loadPixelSprites()
  .then((loadedSpriteMap) => {
    spriteMap = loadedSpriteMap;
    renderCanvas();
  })
  .catch(() => {
    spriteMap = {};
  });

refreshAllDisplays().catch(() => {
  showStatus("State unavailable.", true);
});

setInterval(() => {
  refreshAllDisplays().catch(() => {
    showStatus("State unavailable.", true);
  });
}, UPDATE_INTERVAL_MILLISECONDS);

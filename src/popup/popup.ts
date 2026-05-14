import { DUCK_GROWTH_SEED_REQUIREMENTS } from "../shared/balance.js";
import { getActivityLabel } from "../shared/duckDefinitions.js";
import {
  HOMESTEAD_FRAME_GUTTER,
  HOMESTEAD_MAX_ZOOM,
  HOMESTEAD_MIN_ZOOM,
  HOMESTEAD_TILE_SIZE,
  HOMESTEAD_WORLD_HEIGHT,
  HOMESTEAD_WORLD_WIDTH,
  clampCamera,
  getCenteredTileWorldPosition,
  isManualDuckPlacementValid
} from "../shared/homesteadMap.js";
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
  DuckSimulationStateUpdate,
  DuckPosition,
  FeedDuckMode,
  GameMessageResponse,
  GameStatusResponse,
  ProjectDefinitionResponse,
  ProjectId,
  HomesteadCameraState,
  TimerMessageResponse,
  TimerStatusResponse
} from "../shared/types.js";
import { createAssetUrl, loadPixelSprites, type SpriteMap } from "./assetLoader.js";
import { renderHomesteadCanvas } from "./canvasRenderer.js";
import {
  pruneDuckRoamStates,
  simulateDuckMovement as simulateHomesteadDuckMovement,
  type DuckRoamState
} from "./homesteadSimulation.js";
import { getFocusRewardArt } from "./rewardArt.js";

const UPDATE_INTERVAL_MILLISECONDS = 1000;
const SIMULATION_SAVE_INTERVAL_MILLISECONDS = 5000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const PRESET_TWENTY_FIVE_MINUTES = 25;
const PRESET_FIFTY_MINUTES = 50;
const DEFAULT_CUSTOM_DURATION_MINUTES = PRESET_TWENTY_FIVE_MINUTES;

type DurationSelectionMode = "twentyFive" | "fifty" | "custom";
type ActiveTab = "focus" | "homestead";

interface PointerDragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
  startCamera: HomesteadCameraState;
  hasMoved: boolean;
}

interface PinchZoomState {
  pointerIdA: number;
  pointerIdB: number;
  startDistance: number;
  startCamera: HomesteadCameraState;
}

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
const selectedDuckNameTextElement = getRequiredElement("selectedDuckNameText", HTMLParagraphElement);
const selectedDuckStageTextElement = getRequiredElement("selectedDuckStageText", HTMLParagraphElement);
const selectedDuckMetaTextElement = getRequiredElement("selectedDuckMetaText", HTMLParagraphElement);
const duckNameInputElement = getRequiredElement("duckNameInput", HTMLInputElement);
const renameDuckButtonElement = getRequiredElement("renameDuckButton", HTMLButtonElement);
const feedOneSeedButtonElement = getRequiredElement("feedOneSeedButton", HTMLButtonElement);
const feedToNextStageButtonElement = getRequiredElement("feedToNextStageButton", HTMLButtonElement);
const followDuckButtonElement = getRequiredElement("followDuckButton", HTMLButtonElement);

let selectedDurationSelectionMode: DurationSelectionMode = "twentyFive";
let activeTab: ActiveTab = "focus";
let isProjectPickerVisible = true;
let timerStateSnapshot: TimerStatusResponse | null = null;
let gameStateSnapshot: GameStatusResponse | null = null;
let spriteMap: SpriteMap = {};
let selectedDuckId: string | null = null;
let selectedUnplacedDuckId: string | null = null;
let pointerDragState: PointerDragState | null = null;
let activeCanvasPointerById = new Map<number, PointerEvent>();
let pinchZoomState: PinchZoomState | null = null;
let isFollowingSelectedDuck = false;
let animationFrameId: number | null = null;
let previousAnimationTimestampMilliseconds = 0;
let lastSimulationSaveTimestampMilliseconds = 0;
let localDucks: Duck[] = [];
let duckRoamStateById = new Map<string, DuckRoamState>();

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

  const mergedLocalDucks = mergeLiveDuckSimulationState(gameResponse.gameState.ducks);
  gameStateSnapshot = {
    ...gameResponse,
    gameState: {
      ...gameResponse.gameState,
      ducks: mergedLocalDucks
    }
  };
  localDucks = mergedLocalDucks;
  duckRoamStateById = pruneDuckRoamStates(localDucks, duckRoamStateById);

  if (gameResponse.statusMessage !== null) {
    showStatus(gameResponse.statusMessage);
  } else if (gameResponse.gameState.activeProjectId === null) {
    showStatus("Pick a project to begin.");
  }

  seedCountTextElement.textContent = `${gameResponse.gameState.seedCount} seeds`;
  duckCapacityTextElement.textContent =
    `Ducks: ${gameResponse.gameState.ducks.length} / ${gameResponse.maxDuckCount}`;
  sessionStatsTextElement.textContent =
    `Sessions: ${gameResponse.gameState.totalCompletedSessions} · ` +
    `Focus: ${gameResponse.gameState.totalCompletedFocusSeconds}s`;

  const activeProjectDefinition = findProjectDefinition(gameResponse.gameState.activeProjectId);

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
  } else {
    saveHomesteadState().catch(() => {});
    stopAnimationLoop();
  }
}

function getPointerWorldPosition(event: PointerEvent | DragEvent): DuckPosition {
  const canvasBounds = homesteadCanvasElement.getBoundingClientRect();
  const clientX = "clientX" in event ? event.clientX : 0;
  const clientY = "clientY" in event ? event.clientY : 0;
  const scaleX = homesteadCanvasElement.width / canvasBounds.width;
  const scaleY = homesteadCanvasElement.height / canvasBounds.height;
  const canvasX = (clientX - canvasBounds.left) * scaleX;
  const canvasY = (clientY - canvasBounds.top) * scaleY;
  const camera = gameStateSnapshot?.gameState.homesteadCamera ?? { x: 0, y: 0, zoom: 1 };

  return {
    x: canvasX / camera.zoom + camera.x,
    y: canvasY / camera.zoom + camera.y
  };
}

function findDuckAtWorldPosition(position: DuckPosition): Duck | null {
  for (const duck of localDucks) {
    if (duck.placementStatus !== "placed" || duck.position === null) {
      continue;
    }

    const distanceX = Math.abs(duck.position.x - position.x);
    const distanceY = Math.abs(duck.position.y - position.y);

    if (distanceX <= HOMESTEAD_TILE_SIZE / 2 && distanceY <= HOMESTEAD_TILE_SIZE / 2) {
      return duck;
    }
  }

  return null;
}

function resetDuckRoamState(duckId: string): void {
  duckRoamStateById.delete(duckId);
}

function setFollowSelectedDuck(isFollowing: boolean): void {
  isFollowingSelectedDuck = isFollowing && selectedDuckId !== null;
  followDuckButtonElement.textContent = isFollowingSelectedDuck ? "Unfollow" : "Follow";
}

function stopFollowingForManualCameraInput(): void {
  if (isFollowingSelectedDuck) {
    setFollowSelectedDuck(false);
  }
}

function getCenteredCameraForPosition(position: DuckPosition, camera: HomesteadCameraState): HomesteadCameraState {
  return clampCamera(
    {
      ...camera,
      x: position.x - homesteadCanvasElement.width / camera.zoom / 2,
      y: position.y - homesteadCanvasElement.height / camera.zoom / 2
    },
    homesteadCanvasElement.width,
    homesteadCanvasElement.height
  );
}

function centerCameraOnDuck(duck: Duck): void {
  if (gameStateSnapshot === null || duck.position === null) {
    return;
  }

  gameStateSnapshot = {
    ...gameStateSnapshot,
    gameState: {
      ...gameStateSnapshot.gameState,
      homesteadCamera: getCenteredCameraForPosition(duck.position, gameStateSnapshot.gameState.homesteadCamera)
    }
  };
}

function followSelectedDuckIfNeeded(): void {
  if (!isFollowingSelectedDuck) {
    return;
  }

  const selectedDuck = getSelectedDuck();

  if (selectedDuck === null) {
    setFollowSelectedDuck(false);
    return;
  }

  centerCameraOnDuck(selectedDuck);
}

function mergeLiveDuckSimulationState(ducks: Duck[]): Duck[] {
  if (activeTab !== "homestead") {
    return ducks;
  }

  const liveDuckById = new Map(localDucks.map((duck) => [duck.id, duck]));

  return ducks.map((duck) => {
    const liveDuck = liveDuckById.get(duck.id);

    if (
      liveDuck?.placementStatus === "placed" &&
      liveDuck.position !== null &&
      duck.placementStatus === "placed" &&
      duck.position !== null
    ) {
      return {
        ...duck,
        position: liveDuck.position,
        activity: liveDuck.activity,
        facingDirection: liveDuck.facingDirection,
        lastUpdatedAtTimestampMilliseconds: liveDuck.lastUpdatedAtTimestampMilliseconds
      };
    }

    return duck;
  });
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

  const clampedCamera = clampCamera(gameStateSnapshot.gameState.homesteadCamera, canvasWidth, canvasHeight);
  gameStateSnapshot = {
    ...gameStateSnapshot,
    gameState: {
      ...gameStateSnapshot.gameState,
      homesteadCamera: clampedCamera
    }
  };
}

function renderCanvas(): void {
  if (gameStateSnapshot === null) {
    return;
  }

  renderHomesteadCanvas({
    canvas: homesteadCanvasElement,
    camera: gameStateSnapshot.gameState.homesteadCamera,
    ducks: localDucks,
    animationFrameIndex: Math.floor(Date.now() / 180) % 4,
    spriteMap
  });
}

function createDuckThumbnail(duck: Duck): HTMLButtonElement {
  const button = document.createElement("button");
  const sprite = document.createElement("span");

  button.className = "duck-thumbnail";
  button.classList.toggle("is-selected", selectedUnplacedDuckId === duck.id);
  button.type = "button";
  button.draggable = true;
  button.title = duck.name;
  sprite.className = "duck-thumbnail-sprite";
  button.append(sprite);
  button.addEventListener("click", () => {
    selectedUnplacedDuckId = selectedUnplacedDuckId === duck.id ? null : duck.id;
    placementHintTextElement.textContent = selectedUnplacedDuckId ? "Click a valid grass/path tile." : "Click a duck, then click the map.";
    renderUnplacedDuckTray();
    renderCanvas();
  });
  button.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData("text/plain", duck.id);
    selectedUnplacedDuckId = duck.id;
  });

  return button;
}

function renderUnplacedDuckTray(): void {
  if (gameStateSnapshot === null) {
    return;
  }

  const unplacedDucks = gameStateSnapshot.gameState.ducks.filter((duck) => duck.placementStatus === "unplaced");
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
  if (selectedDuckId === null) {
    return null;
  }

  return localDucks.find((duck) => duck.id === selectedDuckId) ?? null;
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
  selectedDuckNameTextElement.textContent = selectedDuck.name;
  selectedDuckStageTextElement.textContent = selectedDuck.growthStage;
  selectedDuckMetaTextElement.textContent =
    `${selectedDuck.variantId} · ${getActivityLabel(selectedDuck.activity)} · ` +
    `${selectedDuck.favoriteActivity} · Age ${ageSeconds}s` +
    (seedsNeeded === null ? " · fully grown" : ` · ${selectedDuck.seedsFedForCurrentStage} fed, ${seedsNeeded} to grow`);
  duckNameInputElement.value = selectedDuck.name;
  followDuckButtonElement.textContent = isFollowingSelectedDuck ? "Unfollow" : "Follow";
  feedOneSeedButtonElement.disabled = seedsNeeded === null || seedCount < 1;
  feedToNextStageButtonElement.disabled = seedsNeeded === null || seedCount < seedsNeeded;
}

async function placeDuckAtWorldPosition(duckId: string, worldPosition: DuckPosition): Promise<void> {
  const tileColumn = Math.floor(worldPosition.x / HOMESTEAD_TILE_SIZE);
  const tileRow = Math.floor(worldPosition.y / HOMESTEAD_TILE_SIZE);
  const centeredPosition = getCenteredTileWorldPosition(tileColumn, tileRow);

  if (!isManualDuckPlacementValid(centeredPosition)) {
    placementHintTextElement.textContent = "That tile is blocked.";
    showStatus("Invalid placement.", true);
    renderCanvas();
    return;
  }

  const placeDuckMessage: PlaceDuckMessage = {
    type: PLACE_DUCK_MESSAGE_TYPE,
    duckId,
    x: centeredPosition.x,
    y: centeredPosition.y
  };
  updateGameDisplay(await sendGameRuntimeMessage(placeDuckMessage));
  selectedUnplacedDuckId = null;
  selectedDuckId = duckId;
  setFollowSelectedDuck(true);
  resetDuckRoamState(duckId);
  const placedDuck = localDucks.find((duck) => duck.id === duckId);
  if (placedDuck !== undefined) {
    centerCameraOnDuck(placedDuck);
    saveCameraState().catch(() => {});
  }
  placementHintTextElement.textContent = "Duck placed.";
}

function updateLocalCameraFromDrag(event: PointerEvent): void {
  if (gameStateSnapshot === null) {
    return;
  }

  if (pointerDragState === null) {
    return;
  }

  const nextCamera = clampCamera(
    {
      ...pointerDragState.startCamera,
      x: pointerDragState.startCamera.x - (event.clientX - pointerDragState.startClientX) / pointerDragState.startCamera.zoom,
      y: pointerDragState.startCamera.y - (event.clientY - pointerDragState.startClientY) / pointerDragState.startCamera.zoom
    },
    homesteadCanvasElement.width,
    homesteadCanvasElement.height
  );

  gameStateSnapshot = {
    ...gameStateSnapshot,
    gameState: {
      ...gameStateSnapshot.gameState,
      homesteadCamera: nextCamera
    }
  };
}

function updateLocalZoom(
  requestedZoom: number,
  clientX: number,
  clientY: number,
  baseCamera: HomesteadCameraState | null = null
): void {
  if (gameStateSnapshot === null) {
    return;
  }

  const camera = baseCamera ?? gameStateSnapshot.gameState.homesteadCamera;
  const canvasBounds = homesteadCanvasElement.getBoundingClientRect();
  const scaleX = homesteadCanvasElement.width / canvasBounds.width;
  const scaleY = homesteadCanvasElement.height / canvasBounds.height;
  const canvasX = (clientX - canvasBounds.left) * scaleX;
  const canvasY = (clientY - canvasBounds.top) * scaleY;
  const nextZoom = Math.min(Math.max(requestedZoom, HOMESTEAD_MIN_ZOOM), HOMESTEAD_MAX_ZOOM);
  const anchorWorldX = camera.x + canvasX / camera.zoom;
  const anchorWorldY = camera.y + canvasY / camera.zoom;
  const nextCamera = clampCamera(
    {
      zoom: nextZoom,
      x: anchorWorldX - canvasX / nextZoom,
      y: anchorWorldY - canvasY / nextZoom
    },
    homesteadCanvasElement.width,
    homesteadCanvasElement.height
  );

  gameStateSnapshot = {
    ...gameStateSnapshot,
    gameState: {
      ...gameStateSnapshot.gameState,
      homesteadCamera: nextCamera
    }
  };
}

function handleCanvasPointerDown(event: PointerEvent): void {
  if (gameStateSnapshot === null) {
    return;
  }

  activeCanvasPointerById.set(event.pointerId, event);
  if (activeCanvasPointerById.size === 2) {
    const activePointers = [...activeCanvasPointerById.values()];
    pinchZoomState = {
      pointerIdA: activePointers[0].pointerId,
      pointerIdB: activePointers[1].pointerId,
      startDistance: Math.hypot(activePointers[0].clientX - activePointers[1].clientX, activePointers[0].clientY - activePointers[1].clientY),
      startCamera: gameStateSnapshot.gameState.homesteadCamera
    };
    pointerDragState = null;
    stopFollowingForManualCameraInput();
    return;
  }

  const worldPosition = getPointerWorldPosition(event);
  const clickedDuck = findDuckAtWorldPosition(worldPosition);
  homesteadCanvasElement.setPointerCapture(event.pointerId);

  if (clickedDuck !== null) {
    selectedDuckId = clickedDuck.id;
    selectedUnplacedDuckId = null;
    setFollowSelectedDuck(true);
    centerCameraOnDuck(clickedDuck);
    resetDuckRoamState(clickedDuck.id);
    saveCameraState().catch(() => {});
    renderDuckDetails();
    renderCanvas();
    return;
  }

  stopFollowingForManualCameraInput();
  pointerDragState = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    lastClientX: event.clientX,
    lastClientY: event.clientY,
    startCamera: gameStateSnapshot.gameState.homesteadCamera,
    hasMoved: false
  };
  homesteadCanvasElement.classList.add("is-dragging");
}

function handleCanvasPointerMove(event: PointerEvent): void {
  if (activeCanvasPointerById.has(event.pointerId)) {
    activeCanvasPointerById.set(event.pointerId, event);
  }

  if (pinchZoomState !== null && gameStateSnapshot !== null) {
    const pointerA = activeCanvasPointerById.get(pinchZoomState.pointerIdA);
    const pointerB = activeCanvasPointerById.get(pinchZoomState.pointerIdB);

    if (pointerA !== undefined && pointerB !== undefined) {
      const nextDistance = Math.hypot(pointerA.clientX - pointerB.clientX, pointerA.clientY - pointerB.clientY);
      const centerClientX = (pointerA.clientX + pointerB.clientX) / 2;
      const centerClientY = (pointerA.clientY + pointerB.clientY) / 2;
      if (pinchZoomState.startDistance > 0) {
        updateLocalZoom(
          pinchZoomState.startCamera.zoom * (nextDistance / pinchZoomState.startDistance),
          centerClientX,
          centerClientY,
          pinchZoomState.startCamera
        );
      }
      renderCanvas();
    }

    return;
  }

  if (pointerDragState === null || pointerDragState.pointerId !== event.pointerId) {
    return;
  }

  const totalDeltaX = Math.abs(event.clientX - pointerDragState.startClientX);
  const totalDeltaY = Math.abs(event.clientY - pointerDragState.startClientY);
  pointerDragState.hasMoved = pointerDragState.hasMoved || totalDeltaX + totalDeltaY > 5;

  updateLocalCameraFromDrag(event);

  pointerDragState.lastClientX = event.clientX;
  pointerDragState.lastClientY = event.clientY;
  renderCanvas();
}

function handleCanvasPointerUp(event: PointerEvent): void {
  activeCanvasPointerById.delete(event.pointerId);
  pinchZoomState = null;

  if (pointerDragState === null || pointerDragState.pointerId !== event.pointerId) {
    if (activeCanvasPointerById.size === 0) {
      saveCameraState().catch(() => {});
    }
    return;
  }

  const endedDragState = pointerDragState;
  pointerDragState = null;
  homesteadCanvasElement.classList.remove("is-dragging");

  if (!endedDragState.hasMoved && selectedUnplacedDuckId !== null) {
    placeDuckAtWorldPosition(selectedUnplacedDuckId, getPointerWorldPosition(event)).catch(() => {
      showStatus("Placement failed.", true);
    });
  } else {
    saveCameraState().catch(() => {});
  }

  renderCanvas();
}

function simulateDuckMovement(deltaMilliseconds: number): void {
  if (activeTab !== "homestead" || gameStateSnapshot === null) {
    return;
  }

  const nowTimestampMilliseconds = Date.now();
  const simulationResult = simulateHomesteadDuckMovement({
    ducks: localDucks,
    roamStateById: duckRoamStateById,
    draggedDuckId: null,
    deltaMilliseconds,
    nowTimestampMilliseconds,
    random: Math.random
  });

  localDucks = simulationResult.ducks;
  duckRoamStateById = simulationResult.roamStateById;
  followSelectedDuckIfNeeded();
}

function animationLoop(timestampMilliseconds: number): void {
  const deltaMilliseconds =
    previousAnimationTimestampMilliseconds === 0
      ? 16
      : timestampMilliseconds - previousAnimationTimestampMilliseconds;
  previousAnimationTimestampMilliseconds = timestampMilliseconds;

  simulateDuckMovement(deltaMilliseconds);
  renderCanvas();

  if (timestampMilliseconds - lastSimulationSaveTimestampMilliseconds > SIMULATION_SAVE_INTERVAL_MILLISECONDS) {
    lastSimulationSaveTimestampMilliseconds = timestampMilliseconds;
    saveHomesteadState().catch(() => {});
  }

  animationFrameId = window.requestAnimationFrame(animationLoop);
}

function startAnimationLoop(): void {
  if (animationFrameId !== null) {
    return;
  }

  previousAnimationTimestampMilliseconds = 0;
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
  if (gameStateSnapshot === null) {
    return;
  }

  const saveCameraMessage: SaveHomesteadCameraMessage = {
    type: SAVE_HOMESTEAD_CAMERA_MESSAGE_TYPE,
    homesteadCamera: gameStateSnapshot.gameState.homesteadCamera
  };
  await sendGameRuntimeMessage(saveCameraMessage);
}

async function saveHomesteadState(): Promise<void> {
  if (gameStateSnapshot === null) {
    return;
  }

  const updateDuckSimulationStateMessage: UpdateDuckSimulationStateMessage = {
    type: UPDATE_DUCK_SIMULATION_STATE_MESSAGE_TYPE,
    updates: localDucks
      .filter((duck) => duck.placementStatus === "placed" && duck.position !== null)
      .map((duck): DuckSimulationStateUpdate => ({
        duckId: duck.id,
        position: duck.position ?? { x: 0, y: 0 },
        activity: duck.activity,
        facingDirection: duck.facingDirection,
        lastUpdatedAtTimestampMilliseconds: duck.lastUpdatedAtTimestampMilliseconds
      }))
  };
  await sendGameRuntimeMessage(updateDuckSimulationStateMessage);
  await saveCameraState();
}

async function handleRenameDuck(): Promise<void> {
  const selectedDuck = getSelectedDuck();

  if (selectedDuck === null) {
    return;
  }

  const renameDuckMessage: RenameDuckMessage = {
    type: RENAME_DUCK_MESSAGE_TYPE,
    duckId: selectedDuck.id,
    name: duckNameInputElement.value
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

renameDuckButtonElement.addEventListener("click", () => {
  handleRenameDuck().catch(() => {
    showStatus("Rename failed.", true);
  });
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
  const selectedDuck = getSelectedDuck();

  if (selectedDuck === null) {
    return;
  }

  setFollowSelectedDuck(!isFollowingSelectedDuck);

  if (isFollowingSelectedDuck) {
    centerCameraOnDuck(selectedDuck);
    saveCameraState().catch(() => {});
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
  stopFollowingForManualCameraInput();
  const zoomMultiplier = event.deltaY < 0 ? 1.1 : 0.9;
  updateLocalZoom(gameStateSnapshot.gameState.homesteadCamera.zoom * zoomMultiplier, event.clientX, event.clientY);
  saveCameraState().catch(() => {});
  renderDuckDetails();
  renderCanvas();
}, { passive: false });
homesteadCanvasElement.addEventListener("dragover", (event) => {
  event.preventDefault();
});
homesteadCanvasElement.addEventListener("drop", (event) => {
  event.preventDefault();
  const duckId = event.dataTransfer?.getData("text/plain") ?? selectedUnplacedDuckId;

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

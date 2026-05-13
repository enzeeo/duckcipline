import { MAX_DUCK_COUNT, getProjectDurationSeconds } from "../shared/balance.js";
import {
  applyCompletedFocusSessionToTotals,
  claimActiveProject,
  createDefaultGameState,
  feedDuck,
  migrateLegacyDuckRewardsState,
  normalizeGameState,
  renameDuck,
  saveHomesteadCamera,
  selectActiveProject,
  synchronizeGameProgressStateWithTimer,
  updateDuckPlacement,
  updateDuckSimulationState
} from "../shared/gameLogic.js";
import {
  PROJECT_DEFINITION_BY_ID,
  createProjectDefinitionResponses,
  isEggProjectId
} from "../shared/projectDefinitions.js";
import {
  CLAIM_ACTIVE_PROJECT_MESSAGE_TYPE,
  FEED_DUCK_MESSAGE_TYPE,
  GET_GAME_STATE_MESSAGE_TYPE,
  GET_TIMER_STATE_MESSAGE_TYPE,
  MOVE_DUCK_MESSAGE_TYPE,
  PAUSE_TIMER_MESSAGE_TYPE,
  PLACE_DUCK_MESSAGE_TYPE,
  RENAME_DUCK_MESSAGE_TYPE,
  RESET_TIMER_MESSAGE_TYPE,
  SAVE_HOMESTEAD_CAMERA_MESSAGE_TYPE,
  SELECT_PROJECT_MESSAGE_TYPE,
  START_TIMER_MESSAGE_TYPE,
  STOP_TIMER_MESSAGE_TYPE,
  UPDATE_DUCK_SIMULATION_STATE_MESSAGE_TYPE,
  isExtensionRequestMessage,
  type ExtensionRequestMessage
} from "../shared/messages.js";
import type {
  ErrorResponse,
  GameMessageResponse,
  GameState,
  GameStatusResponse,
  TimerMessageResponse,
  TimerState
} from "../shared/types.js";

const TIMER_STATE_STORAGE_KEY = "timerState";
const GAME_STATE_STORAGE_KEY = "gameState";
const LEGACY_DUCK_REWARDS_STATE_STORAGE_KEY = "duckRewardsState";
const DEFAULT_DURATION_SECONDS = 25 * 60;
const MILLISECONDS_PER_SECOND = 1000;

type ExtensionMessageResponse = TimerMessageResponse | GameMessageResponse;

interface CanonicalStateResult {
  timerState: TimerState;
  gameState: GameState;
}

function createErrorResponse(message: string): ErrorResponse {
  return { error: message };
}

function createTimerStatusResponse(
  isRunning: boolean,
  hasStartedAtLeastOnce: boolean,
  remainingSeconds: number,
  configuredDurationSeconds: number
): TimerMessageResponse {
  return {
    isRunning,
    hasStartedAtLeastOnce,
    remainingSeconds,
    configuredDurationSeconds
  };
}

function createGameStatusResponse(
  gameState: GameState,
  timerState: TimerState,
  nowTimestampMilliseconds: number,
  statusMessage: string | null
): GameStatusResponse {
  return {
    gameState: synchronizeGameProgressStateWithTimer(gameState, timerState, nowTimestampMilliseconds),
    projectDefinitions: createProjectDefinitionResponses(),
    maxDuckCount: MAX_DUCK_COUNT,
    nowTimestampMilliseconds,
    statusMessage
  };
}

function createDefaultTimerState(): TimerState {
  return {
    isRunning: false,
    hasStartedAtLeastOnce: false,
    configuredDurationSeconds: DEFAULT_DURATION_SECONDS,
    startedAtTimestampMilliseconds: null,
    remainingSecondsWhenNotRunning: DEFAULT_DURATION_SECONDS
  };
}

function isTimerState(value: unknown): value is TimerState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const possibleTimerState = value as Record<string, unknown>;
  const hasValidStartTimestamp =
    typeof possibleTimerState.startedAtTimestampMilliseconds === "number" ||
    possibleTimerState.startedAtTimestampMilliseconds === null;
  const hasValidStartHistory =
    typeof possibleTimerState.hasStartedAtLeastOnce === "boolean" ||
    typeof possibleTimerState.hasStartedAtLeastOnce === "undefined";

  return (
    typeof possibleTimerState.isRunning === "boolean" &&
    hasValidStartHistory &&
    typeof possibleTimerState.configuredDurationSeconds === "number" &&
    hasValidStartTimestamp &&
    typeof possibleTimerState.remainingSecondsWhenNotRunning === "number"
  );
}

function areGameStatesEqual(leftState: GameState, rightState: GameState): boolean {
  return JSON.stringify(leftState) === JSON.stringify(rightState);
}

function parseDurationSeconds(durationSecondsFromMessage: number): number {
  if (!Number.isFinite(durationSecondsFromMessage) || durationSecondsFromMessage < 1) {
    return DEFAULT_DURATION_SECONDS;
  }

  return Math.floor(durationSecondsFromMessage);
}

function calculateRemainingSecondsForRunningTimer(
  timerState: TimerState,
  nowTimestampMilliseconds: number
): number {
  if (!timerState.startedAtTimestampMilliseconds) {
    return timerState.configuredDurationSeconds;
  }

  const elapsedMilliseconds = nowTimestampMilliseconds - timerState.startedAtTimestampMilliseconds;
  const elapsedSeconds = Math.floor(elapsedMilliseconds / MILLISECONDS_PER_SECOND);
  return Math.max(0, timerState.configuredDurationSeconds - elapsedSeconds);
}

function calculateStartedAtTimestampMillisecondsForResumedTimer(
  timerState: TimerState,
  nowTimestampMilliseconds: number
): number {
  const elapsedSecondsBeforePause =
    timerState.configuredDurationSeconds - timerState.remainingSecondsWhenNotRunning;
  const elapsedMillisecondsBeforePause = Math.max(0, elapsedSecondsBeforePause) * MILLISECONDS_PER_SECOND;

  return nowTimestampMilliseconds - elapsedMillisecondsBeforePause;
}

async function configureSidePanelBehavior(): Promise<void> {
  if (!chrome.sidePanel || !chrome.sidePanel.setPanelBehavior) {
    return;
  }

  await chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
}

async function openSidePanelForTab(tab: chrome.tabs.Tab | undefined): Promise<void> {
  if (!chrome.sidePanel || !chrome.sidePanel.open) {
    return;
  }

  const windowIdentifier = tab?.windowId;

  if (typeof windowIdentifier !== "number" || !Number.isInteger(windowIdentifier)) {
    return;
  }

  await chrome.sidePanel.open({
    windowId: windowIdentifier
  });
}

async function readTimerStateFromSessionStorage(): Promise<TimerState> {
  const storageValues = await chrome.storage.session.get(TIMER_STATE_STORAGE_KEY);
  const storedTimerState = storageValues[TIMER_STATE_STORAGE_KEY];

  if (!isTimerState(storedTimerState)) {
    return createDefaultTimerState();
  }

  return {
    ...createDefaultTimerState(),
    ...storedTimerState
  };
}

async function writeTimerStateToSessionStorage(timerState: TimerState): Promise<void> {
  await chrome.storage.session.set({
    [TIMER_STATE_STORAGE_KEY]: timerState
  });
}

async function readGameStateFromLocalStorage(nowTimestampMilliseconds: number): Promise<GameState> {
  const storageValues = await chrome.storage.local.get([
    GAME_STATE_STORAGE_KEY,
    LEGACY_DUCK_REWARDS_STATE_STORAGE_KEY
  ]);
  const storedGameState = storageValues[GAME_STATE_STORAGE_KEY];

  if (storedGameState !== undefined) {
    return normalizeGameState(storedGameState, nowTimestampMilliseconds);
  }

  const migratedLegacyState = migrateLegacyDuckRewardsState(
    storageValues[LEGACY_DUCK_REWARDS_STATE_STORAGE_KEY],
    nowTimestampMilliseconds
  );

  if (migratedLegacyState !== null) {
    return migratedLegacyState;
  }

  return createDefaultGameState();
}

async function writeGameStateToLocalStorage(gameState: GameState): Promise<void> {
  await chrome.storage.local.set({
    [GAME_STATE_STORAGE_KEY]: gameState
  });
}

async function getCanonicalTimerAndGameState(nowTimestampMilliseconds: number): Promise<CanonicalStateResult> {
  let timerState = await readTimerStateFromSessionStorage();
  let gameState = await readGameStateFromLocalStorage(nowTimestampMilliseconds);

  let hasTimerStateChanged = false;
  let hasGameStateChanged = false;

  if (timerState.isRunning) {
    const remainingSeconds = calculateRemainingSecondsForRunningTimer(timerState, nowTimestampMilliseconds);

    if (remainingSeconds < 1) {
      timerState = {
        ...timerState,
        isRunning: false,
        startedAtTimestampMilliseconds: null,
        remainingSecondsWhenNotRunning: 0
      };
      gameState = applyCompletedFocusSessionToTotals(gameState, timerState.configuredDurationSeconds);
      hasTimerStateChanged = true;
      hasGameStateChanged = true;
    }
  }

  const synchronizedGameState = synchronizeGameProgressStateWithTimer(
    gameState,
    timerState,
    nowTimestampMilliseconds
  );

  if (!areGameStatesEqual(gameState, synchronizedGameState)) {
    gameState = synchronizedGameState;
    hasGameStateChanged = true;
  }

  if (hasTimerStateChanged) {
    await writeTimerStateToSessionStorage(timerState);
  }

  if (hasGameStateChanged) {
    await writeGameStateToLocalStorage(gameState);
  }

  return { timerState, gameState };
}

async function startTimer(durationSecondsFromMessage: number): Promise<TimerMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);

  if (canonicalStateResult.gameState.activeProjectId === null) {
    return createErrorResponse("Pick a project before starting focus.");
  }

  const activeProjectProgress =
    canonicalStateResult.gameState.projectProgressById[canonicalStateResult.gameState.activeProjectId];

  if (activeProjectProgress?.isReadyToClaim) {
    return createErrorResponse("Claim or change the ready project before starting.");
  }

  if (canonicalStateResult.timerState.isRunning) {
    return createTimerStatusResponse(
      true,
      canonicalStateResult.timerState.hasStartedAtLeastOnce,
      calculateRemainingSecondsForRunningTimer(canonicalStateResult.timerState, nowTimestampMilliseconds),
      canonicalStateResult.timerState.configuredDurationSeconds
    );
  }

  const shouldResumePausedTimer =
    canonicalStateResult.timerState.hasStartedAtLeastOnce &&
    canonicalStateResult.timerState.remainingSecondsWhenNotRunning > 0;

  const updatedTimerState: TimerState = shouldResumePausedTimer
    ? {
        ...canonicalStateResult.timerState,
        isRunning: true,
        startedAtTimestampMilliseconds: calculateStartedAtTimestampMillisecondsForResumedTimer(
          canonicalStateResult.timerState,
          nowTimestampMilliseconds
        )
      }
    : {
        isRunning: true,
        hasStartedAtLeastOnce: true,
        configuredDurationSeconds: parseDurationSeconds(durationSecondsFromMessage),
        startedAtTimestampMilliseconds: nowTimestampMilliseconds,
        remainingSecondsWhenNotRunning: parseDurationSeconds(durationSecondsFromMessage)
      };

  await writeTimerStateToSessionStorage(updatedTimerState);

  const synchronizedGameState = synchronizeGameProgressStateWithTimer(
    canonicalStateResult.gameState,
    updatedTimerState,
    nowTimestampMilliseconds
  );

  if (!areGameStatesEqual(canonicalStateResult.gameState, synchronizedGameState)) {
    await writeGameStateToLocalStorage(synchronizedGameState);
  }

  return createTimerStatusResponse(
    true,
    updatedTimerState.hasStartedAtLeastOnce,
    updatedTimerState.remainingSecondsWhenNotRunning,
    updatedTimerState.configuredDurationSeconds
  );
}

async function stopRunningTimerIfActive(nowTimestampMilliseconds: number): Promise<TimerState> {
  const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);

  if (!canonicalStateResult.timerState.isRunning) {
    return canonicalStateResult.timerState;
  }

  const remainingSecondsWhenStopped = calculateRemainingSecondsForRunningTimer(
    canonicalStateResult.timerState,
    nowTimestampMilliseconds
  );
  const stoppedTimerState: TimerState = {
    ...canonicalStateResult.timerState,
    isRunning: false,
    startedAtTimestampMilliseconds: null,
    remainingSecondsWhenNotRunning: remainingSecondsWhenStopped
  };

  await writeTimerStateToSessionStorage(stoppedTimerState);

  const synchronizedGameState = synchronizeGameProgressStateWithTimer(
    canonicalStateResult.gameState,
    stoppedTimerState,
    nowTimestampMilliseconds
  );

  if (!areGameStatesEqual(canonicalStateResult.gameState, synchronizedGameState)) {
    await writeGameStateToLocalStorage(synchronizedGameState);
  }

  return stoppedTimerState;
}

async function pauseTimer(): Promise<TimerMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const stoppedTimerState = await stopRunningTimerIfActive(nowTimestampMilliseconds);

  return createTimerStatusResponse(
    false,
    stoppedTimerState.hasStartedAtLeastOnce,
    stoppedTimerState.remainingSecondsWhenNotRunning,
    stoppedTimerState.configuredDurationSeconds
  );
}

async function resetTimer(durationSecondsFromMessage: number): Promise<TimerMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);

  const resetDurationSeconds = canonicalStateResult.timerState.hasStartedAtLeastOnce
    ? canonicalStateResult.timerState.configuredDurationSeconds
    : parseDurationSeconds(durationSecondsFromMessage);
  const resetTimerState: TimerState = {
    isRunning: false,
    hasStartedAtLeastOnce: false,
    configuredDurationSeconds: resetDurationSeconds,
    startedAtTimestampMilliseconds: null,
    remainingSecondsWhenNotRunning: resetDurationSeconds
  };

  await writeTimerStateToSessionStorage(resetTimerState);

  const synchronizedGameState = synchronizeGameProgressStateWithTimer(
    canonicalStateResult.gameState,
    resetTimerState,
    nowTimestampMilliseconds
  );

  if (!areGameStatesEqual(canonicalStateResult.gameState, synchronizedGameState)) {
    await writeGameStateToLocalStorage(synchronizedGameState);
  }

  return createTimerStatusResponse(
    false,
    resetTimerState.hasStartedAtLeastOnce,
    resetTimerState.remainingSecondsWhenNotRunning,
    resetTimerState.configuredDurationSeconds
  );
}

async function getTimerStateMessageResponse(): Promise<TimerMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);

  if (!canonicalStateResult.timerState.isRunning) {
    return createTimerStatusResponse(
      false,
      canonicalStateResult.timerState.hasStartedAtLeastOnce,
      canonicalStateResult.timerState.remainingSecondsWhenNotRunning,
      canonicalStateResult.timerState.configuredDurationSeconds
    );
  }

  return createTimerStatusResponse(
    true,
    canonicalStateResult.timerState.hasStartedAtLeastOnce,
    calculateRemainingSecondsForRunningTimer(canonicalStateResult.timerState, nowTimestampMilliseconds),
    canonicalStateResult.timerState.configuredDurationSeconds
  );
}

async function getGameStateMessageResponse(statusMessage: string | null = null): Promise<GameMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);

  return createGameStatusResponse(
    canonicalStateResult.gameState,
    canonicalStateResult.timerState,
    nowTimestampMilliseconds,
    statusMessage
  );
}

async function selectProject(projectId: string): Promise<GameMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);

  if (canonicalStateResult.timerState.isRunning) {
    return createErrorResponse("Pause focus before changing projects.");
  }

  const projectDefinition = PROJECT_DEFINITION_BY_ID[projectId as keyof typeof PROJECT_DEFINITION_BY_ID];

  if (projectDefinition.type === "egg" && canonicalStateResult.gameState.ducks.length >= MAX_DUCK_COUNT) {
    return createErrorResponse("Duck cap reached. Egg projects are disabled.");
  }

  const updatedGameState = selectActiveProject(canonicalStateResult.gameState, projectDefinition.id);
  await writeGameStateToLocalStorage(updatedGameState);

  return createGameStatusResponse(
    updatedGameState,
    canonicalStateResult.timerState,
    nowTimestampMilliseconds,
    `${projectDefinition.displayName} selected.`
  );
}

async function claimProject(): Promise<GameMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);

  if (canonicalStateResult.timerState.isRunning) {
    return createErrorResponse("Pause focus before claiming.");
  }

  const result = claimActiveProject(canonicalStateResult.gameState, nowTimestampMilliseconds);

  if (!areGameStatesEqual(canonicalStateResult.gameState, result.gameState)) {
    await writeGameStateToLocalStorage(result.gameState);
  }

  return createGameStatusResponse(
    result.gameState,
    canonicalStateResult.timerState,
    nowTimestampMilliseconds,
    result.statusMessage
  );
}

async function updateGameWithResult(resultGameState: GameState, statusMessage: string | null): Promise<GameMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const timerState = await readTimerStateFromSessionStorage();
  await writeGameStateToLocalStorage(resultGameState);

  return createGameStatusResponse(resultGameState, timerState, nowTimestampMilliseconds, statusMessage);
}

async function renameDuckById(duckId: string, name: string): Promise<GameMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);
  const result = renameDuck(canonicalStateResult.gameState, duckId, name);
  return updateGameWithResult(result.gameState, result.statusMessage);
}

async function feedDuckById(duckId: string, feedMode: "single" | "toNextStage"): Promise<GameMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);
  const result = feedDuck(canonicalStateResult.gameState, duckId, feedMode, nowTimestampMilliseconds);
  return updateGameWithResult(result.gameState, result.statusMessage);
}

async function placeDuckById(duckId: string, x: number, y: number): Promise<GameMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);
  const result = updateDuckPlacement(canonicalStateResult.gameState, duckId, { x, y }, nowTimestampMilliseconds);
  return updateGameWithResult(result.gameState, result.statusMessage);
}

async function saveSimulationDucks(ducks: GameState["ducks"]): Promise<GameMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);
  const updatedGameState = updateDuckSimulationState(canonicalStateResult.gameState, ducks);
  return updateGameWithResult(updatedGameState, null);
}

async function saveCamera(homesteadCamera: GameState["homesteadCamera"]): Promise<GameMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);
  const updatedGameState = saveHomesteadCamera(canonicalStateResult.gameState, homesteadCamera);
  return updateGameWithResult(updatedGameState, null);
}

async function stopRunningTimerIfNoNormalWindowsRemain(): Promise<void> {
  const normalBrowserWindows = await chrome.windows.getAll({
    windowTypes: ["normal"]
  });

  if (normalBrowserWindows.length > 0) {
    return;
  }

  await stopRunningTimerIfActive(Date.now());
}

async function handleExtensionRequestMessage(
  message: ExtensionRequestMessage
): Promise<ExtensionMessageResponse> {
  if (message.type === START_TIMER_MESSAGE_TYPE) {
    return startTimer(message.durationSeconds);
  }

  if (message.type === PAUSE_TIMER_MESSAGE_TYPE || message.type === STOP_TIMER_MESSAGE_TYPE) {
    return pauseTimer();
  }

  if (message.type === RESET_TIMER_MESSAGE_TYPE) {
    return resetTimer(message.durationSeconds);
  }

  if (message.type === GET_TIMER_STATE_MESSAGE_TYPE) {
    return getTimerStateMessageResponse();
  }

  if (message.type === GET_GAME_STATE_MESSAGE_TYPE) {
    return getGameStateMessageResponse();
  }

  if (message.type === SELECT_PROJECT_MESSAGE_TYPE) {
    return selectProject(message.projectId);
  }

  if (message.type === CLAIM_ACTIVE_PROJECT_MESSAGE_TYPE) {
    return claimProject();
  }

  if (message.type === RENAME_DUCK_MESSAGE_TYPE) {
    return renameDuckById(message.duckId, message.name);
  }

  if (message.type === FEED_DUCK_MESSAGE_TYPE) {
    return feedDuckById(message.duckId, message.feedMode);
  }

  if (message.type === PLACE_DUCK_MESSAGE_TYPE || message.type === MOVE_DUCK_MESSAGE_TYPE) {
    return placeDuckById(message.duckId, message.x, message.y);
  }

  if (message.type === UPDATE_DUCK_SIMULATION_STATE_MESSAGE_TYPE) {
    return saveSimulationDucks(message.ducks);
  }

  if (message.type === SAVE_HOMESTEAD_CAMERA_MESSAGE_TYPE) {
    return saveCamera(message.homesteadCamera);
  }

  return createErrorResponse("Unknown message type.");
}

configureSidePanelBehavior().catch((error: unknown) => {
  console.error("Failed to configure side panel behavior on service worker load.", error);
});

chrome.runtime.onInstalled.addListener(async () => {
  await configureSidePanelBehavior();
  await writeTimerStateToSessionStorage(await readTimerStateFromSessionStorage());
  await writeGameStateToLocalStorage(await readGameStateFromLocalStorage(Date.now()));
});

chrome.runtime.onStartup.addListener(async () => {
  await configureSidePanelBehavior();
});

chrome.windows.onRemoved.addListener(() => {
  stopRunningTimerIfNoNormalWindowsRemain().catch((error: unknown) => {
    console.error("Failed to stop timer after closing Chrome windows.", error);
  });
});

chrome.action.onClicked.addListener((tab) => {
  openSidePanelForTab(tab).catch((error: unknown) => {
    console.error("Failed to open side panel from toolbar click.", error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isExtensionRequestMessage(message)) {
    sendResponse(createErrorResponse("Invalid message."));
    return;
  }

  handleExtensionRequestMessage(message)
    .then((messageResponse) => {
      sendResponse(messageResponse);
    })
    .catch((error: unknown) => {
      if (error instanceof Error) {
        sendResponse(createErrorResponse(error.message));
        return;
      }

      sendResponse(createErrorResponse("Unexpected error."));
    });

  return true;
});

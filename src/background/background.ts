import {
  GET_DUCK_REWARDS_STATE_MESSAGE_TYPE,
  GET_TIMER_STATE_MESSAGE_TYPE,
  PAUSE_TIMER_MESSAGE_TYPE,
  RESET_TIMER_MESSAGE_TYPE,
  SELECT_DUCK_REWARD_ITEM_MESSAGE_TYPE,
  START_TIMER_MESSAGE_TYPE,
  STOP_TIMER_MESSAGE_TYPE,
  isExtensionRequestMessage,
  type ExtensionRequestMessage
} from "../shared/messages.js";
import type {
  Duck,
  DuckRewardItemId,
  DuckRewardsMessageResponse,
  DuckRewardsState,
  DuckRewardsStatusResponse,
  ErrorResponse,
  TimerMessageResponse,
  TimerState
} from "../shared/types.js";

const TIMER_STATE_STORAGE_KEY = "timerState";
const DUCK_REWARDS_STATE_STORAGE_KEY = "duckRewardsState";
const DEFAULT_DURATION_SECONDS = 25 * 60;
const MILLISECONDS_PER_SECOND = 1000;

const DUCK_EGG_ONE_REQUIRED_SECONDS_FOR_HATCH = 2;
const DUCK_EGG_TWO_REQUIRED_SECONDS_FOR_HATCH = 3;

const REQUIRED_SECONDS_BY_DUCK_REWARD_ITEM_ID: Record<DuckRewardItemId, number> = {
  duckEgg1: DUCK_EGG_ONE_REQUIRED_SECONDS_FOR_HATCH,
  duckEgg2: DUCK_EGG_TWO_REQUIRED_SECONDS_FOR_HATCH
};

type ExtensionMessageResponse = TimerMessageResponse | DuckRewardsMessageResponse;

function createErrorResponse(message: string): ErrorResponse {
  return { error: message };
}

function createTimerStatusResponse(
  isRunning: boolean,
  hasStartedAtLeastOnce: boolean,
  remainingSeconds: number
): TimerMessageResponse {
  return {
    isRunning,
    hasStartedAtLeastOnce,
    remainingSeconds
  };
}

function createDuckRewardsStatusResponse(duckRewardsState: DuckRewardsState): DuckRewardsStatusResponse {
  return {
    selectedDuckRewardItemId: duckRewardsState.selectedDuckRewardItemId,
    selectedDuckRewardItemProgressSeconds: duckRewardsState.selectedDuckRewardItemProgressSeconds,
    ducks: duckRewardsState.ducks,
    totalCompletedSessions: duckRewardsState.totalCompletedSessions,
    totalCompletedFocusSeconds: duckRewardsState.totalCompletedFocusSeconds,
    requiredSecondsByDuckRewardItemId: REQUIRED_SECONDS_BY_DUCK_REWARD_ITEM_ID
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

function createDefaultDuckRewardsState(): DuckRewardsState {
  return {
    selectedDuckRewardItemId: null,
    selectedDuckRewardItemProgressSeconds: 0,
    ducks: [],
    totalCompletedSessions: 0,
    totalCompletedFocusSeconds: 0
  };
}

function isDuckRewardItemId(value: unknown): value is DuckRewardItemId {
  return value === "duckEgg1" || value === "duckEgg2";
}

function isDuck(value: unknown): value is Duck {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const possibleDuck = value as Record<string, unknown>;

  return (
    typeof possibleDuck.id === "string" &&
    isDuckRewardItemId(possibleDuck.sourceDuckRewardItemId) &&
    typeof possibleDuck.hatchedAtTimestampMilliseconds === "number"
  );
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

function isDuckRewardsState(value: unknown): value is DuckRewardsState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const possibleDuckRewardsState = value as Record<string, unknown>;

  const hasValidSelectedRewardItemId =
    possibleDuckRewardsState.selectedDuckRewardItemId === null ||
    isDuckRewardItemId(possibleDuckRewardsState.selectedDuckRewardItemId);

  return (
    hasValidSelectedRewardItemId &&
    typeof possibleDuckRewardsState.selectedDuckRewardItemProgressSeconds === "number" &&
    Array.isArray(possibleDuckRewardsState.ducks) &&
    possibleDuckRewardsState.ducks.every((duck) => isDuck(duck)) &&
    typeof possibleDuckRewardsState.totalCompletedSessions === "number" &&
    typeof possibleDuckRewardsState.totalCompletedFocusSeconds === "number"
  );
}

function createDuck(sourceDuckRewardItemId: DuckRewardItemId): Duck {
  return {
    id: crypto.randomUUID(),
    sourceDuckRewardItemId,
    hatchedAtTimestampMilliseconds: Date.now()
  };
}

function parseDurationSeconds(durationSecondsFromMessage: number): number {
  if (!Number.isFinite(durationSecondsFromMessage)) {
    return DEFAULT_DURATION_SECONDS;
  }

  if (durationSecondsFromMessage < 1) {
    return DEFAULT_DURATION_SECONDS;
  }

  return Math.floor(durationSecondsFromMessage);
}

function parseCompletedFocusSessionSeconds(completedFocusSessionSeconds: number): number {
  if (!Number.isFinite(completedFocusSessionSeconds)) {
    return 0;
  }

  if (completedFocusSessionSeconds < 1) {
    return 0;
  }

  return Math.floor(completedFocusSessionSeconds);
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
  const remainingSeconds = timerState.configuredDurationSeconds - elapsedSeconds;

  if (remainingSeconds < 0) {
    return 0;
  }

  return remainingSeconds;
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

  if (typeof windowIdentifier !== "number") {
    return;
  }

  if (!Number.isInteger(windowIdentifier)) {
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

async function readDuckRewardsStateFromLocalStorage(): Promise<DuckRewardsState> {
  const storageValues = await chrome.storage.local.get(DUCK_REWARDS_STATE_STORAGE_KEY);
  const storedDuckRewardsState = storageValues[DUCK_REWARDS_STATE_STORAGE_KEY];

  if (!isDuckRewardsState(storedDuckRewardsState)) {
    return createDefaultDuckRewardsState();
  }

  return {
    ...createDefaultDuckRewardsState(),
    ...storedDuckRewardsState
  };
}

async function writeDuckRewardsStateToLocalStorage(duckRewardsState: DuckRewardsState): Promise<void> {
  await chrome.storage.local.set({
    [DUCK_REWARDS_STATE_STORAGE_KEY]: duckRewardsState
  });
}

async function applyCompletedFocusSessionToDuckRewards(completedFocusSessionSeconds: number): Promise<void> {
  const sanitizedCompletedFocusSessionSeconds = parseCompletedFocusSessionSeconds(completedFocusSessionSeconds);

  if (sanitizedCompletedFocusSessionSeconds < 1) {
    return;
  }

  const duckRewardsState = await readDuckRewardsStateFromLocalStorage();

  const updatedDuckRewardsState: DuckRewardsState = {
    ...duckRewardsState,
    totalCompletedSessions: duckRewardsState.totalCompletedSessions + 1,
    totalCompletedFocusSeconds: duckRewardsState.totalCompletedFocusSeconds + sanitizedCompletedFocusSessionSeconds
  };

  if (!updatedDuckRewardsState.selectedDuckRewardItemId) {
    await writeDuckRewardsStateToLocalStorage(updatedDuckRewardsState);
    return;
  }

  const selectedDuckRewardItemId = updatedDuckRewardsState.selectedDuckRewardItemId;
  const requiredSecondsForHatch = REQUIRED_SECONDS_BY_DUCK_REWARD_ITEM_ID[selectedDuckRewardItemId];

  let updatedProgressSeconds =
    updatedDuckRewardsState.selectedDuckRewardItemProgressSeconds + sanitizedCompletedFocusSessionSeconds;
  const updatedDucks = [...updatedDuckRewardsState.ducks];

  while (updatedProgressSeconds >= requiredSecondsForHatch) {
    updatedProgressSeconds -= requiredSecondsForHatch;
    updatedDucks.push(createDuck(selectedDuckRewardItemId));
  }

  await writeDuckRewardsStateToLocalStorage({
    ...updatedDuckRewardsState,
    selectedDuckRewardItemProgressSeconds: updatedProgressSeconds,
    ducks: updatedDucks
  });
}

async function getCanonicalTimerState(): Promise<TimerState> {
  const nowTimestampMilliseconds = Date.now();
  const timerState = await readTimerStateFromSessionStorage();

  if (!timerState.isRunning) {
    return timerState;
  }

  const remainingSeconds = calculateRemainingSecondsForRunningTimer(timerState, nowTimestampMilliseconds);

  if (remainingSeconds > 0) {
    return timerState;
  }

  const completedTimerState: TimerState = {
    ...timerState,
    isRunning: false,
    startedAtTimestampMilliseconds: null,
    remainingSecondsWhenNotRunning: 0
  };

  await writeTimerStateToSessionStorage(completedTimerState);
  await applyCompletedFocusSessionToDuckRewards(timerState.configuredDurationSeconds);

  return completedTimerState;
}

async function startTimer(durationSecondsFromMessage: number): Promise<TimerMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const timerState = await readTimerStateFromSessionStorage();

  if (timerState.isRunning) {
    const remainingSeconds = calculateRemainingSecondsForRunningTimer(timerState, nowTimestampMilliseconds);
    return createTimerStatusResponse(true, timerState.hasStartedAtLeastOnce, remainingSeconds);
  }

  const shouldResumePausedTimer =
    timerState.hasStartedAtLeastOnce && timerState.remainingSecondsWhenNotRunning > 0;

  if (shouldResumePausedTimer) {
    const resumedTimerState: TimerState = {
      ...timerState,
      isRunning: true,
      startedAtTimestampMilliseconds: calculateStartedAtTimestampMillisecondsForResumedTimer(
        timerState,
        nowTimestampMilliseconds
      )
    };

    await writeTimerStateToSessionStorage(resumedTimerState);

    return createTimerStatusResponse(
      true,
      resumedTimerState.hasStartedAtLeastOnce,
      resumedTimerState.remainingSecondsWhenNotRunning
    );
  }

  const durationSeconds = parseDurationSeconds(durationSecondsFromMessage);
  const startedTimerState: TimerState = {
    isRunning: true,
    hasStartedAtLeastOnce: true,
    configuredDurationSeconds: durationSeconds,
    startedAtTimestampMilliseconds: nowTimestampMilliseconds,
    remainingSecondsWhenNotRunning: durationSeconds
  };

  await writeTimerStateToSessionStorage(startedTimerState);

  return createTimerStatusResponse(true, startedTimerState.hasStartedAtLeastOnce, durationSeconds);
}

async function pauseTimer(): Promise<TimerMessageResponse> {
  const timerState = await readTimerStateFromSessionStorage();

  if (!timerState.isRunning) {
    return createTimerStatusResponse(
      false,
      timerState.hasStartedAtLeastOnce,
      timerState.remainingSecondsWhenNotRunning
    );
  }

  const remainingSecondsWhenStopped = calculateRemainingSecondsForRunningTimer(timerState, Date.now());
  const stoppedTimerState: TimerState = {
    ...timerState,
    isRunning: false,
    startedAtTimestampMilliseconds: null,
    remainingSecondsWhenNotRunning: remainingSecondsWhenStopped
  };

  await writeTimerStateToSessionStorage(stoppedTimerState);

  return createTimerStatusResponse(
    false,
    stoppedTimerState.hasStartedAtLeastOnce,
    stoppedTimerState.remainingSecondsWhenNotRunning
  );
}

async function resetTimer(durationSecondsFromMessage: number): Promise<TimerMessageResponse> {
  const durationSeconds = parseDurationSeconds(durationSecondsFromMessage);
  const resetTimerState: TimerState = {
    isRunning: false,
    hasStartedAtLeastOnce: false,
    configuredDurationSeconds: durationSeconds,
    startedAtTimestampMilliseconds: null,
    remainingSecondsWhenNotRunning: durationSeconds
  };

  await writeTimerStateToSessionStorage(resetTimerState);

  return createTimerStatusResponse(false, resetTimerState.hasStartedAtLeastOnce, durationSeconds);
}

async function getTimerStateMessageResponse(): Promise<TimerMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const timerState = await getCanonicalTimerState();

  if (!timerState.isRunning) {
    return createTimerStatusResponse(
      false,
      timerState.hasStartedAtLeastOnce,
      timerState.remainingSecondsWhenNotRunning
    );
  }

  const remainingSeconds = calculateRemainingSecondsForRunningTimer(timerState, nowTimestampMilliseconds);

  if (remainingSeconds < 1) {
    const completedTimerState: TimerState = {
      ...timerState,
      isRunning: false,
      startedAtTimestampMilliseconds: null,
      remainingSecondsWhenNotRunning: 0
    };

    await writeTimerStateToSessionStorage(completedTimerState);

    return createTimerStatusResponse(false, completedTimerState.hasStartedAtLeastOnce, 0);
  }

  return createTimerStatusResponse(true, timerState.hasStartedAtLeastOnce, remainingSeconds);
}

async function getDuckRewardsStateMessageResponse(): Promise<DuckRewardsMessageResponse> {
  const duckRewardsState = await readDuckRewardsStateFromLocalStorage();
  return createDuckRewardsStatusResponse(duckRewardsState);
}

async function selectDuckRewardItem(duckRewardItemId: DuckRewardItemId): Promise<DuckRewardsMessageResponse> {
  const duckRewardsState = await readDuckRewardsStateFromLocalStorage();
  const hasSelectedDifferentDuckRewardItemId = duckRewardsState.selectedDuckRewardItemId !== duckRewardItemId;

  const updatedDuckRewardsState: DuckRewardsState = {
    ...duckRewardsState,
    selectedDuckRewardItemId: duckRewardItemId,
    selectedDuckRewardItemProgressSeconds: hasSelectedDifferentDuckRewardItemId
      ? 0
      : duckRewardsState.selectedDuckRewardItemProgressSeconds
  };

  await writeDuckRewardsStateToLocalStorage(updatedDuckRewardsState);

  return createDuckRewardsStatusResponse(updatedDuckRewardsState);
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

  if (message.type === GET_DUCK_REWARDS_STATE_MESSAGE_TYPE) {
    return getDuckRewardsStateMessageResponse();
  }

  if (message.type === SELECT_DUCK_REWARD_ITEM_MESSAGE_TYPE) {
    return selectDuckRewardItem(message.duckRewardItemId);
  }

  return createErrorResponse("Unknown message type.");
}

configureSidePanelBehavior().catch((error: unknown) => {
  console.error("Failed to configure side panel behavior on service worker load.", error);
});

chrome.runtime.onInstalled.addListener(async () => {
  await configureSidePanelBehavior();

  const timerState = await readTimerStateFromSessionStorage();
  await writeTimerStateToSessionStorage(timerState);

  const duckRewardsState = await readDuckRewardsStateFromLocalStorage();
  await writeDuckRewardsStateToLocalStorage(duckRewardsState);
});

chrome.runtime.onStartup.addListener(async () => {
  await configureSidePanelBehavior();
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

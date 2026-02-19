import {
  GET_TIMER_STATE_MESSAGE_TYPE,
  PAUSE_TIMER_MESSAGE_TYPE,
  RESET_TIMER_MESSAGE_TYPE,
  START_TIMER_MESSAGE_TYPE,
  STOP_TIMER_MESSAGE_TYPE,
  isTimerRequestMessage,
  type TimerRequestMessage
} from "../shared/messages.js";
import type { TimerMessageResponse, TimerState } from "../shared/types.js";

const TIMER_STATE_STORAGE_KEY = "timerState";
const DEFAULT_DURATION_SECONDS = 25 * 60;
const MILLISECONDS_PER_SECOND = 1000;

function createErrorResponse(message: string): TimerMessageResponse {
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
  return completedTimerState;
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

async function startTimer(durationSecondsFromMessage: number): Promise<TimerMessageResponse> {
  const timerState = await readTimerStateFromSessionStorage();

  if (timerState.isRunning) {
    const remainingSeconds = calculateRemainingSecondsForRunningTimer(timerState, Date.now());
    return createTimerStatusResponse(true, timerState.hasStartedAtLeastOnce, remainingSeconds);
  }

  const shouldResumePausedTimer =
    timerState.hasStartedAtLeastOnce && timerState.remainingSecondsWhenNotRunning > 0;

  const durationSeconds = shouldResumePausedTimer
    ? timerState.remainingSecondsWhenNotRunning
    : parseDurationSeconds(durationSecondsFromMessage);

  const startedTimerState: TimerState = {
    isRunning: true,
    hasStartedAtLeastOnce: true,
    configuredDurationSeconds: durationSeconds,
    startedAtTimestampMilliseconds: Date.now(),
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

async function handleTimerRequestMessage(message: TimerRequestMessage): Promise<TimerMessageResponse> {
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

  return createErrorResponse("Unknown message type.");
}

configureSidePanelBehavior().catch((error: unknown) => {
  console.error("Failed to configure side panel behavior on service worker load.", error);
});

chrome.runtime.onInstalled.addListener(async () => {
  await configureSidePanelBehavior();
  const timerState = await readTimerStateFromSessionStorage();
  await writeTimerStateToSessionStorage(timerState);
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
  if (!isTimerRequestMessage(message)) {
    sendResponse(createErrorResponse("Invalid message."));
    return;
  }

  handleTimerRequestMessage(message)
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

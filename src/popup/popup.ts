import {
  GET_TIMER_STATE_MESSAGE_TYPE,
  PAUSE_TIMER_MESSAGE_TYPE,
  RESET_TIMER_MESSAGE_TYPE,
  START_TIMER_MESSAGE_TYPE,
  isTimerMessageResponse,
  type GetTimerStateMessage,
  type PauseTimerMessage,
  type ResetTimerMessage,
  type StartTimerMessage,
  type TimerRequestMessage
} from "../shared/messages.js";
import type { TimerMessageResponse } from "../shared/types.js";

const UPDATE_INTERVAL_MILLISECONDS = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const PRESET_TWENTY_FIVE_MINUTES = 25;
const PRESET_FIFTY_MINUTES = 50;
const DEFAULT_CUSTOM_DURATION_MINUTES = PRESET_TWENTY_FIVE_MINUTES;

type DurationSelectionMode = "twentyFive" | "fifty" | "custom";

function getRequiredParagraphElement(elementId: string): HTMLParagraphElement {
  const element = document.getElementById(elementId);

  if (!(element instanceof HTMLParagraphElement)) {
    throw new Error(`Required paragraph element not found: ${elementId}`);
  }

  return element;
}

function getRequiredInputElement(elementId: string): HTMLInputElement {
  const element = document.getElementById(elementId);

  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Required input element not found: ${elementId}`);
  }

  return element;
}

function getRequiredButtonElement(elementId: string): HTMLButtonElement {
  const element = document.getElementById(elementId);

  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Required button element not found: ${elementId}`);
  }

  return element;
}

const timerDisplayElement = getRequiredParagraphElement("timerDisplay");
const timerStatusElement = getRequiredParagraphElement("timerStatus");
const durationMinutesInputElement = getRequiredInputElement("durationMinutesInput");
const presetTwentyFiveMinutesButtonElement = getRequiredButtonElement("presetTwentyFiveMinutesButton");
const presetFiftyMinutesButtonElement = getRequiredButtonElement("presetFiftyMinutesButton");
const presetCustomDurationButtonElement = getRequiredButtonElement("presetCustomDurationButton");
const startButtonElement = getRequiredButtonElement("startButton");
const pauseButtonElement = getRequiredButtonElement("pauseButton");
const resetButtonElement = getRequiredButtonElement("resetButton");

let selectedDurationSelectionMode: DurationSelectionMode = "twentyFive";

function createErrorResponse(message: string): TimerMessageResponse {
  return { error: message };
}

function padTimeSegment(segmentValue: number): string {
  return String(segmentValue).padStart(2, "0");
}

function formatAsHoursMinutesSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / (MINUTES_PER_HOUR * SECONDS_PER_MINUTE));
  const minutes = Math.floor((totalSeconds % (MINUTES_PER_HOUR * SECONDS_PER_MINUTE)) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  return `${padTimeSegment(hours)}:${padTimeSegment(minutes)}:${padTimeSegment(seconds)}`;
}

function readCustomDurationMinutesFromInput(): number {
  const parsedDurationMinutes = Number.parseInt(durationMinutesInputElement.value, 10);

  if (!Number.isFinite(parsedDurationMinutes) || parsedDurationMinutes < 1) {
    return DEFAULT_CUSTOM_DURATION_MINUTES;
  }

  return parsedDurationMinutes;
}

function getSelectedDurationMinutes(): number {
  if (selectedDurationSelectionMode === "twentyFive") {
    return PRESET_TWENTY_FIVE_MINUTES;
  }

  if (selectedDurationSelectionMode === "fifty") {
    return PRESET_FIFTY_MINUTES;
  }

  return readCustomDurationMinutesFromInput();
}

function setDurationSelectionMode(durationSelectionMode: DurationSelectionMode): void {
  selectedDurationSelectionMode = durationSelectionMode;

  const isTwentyFiveMode = durationSelectionMode === "twentyFive";
  const isFiftyMode = durationSelectionMode === "fifty";
  const isCustomMode = durationSelectionMode === "custom";

  presetTwentyFiveMinutesButtonElement.classList.toggle("is-selected", isTwentyFiveMode);
  presetFiftyMinutesButtonElement.classList.toggle("is-selected", isFiftyMode);
  presetCustomDurationButtonElement.classList.toggle("is-selected", isCustomMode);

  if (isTwentyFiveMode) {
    durationMinutesInputElement.value = String(PRESET_TWENTY_FIVE_MINUTES);
    durationMinutesInputElement.disabled = true;
    return;
  }

  if (isFiftyMode) {
    durationMinutesInputElement.value = String(PRESET_FIFTY_MINUTES);
    durationMinutesInputElement.disabled = true;
    return;
  }

  durationMinutesInputElement.disabled = false;
  durationMinutesInputElement.focus();
}

function createStatusLabel(timerState: TimerMessageResponse): string {
  if ("error" in timerState) {
    return "Error";
  }

  if (timerState.isRunning) {
    return "Running";
  }

  if (timerState.hasStartedAtLeastOnce && timerState.remainingSeconds === 0) {
    return "Completed";
  }

  if (timerState.hasStartedAtLeastOnce) {
    return "Paused";
  }

  return "Ready";
}

function updateActionButtons(timerState: TimerMessageResponse): void {
  if ("error" in timerState) {
    startButtonElement.textContent = "Start / Resume";
    startButtonElement.disabled = false;
    pauseButtonElement.disabled = true;
    resetButtonElement.disabled = false;
    return;
  }

  if (timerState.isRunning) {
    startButtonElement.textContent = "Running";
    startButtonElement.disabled = true;
    pauseButtonElement.disabled = false;
    resetButtonElement.disabled = false;
    return;
  }

  if (timerState.hasStartedAtLeastOnce && timerState.remainingSeconds > 0) {
    startButtonElement.textContent = "Resume";
  } else {
    startButtonElement.textContent = "Start";
  }

  startButtonElement.disabled = false;
  pauseButtonElement.disabled = true;
  resetButtonElement.disabled = false;
}

function updatePopupDisplay(timerState: TimerMessageResponse): void {
  if ("error" in timerState) {
    timerStatusElement.textContent = "Error";
    updateActionButtons(timerState);
    return;
  }

  timerDisplayElement.textContent = formatAsHoursMinutesSeconds(timerState.remainingSeconds);
  timerStatusElement.textContent = createStatusLabel(timerState);
  updateActionButtons(timerState);
}

async function sendRuntimeMessage(message: TimerRequestMessage): Promise<TimerMessageResponse> {
  const response = await chrome.runtime.sendMessage(message);

  if (!isTimerMessageResponse(response)) {
    return createErrorResponse("Unexpected runtime response.");
  }

  return response;
}

async function refreshTimerDisplay(): Promise<void> {
  const getTimerStateMessage: GetTimerStateMessage = { type: GET_TIMER_STATE_MESSAGE_TYPE };
  const timerState = await sendRuntimeMessage(getTimerStateMessage);
  updatePopupDisplay(timerState);
}

async function handleStartButtonClick(): Promise<void> {
  const durationMinutes = getSelectedDurationMinutes();
  const durationSeconds = durationMinutes * SECONDS_PER_MINUTE;
  const startTimerMessage: StartTimerMessage = {
    type: START_TIMER_MESSAGE_TYPE,
    durationSeconds
  };

  const timerState = await sendRuntimeMessage(startTimerMessage);
  updatePopupDisplay(timerState);
}

async function handlePauseButtonClick(): Promise<void> {
  const pauseTimerMessage: PauseTimerMessage = { type: PAUSE_TIMER_MESSAGE_TYPE };
  const timerState = await sendRuntimeMessage(pauseTimerMessage);
  updatePopupDisplay(timerState);
}

async function handleResetButtonClick(): Promise<void> {
  const durationMinutes = getSelectedDurationMinutes();
  const durationSeconds = durationMinutes * SECONDS_PER_MINUTE;
  const resetTimerMessage: ResetTimerMessage = {
    type: RESET_TIMER_MESSAGE_TYPE,
    durationSeconds
  };

  const timerState = await sendRuntimeMessage(resetTimerMessage);
  updatePopupDisplay(timerState);
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

startButtonElement.addEventListener("click", () => {
  handleStartButtonClick().catch(() => {
    timerStatusElement.textContent = "Error";
  });
});

pauseButtonElement.addEventListener("click", () => {
  handlePauseButtonClick().catch(() => {
    timerStatusElement.textContent = "Error";
  });
});

resetButtonElement.addEventListener("click", () => {
  handleResetButtonClick().catch(() => {
    timerStatusElement.textContent = "Error";
  });
});

setDurationSelectionMode("twentyFive");

refreshTimerDisplay().catch(() => {
  timerStatusElement.textContent = "Error";
});

setInterval(() => {
  refreshTimerDisplay().catch(() => {
    timerStatusElement.textContent = "Error";
  });
}, UPDATE_INTERVAL_MILLISECONDS);

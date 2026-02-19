import {
  GET_TIMER_STATE_MESSAGE_TYPE,
  START_TIMER_MESSAGE_TYPE,
  STOP_TIMER_MESSAGE_TYPE,
  isTimerMessageResponse,
  type GetTimerStateMessage,
  type StartTimerMessage,
  type StopTimerMessage,
  type TimerRequestMessage
} from "../shared/messages.js";
import type { TimerMessageResponse } from "../shared/types.js";

const UPDATE_INTERVAL_MILLISECONDS = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const DEFAULT_DURATION_MINUTES = 25;

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
const startButtonElement = getRequiredButtonElement("startButton");
const stopButtonElement = getRequiredButtonElement("stopButton");

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

function readDurationMinutesFromInput(): number {
  const parsedDurationMinutes = Number.parseInt(durationMinutesInputElement.value, 10);

  if (!Number.isFinite(parsedDurationMinutes) || parsedDurationMinutes < 1) {
    return DEFAULT_DURATION_MINUTES;
  }

  return parsedDurationMinutes;
}

function updatePopupDisplay(timerState: TimerMessageResponse): void {
  if ("error" in timerState) {
    timerStatusElement.textContent = "Error";
    return;
  }

  timerDisplayElement.textContent = formatAsHoursMinutesSeconds(timerState.remainingSeconds);
  timerStatusElement.textContent = timerState.isRunning ? "Running" : "Stopped";
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
  const durationMinutes = readDurationMinutesFromInput();
  const durationSeconds = durationMinutes * SECONDS_PER_MINUTE;
  const startTimerMessage: StartTimerMessage = {
    type: START_TIMER_MESSAGE_TYPE,
    durationSeconds
  };

  await sendRuntimeMessage(startTimerMessage);
  await refreshTimerDisplay();
}

async function handleStopButtonClick(): Promise<void> {
  const stopTimerMessage: StopTimerMessage = { type: STOP_TIMER_MESSAGE_TYPE };
  await sendRuntimeMessage(stopTimerMessage);
  await refreshTimerDisplay();
}

startButtonElement.addEventListener("click", () => {
  handleStartButtonClick().catch(() => {
    timerStatusElement.textContent = "Error";
  });
});

stopButtonElement.addEventListener("click", () => {
  handleStopButtonClick().catch(() => {
    timerStatusElement.textContent = "Error";
  });
});

refreshTimerDisplay().catch(() => {
  timerStatusElement.textContent = "Error";
});

setInterval(() => {
  refreshTimerDisplay().catch(() => {
    timerStatusElement.textContent = "Error";
  });
}, UPDATE_INTERVAL_MILLISECONDS);

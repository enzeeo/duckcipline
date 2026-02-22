import {
  CLAIM_SELECTED_DUCK_REWARD_MESSAGE_TYPE,
  GET_DUCK_REWARDS_STATE_MESSAGE_TYPE,
  GET_TIMER_STATE_MESSAGE_TYPE,
  PAUSE_TIMER_MESSAGE_TYPE,
  RESET_TIMER_MESSAGE_TYPE,
  SELECT_DUCK_REWARD_ITEM_MESSAGE_TYPE,
  START_TIMER_MESSAGE_TYPE,
  isDuckRewardsMessageResponse,
  isTimerMessageResponse,
  type ClaimSelectedDuckRewardMessage,
  type GetDuckRewardsStateMessage,
  type GetTimerStateMessage,
  type PauseTimerMessage,
  type ResetTimerMessage,
  type SelectDuckRewardItemMessage,
  type StartTimerMessage,
  type TimerRequestMessage
} from "../shared/messages.js";
import type {
  Duck,
  DuckRewardItemId,
  DuckRewardsMessageResponse,
  ErrorResponse,
  TimerMessageResponse
} from "../shared/types.js";

const UPDATE_INTERVAL_MILLISECONDS = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const PRESET_TWENTY_FIVE_MINUTES = 25;
const PRESET_FIFTY_MINUTES = 50;
const DEFAULT_CUSTOM_DURATION_MINUTES = PRESET_TWENTY_FIVE_MINUTES;
const HOMESTEAD_HTML_PATH = "src/homestead/homestead.html";

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

const openHomesteadButtonElement = getRequiredButtonElement("openHomesteadButton");

const selectedDuckRewardItemTextElement = getRequiredParagraphElement("selectedDuckRewardItemText");
const timerDisplayElement = getRequiredParagraphElement("timerDisplay");
const selectedDuckRewardRemainingTextElement = getRequiredParagraphElement("selectedDuckRewardRemainingText");
const claimDuckRewardButtonElement = getRequiredButtonElement("claimDuckRewardButton");

const durationMinutesInputElement = getRequiredInputElement("durationMinutesInput");
const presetTwentyFiveMinutesButtonElement = getRequiredButtonElement("presetTwentyFiveMinutesButton");
const presetFiftyMinutesButtonElement = getRequiredButtonElement("presetFiftyMinutesButton");
const presetCustomDurationButtonElement = getRequiredButtonElement("presetCustomDurationButton");
const startButtonElement = getRequiredButtonElement("startButton");
const pauseButtonElement = getRequiredButtonElement("pauseButton");
const resetButtonElement = getRequiredButtonElement("resetButton");

const selectDuckEggOneButtonElement = getRequiredButtonElement("selectDuckEggOneButton");
const selectDuckEggTwoButtonElement = getRequiredButtonElement("selectDuckEggTwoButton");
const selectedDuckRewardProgressTextElement = getRequiredParagraphElement("selectedDuckRewardProgressText");
const totalCompletedSessionsTextElement = getRequiredParagraphElement("totalCompletedSessionsText");
const totalCompletedFocusSecondsTextElement = getRequiredParagraphElement("totalCompletedFocusSecondsText");
const duckEggOneStatusTextElement = getRequiredParagraphElement("duckEggOneStatusText");
const duckEggTwoStatusTextElement = getRequiredParagraphElement("duckEggTwoStatusText");

let selectedDurationSelectionMode: DurationSelectionMode = "twentyFive";
let isTimerRunningInCurrentViewState = false;
let selectedDuckRewardItemIdInCurrentViewState: DuckRewardItemId | null = null;
let isCustomDurationInputRepresentingSeconds = false;

function createErrorResponse(message: string): ErrorResponse {
  return { error: message };
}

function navigateToHomesteadView(): void {
  window.location.href = chrome.runtime.getURL(HOMESTEAD_HTML_PATH);
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
  const parsedDurationMinutes = Number.parseFloat(durationMinutesInputElement.value);

  if (!Number.isFinite(parsedDurationMinutes) || parsedDurationMinutes <= 0) {
    return DEFAULT_CUSTOM_DURATION_MINUTES;
  }

  return parsedDurationMinutes;
}

function readCustomDurationSecondsFromInput(): number {
  const parsedDurationSeconds = Number.parseFloat(durationMinutesInputElement.value);

  if (!Number.isFinite(parsedDurationSeconds) || parsedDurationSeconds <= 0) {
    return DEFAULT_CUSTOM_DURATION_MINUTES * SECONDS_PER_MINUTE;
  }

  return Math.floor(parsedDurationSeconds);
}

function getSelectedDurationSeconds(): number {
  if (selectedDurationSelectionMode === "twentyFive") {
    return PRESET_TWENTY_FIVE_MINUTES * SECONDS_PER_MINUTE;
  }

  if (selectedDurationSelectionMode === "fifty") {
    return PRESET_FIFTY_MINUTES * SECONDS_PER_MINUTE;
  }

  if (isCustomDurationInputRepresentingSeconds) {
    return readCustomDurationSecondsFromInput();
  }

  const customDurationMinutes = readCustomDurationMinutesFromInput();
  return Math.max(1, Math.round(customDurationMinutes * SECONDS_PER_MINUTE));
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

function setCustomDurationFromDuckRewardSeconds(duckRewardRequiredProgressSeconds: number): void {
  const normalizedDuckRewardRequiredProgressSeconds = Math.max(1, Math.floor(duckRewardRequiredProgressSeconds));
  isCustomDurationInputRepresentingSeconds = true;
  setDurationSelectionMode("custom");
  durationMinutesInputElement.value = String(normalizedDuckRewardRequiredProgressSeconds);
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
    startButtonElement.textContent = "Started";
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

function updateTimerDisplay(timerState: TimerMessageResponse): void {
  if ("error" in timerState) {
    isTimerRunningInCurrentViewState = false;
    updateActionButtons(timerState);
    return;
  }

  isTimerRunningInCurrentViewState = timerState.isRunning;
  timerDisplayElement.textContent = formatAsHoursMinutesSeconds(timerState.remainingSeconds);
  updateActionButtons(timerState);
}

function calculateDuckRewardItemHatchCounts(ducks: Duck[]): Record<DuckRewardItemId, number> {
  return ducks.reduce<Record<DuckRewardItemId, number>>(
    (duckRewardItemHatchCounts, duck) => {
      duckRewardItemHatchCounts[duck.sourceDuckRewardItemId] += 1;
      return duckRewardItemHatchCounts;
    },
    { duckEgg1: 0, duckEgg2: 0 }
  );
}

function updateDuckRewardSelectionButtons(
  selectedDuckRewardItemId: DuckRewardItemId | null,
  isTimerRunning: boolean
): void {
  const hasSelectedDuckRewardItem = selectedDuckRewardItemId !== null;
  const hasSelectedDuckEggOne = selectedDuckRewardItemId === "duckEgg1";
  const hasSelectedDuckEggTwo = selectedDuckRewardItemId === "duckEgg2";
  const isDuckEggOneSelectionLocked = hasSelectedDuckRewardItem && !hasSelectedDuckEggOne;
  const isDuckEggTwoSelectionLocked = hasSelectedDuckRewardItem && !hasSelectedDuckEggTwo;
  const areRewardSelectionButtonsDisabled = isTimerRunning || hasSelectedDuckRewardItem;

  selectDuckEggOneButtonElement.classList.toggle("is-selected", hasSelectedDuckEggOne);
  selectDuckEggTwoButtonElement.classList.toggle("is-selected", hasSelectedDuckEggTwo);
  selectDuckEggOneButtonElement.classList.toggle("is-selection-locked", isDuckEggOneSelectionLocked);
  selectDuckEggTwoButtonElement.classList.toggle("is-selection-locked", isDuckEggTwoSelectionLocked);
  selectDuckEggOneButtonElement.classList.toggle("is-running-locked", isTimerRunning);
  selectDuckEggTwoButtonElement.classList.toggle("is-running-locked", isTimerRunning);
  selectDuckEggOneButtonElement.disabled = areRewardSelectionButtonsDisabled;
  selectDuckEggTwoButtonElement.disabled = areRewardSelectionButtonsDisabled;
}

function updateClaimDuckRewardButtonVisibility(duckRewardsState: DuckRewardsMessageResponse): void {
  if ("error" in duckRewardsState) {
    claimDuckRewardButtonElement.hidden = true;
    claimDuckRewardButtonElement.disabled = true;
    return;
  }

  if (!duckRewardsState.selectedDuckRewardItemId || !duckRewardsState.isSelectedDuckRewardClaimAvailable) {
    claimDuckRewardButtonElement.hidden = true;
    claimDuckRewardButtonElement.disabled = true;
    return;
  }

  claimDuckRewardButtonElement.hidden = false;
  claimDuckRewardButtonElement.disabled = false;
}

function createSelectedDuckRewardLabel(duckRewardsState: DuckRewardsMessageResponse): string {
  if ("error" in duckRewardsState) {
    return "Selected reward: unavailable";
  }

  if (!duckRewardsState.selectedDuckRewardItemId) {
    return "Selected reward: none";
  }

  const selectedDuckRewardDefinition =
    duckRewardsState.duckRewardDefinitionsById[duckRewardsState.selectedDuckRewardItemId];
  return `Selected reward: ${selectedDuckRewardDefinition.displayName}`;
}

function createSelectedDuckRewardRemainingLabel(duckRewardsState: DuckRewardsMessageResponse): string {
  if ("error" in duckRewardsState) {
    return "Reward time left: unavailable";
  }

  if (!duckRewardsState.selectedDuckRewardItemId) {
    return "Reward time left: choose a reward item";
  }

  if (duckRewardsState.isSelectedDuckRewardClaimAvailable) {
    return "Reward time left: 00:00:00 (Ready to claim)";
  }

  const selectedDuckRewardDefinition =
    duckRewardsState.duckRewardDefinitionsById[duckRewardsState.selectedDuckRewardItemId];
  const remainingSeconds = Math.max(
    selectedDuckRewardDefinition.requiredProgressSeconds - duckRewardsState.selectedDuckRewardItemProgressSeconds,
    0
  );

  return `Reward time left: ${formatAsHoursMinutesSeconds(remainingSeconds)}`;
}

function updateDuckRewardsDisplay(duckRewardsState: DuckRewardsMessageResponse): void {
  selectedDuckRewardItemTextElement.textContent = createSelectedDuckRewardLabel(duckRewardsState);
  selectedDuckRewardRemainingTextElement.textContent = createSelectedDuckRewardRemainingLabel(duckRewardsState);
  updateClaimDuckRewardButtonVisibility(duckRewardsState);

  if ("error" in duckRewardsState) {
    updateDuckRewardSelectionButtons(
      selectedDuckRewardItemIdInCurrentViewState,
      isTimerRunningInCurrentViewState
    );
    selectedDuckRewardProgressTextElement.textContent = "Progress: unavailable";
    totalCompletedSessionsTextElement.textContent = "Completed sessions: unavailable";
    totalCompletedFocusSecondsTextElement.textContent = "Completed focus seconds: unavailable";
    duckEggOneStatusTextElement.textContent = "Duck Egg 1: error";
    duckEggTwoStatusTextElement.textContent = "Duck Egg 2: error";
    return;
  }

  selectedDuckRewardItemIdInCurrentViewState = duckRewardsState.selectedDuckRewardItemId;

  const duckRewardItemHatchCounts = calculateDuckRewardItemHatchCounts(duckRewardsState.ducks);

  totalCompletedSessionsTextElement.textContent = `Completed sessions: ${duckRewardsState.totalCompletedSessions}`;
  totalCompletedFocusSecondsTextElement.textContent =
    `Completed focus seconds: ${duckRewardsState.totalCompletedFocusSeconds}`;

  duckEggOneStatusTextElement.textContent =
    duckRewardItemHatchCounts.duckEgg1 > 0
      ? `Duck Egg 1: Hatched (${duckRewardItemHatchCounts.duckEgg1})`
      : "Duck Egg 1: Locked (0)";
  duckEggTwoStatusTextElement.textContent =
    duckRewardItemHatchCounts.duckEgg2 > 0
      ? `Duck Egg 2: Hatched (${duckRewardItemHatchCounts.duckEgg2})`
      : "Duck Egg 2: Locked (0)";

  if (!duckRewardsState.selectedDuckRewardItemId) {
    selectedDuckRewardProgressTextElement.textContent = "Progress: choose a reward item";
    updateDuckRewardSelectionButtons(null, isTimerRunningInCurrentViewState);
    return;
  }

  const selectedDuckRewardDefinition =
    duckRewardsState.duckRewardDefinitionsById[duckRewardsState.selectedDuckRewardItemId];

  selectedDuckRewardProgressTextElement.textContent =
    `Progress: ${duckRewardsState.selectedDuckRewardItemProgressSeconds} / ` +
    `${selectedDuckRewardDefinition.requiredProgressSeconds} seconds`;

  updateDuckRewardSelectionButtons(
    duckRewardsState.selectedDuckRewardItemId,
    isTimerRunningInCurrentViewState
  );
}

async function sendTimerRuntimeMessage(message: TimerRequestMessage): Promise<TimerMessageResponse> {
  const response = await chrome.runtime.sendMessage(message);

  if (!isTimerMessageResponse(response)) {
    return createErrorResponse("Unexpected runtime timer response.");
  }

  return response;
}

async function sendDuckRewardsRuntimeMessage(
  message: GetDuckRewardsStateMessage | SelectDuckRewardItemMessage | ClaimSelectedDuckRewardMessage
): Promise<DuckRewardsMessageResponse> {
  const response = await chrome.runtime.sendMessage(message);

  if (!isDuckRewardsMessageResponse(response)) {
    return createErrorResponse("Unexpected runtime duck rewards response.");
  }

  return response;
}

async function refreshTimerDisplay(): Promise<void> {
  const getTimerStateMessage: GetTimerStateMessage = { type: GET_TIMER_STATE_MESSAGE_TYPE };
  const timerState = await sendTimerRuntimeMessage(getTimerStateMessage);
  updateTimerDisplay(timerState);
}

async function refreshDuckRewardsDisplay(): Promise<void> {
  const getDuckRewardsStateMessage: GetDuckRewardsStateMessage = {
    type: GET_DUCK_REWARDS_STATE_MESSAGE_TYPE
  };
  const duckRewardsState = await sendDuckRewardsRuntimeMessage(getDuckRewardsStateMessage);
  updateDuckRewardsDisplay(duckRewardsState);
}

async function refreshAllDisplays(): Promise<void> {
  await refreshTimerDisplay();
  await refreshDuckRewardsDisplay();
}

async function handleStartButtonClick(): Promise<void> {
  const durationSeconds = getSelectedDurationSeconds();
  const startTimerMessage: StartTimerMessage = {
    type: START_TIMER_MESSAGE_TYPE,
    durationSeconds
  };

  const timerState = await sendTimerRuntimeMessage(startTimerMessage);
  updateTimerDisplay(timerState);
}

async function handlePauseButtonClick(): Promise<void> {
  const pauseTimerMessage: PauseTimerMessage = { type: PAUSE_TIMER_MESSAGE_TYPE };
  const timerState = await sendTimerRuntimeMessage(pauseTimerMessage);
  updateTimerDisplay(timerState);
}

async function handleResetButtonClick(): Promise<void> {
  const durationSeconds = getSelectedDurationSeconds();
  const resetTimerMessage: ResetTimerMessage = {
    type: RESET_TIMER_MESSAGE_TYPE,
    durationSeconds
  };

  const timerState = await sendTimerRuntimeMessage(resetTimerMessage);
  updateTimerDisplay(timerState);
}

async function handleSelectDuckRewardItemButtonClick(duckRewardItemId: DuckRewardItemId): Promise<void> {
  if (isTimerRunningInCurrentViewState) {
    return;
  }

  if (selectedDuckRewardItemIdInCurrentViewState !== null) {
    return;
  }

  const selectDuckRewardItemMessage: SelectDuckRewardItemMessage = {
    type: SELECT_DUCK_REWARD_ITEM_MESSAGE_TYPE,
    duckRewardItemId
  };

  const duckRewardsState = await sendDuckRewardsRuntimeMessage(selectDuckRewardItemMessage);

  if ("error" in duckRewardsState) {
    await refreshAllDisplays();
    return;
  }

  updateDuckRewardsDisplay(duckRewardsState);
  const selectedDuckRewardItemId = duckRewardsState.selectedDuckRewardItemId;

  if (selectedDuckRewardItemId !== null) {
    const selectedDuckRewardDefinition = duckRewardsState.duckRewardDefinitionsById[selectedDuckRewardItemId];
    setCustomDurationFromDuckRewardSeconds(selectedDuckRewardDefinition.requiredProgressSeconds);
  }

  await refreshTimerDisplay();
}

async function handleClaimDuckRewardButtonClick(): Promise<void> {
  const claimSelectedDuckRewardMessage: ClaimSelectedDuckRewardMessage = {
    type: CLAIM_SELECTED_DUCK_REWARD_MESSAGE_TYPE
  };

  const duckRewardsState = await sendDuckRewardsRuntimeMessage(claimSelectedDuckRewardMessage);

  if ("error" in duckRewardsState) {
    await refreshAllDisplays();
    return;
  }

  updateDuckRewardsDisplay(duckRewardsState);
}

presetTwentyFiveMinutesButtonElement.addEventListener("click", () => {
  setDurationSelectionMode("twentyFive");
});

presetFiftyMinutesButtonElement.addEventListener("click", () => {
  setDurationSelectionMode("fifty");
});

presetCustomDurationButtonElement.addEventListener("click", () => {
  isCustomDurationInputRepresentingSeconds = false;
  setDurationSelectionMode("custom");
});

openHomesteadButtonElement.addEventListener("click", () => {
  navigateToHomesteadView();
});

startButtonElement.addEventListener("click", () => {
  handleStartButtonClick()
    .then(() => refreshDuckRewardsDisplay())
    .catch(() => {
      refreshAllDisplays().catch(() => {});
    });
});

pauseButtonElement.addEventListener("click", () => {
  handlePauseButtonClick()
    .then(() => refreshDuckRewardsDisplay())
    .catch(() => {
      refreshAllDisplays().catch(() => {});
    });
});

resetButtonElement.addEventListener("click", () => {
  handleResetButtonClick()
    .then(() => refreshDuckRewardsDisplay())
    .catch(() => {
      refreshAllDisplays().catch(() => {});
    });
});

selectDuckEggOneButtonElement.addEventListener("click", () => {
  handleSelectDuckRewardItemButtonClick("duckEgg1").catch(() => {
    refreshAllDisplays().catch(() => {});
  });
});

selectDuckEggTwoButtonElement.addEventListener("click", () => {
  handleSelectDuckRewardItemButtonClick("duckEgg2").catch(() => {
    refreshAllDisplays().catch(() => {});
  });
});

claimDuckRewardButtonElement.addEventListener("click", () => {
  handleClaimDuckRewardButtonClick().catch(() => {
    refreshAllDisplays().catch(() => {});
  });
});

setDurationSelectionMode("twentyFive");

refreshAllDisplays().catch(() => {
  selectedDuckRewardItemTextElement.textContent = "Selected reward: unavailable";
});

setInterval(() => {
  refreshAllDisplays().catch(() => {
    selectedDuckRewardItemTextElement.textContent = "Selected reward: unavailable";
  });
}, UPDATE_INTERVAL_MILLISECONDS);

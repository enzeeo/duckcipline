import {
  CLAIM_SELECTED_DUCK_REWARD_MESSAGE_TYPE,
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
import {
  DUCK_REWARD_DEFINITION_BY_ID
} from "../shared/duckRewardDefinitions.js";
import type {
  Duck,
  DuckRewardDefinitionResponse,
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

const DUCK_REWARD_DEFINITIONS_BY_ID_RESPONSE: Record<DuckRewardItemId, DuckRewardDefinitionResponse> = {
  duckEgg1: {
    displayName: DUCK_REWARD_DEFINITION_BY_ID.duckEgg1.displayName,
    rewardType: DUCK_REWARD_DEFINITION_BY_ID.duckEgg1.rewardType,
    requiredProgressSeconds: DUCK_REWARD_DEFINITION_BY_ID.duckEgg1.requiredProgressSeconds
  },
  duckEgg2: {
    displayName: DUCK_REWARD_DEFINITION_BY_ID.duckEgg2.displayName,
    rewardType: DUCK_REWARD_DEFINITION_BY_ID.duckEgg2.rewardType,
    requiredProgressSeconds: DUCK_REWARD_DEFINITION_BY_ID.duckEgg2.requiredProgressSeconds
  }
};

type ExtensionMessageResponse = TimerMessageResponse | DuckRewardsMessageResponse;

interface CanonicalStateResult {
  timerState: TimerState;
  duckRewardsState: DuckRewardsState;
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

function createDuckRewardsStatusResponse(
  duckRewardsState: DuckRewardsState,
  timerState: TimerState,
  nowTimestampMilliseconds: number
): DuckRewardsStatusResponse {
  return {
    selectedDuckRewardItemId: duckRewardsState.selectedDuckRewardItemId,
    selectedDuckRewardItemProgressSeconds: calculateCurrentSelectedDuckRewardProgressSeconds(
      duckRewardsState,
      timerState,
      nowTimestampMilliseconds
    ),
    isSelectedDuckRewardClaimAvailable: duckRewardsState.isSelectedDuckRewardClaimAvailable,
    ducks: duckRewardsState.ducks,
    totalCompletedSessions: duckRewardsState.totalCompletedSessions,
    totalCompletedFocusSeconds: duckRewardsState.totalCompletedFocusSeconds,
    duckRewardDefinitionsById: DUCK_REWARD_DEFINITIONS_BY_ID_RESPONSE
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
    selectedDuckRewardItemProgressStartedAtTimestampMilliseconds: null,
    isSelectedDuckRewardClaimAvailable: false,
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
  const hasValidProgressStartTimestamp =
    typeof possibleDuckRewardsState.selectedDuckRewardItemProgressStartedAtTimestampMilliseconds === "number" ||
    possibleDuckRewardsState.selectedDuckRewardItemProgressStartedAtTimestampMilliseconds === null ||
    typeof possibleDuckRewardsState.selectedDuckRewardItemProgressStartedAtTimestampMilliseconds === "undefined";
  const hasValidClaimAvailability =
    typeof possibleDuckRewardsState.isSelectedDuckRewardClaimAvailable === "boolean" ||
    typeof possibleDuckRewardsState.isSelectedDuckRewardClaimAvailable === "undefined";

  return (
    hasValidSelectedRewardItemId &&
    typeof possibleDuckRewardsState.selectedDuckRewardItemProgressSeconds === "number" &&
    hasValidProgressStartTimestamp &&
    hasValidClaimAvailability &&
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

function calculateElapsedSecondsSinceTimestamp(
  fromTimestampMilliseconds: number,
  toTimestampMilliseconds: number
): number {
  if (toTimestampMilliseconds <= fromTimestampMilliseconds) {
    return 0;
  }

  const elapsedMilliseconds = toTimestampMilliseconds - fromTimestampMilliseconds;
  return Math.floor(elapsedMilliseconds / MILLISECONDS_PER_SECOND);
}

function getRequiredProgressSecondsForSelectedDuckReward(
  duckRewardsState: DuckRewardsState
): number | null {
  if (!duckRewardsState.selectedDuckRewardItemId) {
    return null;
  }

  return DUCK_REWARD_DEFINITION_BY_ID[duckRewardsState.selectedDuckRewardItemId].requiredProgressSeconds;
}

function calculateCurrentSelectedDuckRewardProgressSeconds(
  duckRewardsState: DuckRewardsState,
  timerState: TimerState,
  nowTimestampMilliseconds: number
): number {
  const requiredProgressSeconds = getRequiredProgressSecondsForSelectedDuckReward(duckRewardsState);

  if (requiredProgressSeconds === null) {
    return 0;
  }

  if (duckRewardsState.isSelectedDuckRewardClaimAvailable) {
    return requiredProgressSeconds;
  }

  if (!timerState.isRunning || !duckRewardsState.selectedDuckRewardItemProgressStartedAtTimestampMilliseconds) {
    return Math.min(duckRewardsState.selectedDuckRewardItemProgressSeconds, requiredProgressSeconds);
  }

  const elapsedSecondsSinceProgressStarted = calculateElapsedSecondsSinceTimestamp(
    duckRewardsState.selectedDuckRewardItemProgressStartedAtTimestampMilliseconds,
    nowTimestampMilliseconds
  );

  const currentProgressSeconds =
    duckRewardsState.selectedDuckRewardItemProgressSeconds + elapsedSecondsSinceProgressStarted;

  return Math.min(currentProgressSeconds, requiredProgressSeconds);
}

function applyCompletedFocusSessionToTotals(
  duckRewardsState: DuckRewardsState,
  completedFocusSessionSeconds: number
): DuckRewardsState {
  const sanitizedCompletedFocusSessionSeconds = parseCompletedFocusSessionSeconds(completedFocusSessionSeconds);

  if (sanitizedCompletedFocusSessionSeconds < 1) {
    return duckRewardsState;
  }

  return {
    ...duckRewardsState,
    totalCompletedSessions: duckRewardsState.totalCompletedSessions + 1,
    totalCompletedFocusSeconds: duckRewardsState.totalCompletedFocusSeconds + sanitizedCompletedFocusSessionSeconds
  };
}

function synchronizeDuckRewardProgressStateWithTimer(
  duckRewardsState: DuckRewardsState,
  timerState: TimerState,
  nowTimestampMilliseconds: number
): DuckRewardsState {
  if (!duckRewardsState.selectedDuckRewardItemId) {
    return {
      ...duckRewardsState,
      selectedDuckRewardItemProgressSeconds: 0,
      selectedDuckRewardItemProgressStartedAtTimestampMilliseconds: null,
      isSelectedDuckRewardClaimAvailable: false
    };
  }

  const requiredProgressSeconds =
    DUCK_REWARD_DEFINITION_BY_ID[duckRewardsState.selectedDuckRewardItemId].requiredProgressSeconds;

  if (duckRewardsState.isSelectedDuckRewardClaimAvailable) {
    return {
      ...duckRewardsState,
      selectedDuckRewardItemProgressSeconds: requiredProgressSeconds,
      selectedDuckRewardItemProgressStartedAtTimestampMilliseconds: null,
      isSelectedDuckRewardClaimAvailable: true
    };
  }

  if (!timerState.isRunning) {
    if (!duckRewardsState.selectedDuckRewardItemProgressStartedAtTimestampMilliseconds) {
      return duckRewardsState;
    }

    const elapsedSecondsSinceProgressStarted = calculateElapsedSecondsSinceTimestamp(
      duckRewardsState.selectedDuckRewardItemProgressStartedAtTimestampMilliseconds,
      nowTimestampMilliseconds
    );

    const updatedProgressSeconds = Math.min(
      duckRewardsState.selectedDuckRewardItemProgressSeconds + elapsedSecondsSinceProgressStarted,
      requiredProgressSeconds
    );

    return {
      ...duckRewardsState,
      selectedDuckRewardItemProgressSeconds: updatedProgressSeconds,
      selectedDuckRewardItemProgressStartedAtTimestampMilliseconds: null,
      isSelectedDuckRewardClaimAvailable: updatedProgressSeconds >= requiredProgressSeconds
    };
  }

  if (!duckRewardsState.selectedDuckRewardItemProgressStartedAtTimestampMilliseconds) {
    return {
      ...duckRewardsState,
      selectedDuckRewardItemProgressStartedAtTimestampMilliseconds: nowTimestampMilliseconds
    };
  }

  const elapsedSecondsSinceProgressStarted = calculateElapsedSecondsSinceTimestamp(
    duckRewardsState.selectedDuckRewardItemProgressStartedAtTimestampMilliseconds,
    nowTimestampMilliseconds
  );

  if (elapsedSecondsSinceProgressStarted < 1) {
    return duckRewardsState;
  }

  const possibleCurrentProgressSeconds =
    duckRewardsState.selectedDuckRewardItemProgressSeconds + elapsedSecondsSinceProgressStarted;

  if (possibleCurrentProgressSeconds < requiredProgressSeconds) {
    return duckRewardsState;
  }

  return {
    ...duckRewardsState,
    selectedDuckRewardItemProgressSeconds: requiredProgressSeconds,
    selectedDuckRewardItemProgressStartedAtTimestampMilliseconds: null,
    isSelectedDuckRewardClaimAvailable: true
  };
}

function areDuckRewardsStatesEqual(leftState: DuckRewardsState, rightState: DuckRewardsState): boolean {
  return JSON.stringify(leftState) === JSON.stringify(rightState);
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

async function getCanonicalTimerAndDuckRewardsState(
  nowTimestampMilliseconds: number
): Promise<CanonicalStateResult> {
  let timerState = await readTimerStateFromSessionStorage();
  let duckRewardsState = await readDuckRewardsStateFromLocalStorage();

  let hasTimerStateChanged = false;
  let hasDuckRewardsStateChanged = false;

  if (timerState.isRunning) {
    const remainingSeconds = calculateRemainingSecondsForRunningTimer(timerState, nowTimestampMilliseconds);

    if (remainingSeconds < 1) {
      timerState = {
        ...timerState,
        isRunning: false,
        startedAtTimestampMilliseconds: null,
        remainingSecondsWhenNotRunning: 0
      };
      hasTimerStateChanged = true;

      duckRewardsState = applyCompletedFocusSessionToTotals(
        duckRewardsState,
        timerState.configuredDurationSeconds
      );
      hasDuckRewardsStateChanged = true;
    }
  }

  const synchronizedDuckRewardsState = synchronizeDuckRewardProgressStateWithTimer(
    duckRewardsState,
    timerState,
    nowTimestampMilliseconds
  );

  if (!areDuckRewardsStatesEqual(duckRewardsState, synchronizedDuckRewardsState)) {
    duckRewardsState = synchronizedDuckRewardsState;
    hasDuckRewardsStateChanged = true;
  }

  if (hasTimerStateChanged) {
    await writeTimerStateToSessionStorage(timerState);
  }

  if (hasDuckRewardsStateChanged) {
    await writeDuckRewardsStateToLocalStorage(duckRewardsState);
  }

  return { timerState, duckRewardsState };
}

async function startTimer(durationSecondsFromMessage: number): Promise<TimerMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndDuckRewardsState(nowTimestampMilliseconds);

  if (canonicalStateResult.timerState.isRunning) {
    const remainingSeconds = calculateRemainingSecondsForRunningTimer(
      canonicalStateResult.timerState,
      nowTimestampMilliseconds
    );

    return createTimerStatusResponse(
      true,
      canonicalStateResult.timerState.hasStartedAtLeastOnce,
      remainingSeconds,
      canonicalStateResult.timerState.configuredDurationSeconds
    );
  }

  const shouldResumePausedTimer =
    canonicalStateResult.timerState.hasStartedAtLeastOnce &&
    canonicalStateResult.timerState.remainingSecondsWhenNotRunning > 0;

  let updatedTimerState: TimerState;

  if (shouldResumePausedTimer) {
    updatedTimerState = {
      ...canonicalStateResult.timerState,
      isRunning: true,
      startedAtTimestampMilliseconds: calculateStartedAtTimestampMillisecondsForResumedTimer(
        canonicalStateResult.timerState,
        nowTimestampMilliseconds
      )
    };
  } else {
    const durationSeconds = parseDurationSeconds(durationSecondsFromMessage);

    updatedTimerState = {
      isRunning: true,
      hasStartedAtLeastOnce: true,
      configuredDurationSeconds: durationSeconds,
      startedAtTimestampMilliseconds: nowTimestampMilliseconds,
      remainingSecondsWhenNotRunning: durationSeconds
    };
  }

  await writeTimerStateToSessionStorage(updatedTimerState);

  const synchronizedDuckRewardsState = synchronizeDuckRewardProgressStateWithTimer(
    canonicalStateResult.duckRewardsState,
    updatedTimerState,
    nowTimestampMilliseconds
  );

  if (!areDuckRewardsStatesEqual(canonicalStateResult.duckRewardsState, synchronizedDuckRewardsState)) {
    await writeDuckRewardsStateToLocalStorage(synchronizedDuckRewardsState);
  }

  return createTimerStatusResponse(
    true,
    updatedTimerState.hasStartedAtLeastOnce,
    updatedTimerState.remainingSecondsWhenNotRunning,
    updatedTimerState.configuredDurationSeconds
  );
}

async function pauseTimer(): Promise<TimerMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndDuckRewardsState(nowTimestampMilliseconds);

  if (!canonicalStateResult.timerState.isRunning) {
    return createTimerStatusResponse(
      false,
      canonicalStateResult.timerState.hasStartedAtLeastOnce,
      canonicalStateResult.timerState.remainingSecondsWhenNotRunning,
      canonicalStateResult.timerState.configuredDurationSeconds
    );
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

  const synchronizedDuckRewardsState = synchronizeDuckRewardProgressStateWithTimer(
    canonicalStateResult.duckRewardsState,
    stoppedTimerState,
    nowTimestampMilliseconds
  );

  if (!areDuckRewardsStatesEqual(canonicalStateResult.duckRewardsState, synchronizedDuckRewardsState)) {
    await writeDuckRewardsStateToLocalStorage(synchronizedDuckRewardsState);
  }

  return createTimerStatusResponse(
    false,
    stoppedTimerState.hasStartedAtLeastOnce,
    stoppedTimerState.remainingSecondsWhenNotRunning,
    stoppedTimerState.configuredDurationSeconds
  );
}

async function resetTimer(durationSecondsFromMessage: number): Promise<TimerMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndDuckRewardsState(nowTimestampMilliseconds);

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

  const synchronizedDuckRewardsState = synchronizeDuckRewardProgressStateWithTimer(
    canonicalStateResult.duckRewardsState,
    resetTimerState,
    nowTimestampMilliseconds
  );

  if (!areDuckRewardsStatesEqual(canonicalStateResult.duckRewardsState, synchronizedDuckRewardsState)) {
    await writeDuckRewardsStateToLocalStorage(synchronizedDuckRewardsState);
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
  const canonicalStateResult = await getCanonicalTimerAndDuckRewardsState(nowTimestampMilliseconds);

  if (!canonicalStateResult.timerState.isRunning) {
    return createTimerStatusResponse(
      false,
      canonicalStateResult.timerState.hasStartedAtLeastOnce,
      canonicalStateResult.timerState.remainingSecondsWhenNotRunning,
      canonicalStateResult.timerState.configuredDurationSeconds
    );
  }

  const remainingSeconds = calculateRemainingSecondsForRunningTimer(
    canonicalStateResult.timerState,
    nowTimestampMilliseconds
  );

  return createTimerStatusResponse(
    true,
    canonicalStateResult.timerState.hasStartedAtLeastOnce,
    remainingSeconds,
    canonicalStateResult.timerState.configuredDurationSeconds
  );
}

async function getDuckRewardsStateMessageResponse(): Promise<DuckRewardsMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndDuckRewardsState(nowTimestampMilliseconds);

  return createDuckRewardsStatusResponse(
    canonicalStateResult.duckRewardsState,
    canonicalStateResult.timerState,
    nowTimestampMilliseconds
  );
}

async function selectDuckRewardItem(duckRewardItemId: DuckRewardItemId): Promise<DuckRewardsMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndDuckRewardsState(nowTimestampMilliseconds);

  if (canonicalStateResult.timerState.isRunning) {
    return createErrorResponse("Cannot change duck reward while timer is running.");
  }

  const currentlySelectedDuckRewardItemId = canonicalStateResult.duckRewardsState.selectedDuckRewardItemId;

  if (
    currentlySelectedDuckRewardItemId !== null &&
    currentlySelectedDuckRewardItemId !== duckRewardItemId
  ) {
    return createErrorResponse("Cannot select a new duck reward until the current duck reward is claimed.");
  }

  if (currentlySelectedDuckRewardItemId === duckRewardItemId) {
    return createDuckRewardsStatusResponse(
      canonicalStateResult.duckRewardsState,
      canonicalStateResult.timerState,
      nowTimestampMilliseconds
    );
  }

  const updatedDuckRewardsState: DuckRewardsState = {
    ...canonicalStateResult.duckRewardsState,
    selectedDuckRewardItemId: duckRewardItemId,
    selectedDuckRewardItemProgressSeconds: 0,
    selectedDuckRewardItemProgressStartedAtTimestampMilliseconds: null,
    isSelectedDuckRewardClaimAvailable: false
  };

  await writeDuckRewardsStateToLocalStorage(updatedDuckRewardsState);

  return createDuckRewardsStatusResponse(
    updatedDuckRewardsState,
    canonicalStateResult.timerState,
    nowTimestampMilliseconds
  );
}

async function claimSelectedDuckReward(): Promise<DuckRewardsMessageResponse> {
  const nowTimestampMilliseconds = Date.now();
  const canonicalStateResult = await getCanonicalTimerAndDuckRewardsState(nowTimestampMilliseconds);

  if (!canonicalStateResult.duckRewardsState.selectedDuckRewardItemId) {
    return createErrorResponse("No duck reward is selected.");
  }

  if (!canonicalStateResult.duckRewardsState.isSelectedDuckRewardClaimAvailable) {
    return createErrorResponse("Selected duck reward is not ready to claim.");
  }

  const selectedDuckRewardItemId = canonicalStateResult.duckRewardsState.selectedDuckRewardItemId;

  const updatedDuckRewardsState: DuckRewardsState = {
    ...canonicalStateResult.duckRewardsState,
    selectedDuckRewardItemId: null,
    selectedDuckRewardItemProgressSeconds: 0,
    selectedDuckRewardItemProgressStartedAtTimestampMilliseconds: null,
    isSelectedDuckRewardClaimAvailable: false,
    ducks: [...canonicalStateResult.duckRewardsState.ducks, createDuck(selectedDuckRewardItemId)]
  };

  await writeDuckRewardsStateToLocalStorage(updatedDuckRewardsState);

  return createDuckRewardsStatusResponse(
    updatedDuckRewardsState,
    canonicalStateResult.timerState,
    nowTimestampMilliseconds
  );
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

  if (message.type === CLAIM_SELECTED_DUCK_REWARD_MESSAGE_TYPE) {
    return claimSelectedDuckReward();
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

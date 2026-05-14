import { MAX_DUCK_COUNT } from "../shared/balance.js";
import {
  applyCompletedFocusSessionToTotals,
  claimActiveProject,
  feedDuck,
  renameDuck,
  saveHomesteadCamera,
  selectActiveProject,
  synchronizeGameProgressStateWithTimer,
  updateDuckPlacement,
  updateDuckSimulationState
} from "../shared/gameLogic.js";
import {
  PROJECT_DEFINITION_BY_ID
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
  type ExtensionRequestMessage
} from "../shared/messages.js";
import { createProjectDefinitionResponses } from "../shared/projectDefinitions.js";
import {
  calculateRemainingSecondsForRunningTimer,
  calculateStartedAtTimestampMillisecondsForResumedTimer,
  createDefaultTimerState,
  parseTimerDurationSeconds
} from "../timer/timerState.js";
import type {
  ErrorResponse,
  GameMessageResponse,
  GameState,
  GameStatusResponse,
  TimerMessageResponse,
  TimerState
} from "../shared/types.js";
import type { BackgroundStateStore } from "./stateStore.js";

type ExtensionMessageResponse = TimerMessageResponse | GameMessageResponse;

export interface Clock {
  now(): number;
}

export interface BackgroundApplicationOptions {
  clock: Clock;
  stateStore: BackgroundStateStore;
}

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

function areGameStatesEqual(leftState: GameState, rightState: GameState): boolean {
  return JSON.stringify(leftState) === JSON.stringify(rightState);
}

export function createBackgroundApplication(options: BackgroundApplicationOptions) {
  async function getCanonicalTimerAndGameState(nowTimestampMilliseconds: number): Promise<CanonicalStateResult> {
    let timerState = await options.stateStore.readTimerState();
    let gameState = await options.stateStore.readGameState(nowTimestampMilliseconds);

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
      await options.stateStore.writeTimerState(timerState);
    }

    if (hasGameStateChanged) {
      await options.stateStore.writeGameState(gameState);
    }

    return { timerState, gameState };
  }

  async function startTimer(durationSecondsFromMessage: number): Promise<TimerMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
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
    const configuredDurationSeconds = parseTimerDurationSeconds(durationSecondsFromMessage);
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
          configuredDurationSeconds,
          startedAtTimestampMilliseconds: nowTimestampMilliseconds,
          remainingSecondsWhenNotRunning: configuredDurationSeconds
        };

    await options.stateStore.writeTimerState(updatedTimerState);

    const synchronizedGameState = synchronizeGameProgressStateWithTimer(
      canonicalStateResult.gameState,
      updatedTimerState,
      nowTimestampMilliseconds
    );

    if (!areGameStatesEqual(canonicalStateResult.gameState, synchronizedGameState)) {
      await options.stateStore.writeGameState(synchronizedGameState);
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

    await options.stateStore.writeTimerState(stoppedTimerState);

    const synchronizedGameState = synchronizeGameProgressStateWithTimer(
      canonicalStateResult.gameState,
      stoppedTimerState,
      nowTimestampMilliseconds
    );

    if (!areGameStatesEqual(canonicalStateResult.gameState, synchronizedGameState)) {
      await options.stateStore.writeGameState(synchronizedGameState);
    }

    return stoppedTimerState;
  }

  async function pauseTimer(): Promise<TimerMessageResponse> {
    const stoppedTimerState = await stopRunningTimerIfActive(options.clock.now());

    return createTimerStatusResponse(
      false,
      stoppedTimerState.hasStartedAtLeastOnce,
      stoppedTimerState.remainingSecondsWhenNotRunning,
      stoppedTimerState.configuredDurationSeconds
    );
  }

  async function resetTimer(durationSecondsFromMessage: number): Promise<TimerMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);

    const resetDurationSeconds = canonicalStateResult.timerState.hasStartedAtLeastOnce
      ? canonicalStateResult.timerState.configuredDurationSeconds
      : parseTimerDurationSeconds(durationSecondsFromMessage);
    const resetTimerState: TimerState = {
      ...createDefaultTimerState(),
      configuredDurationSeconds: resetDurationSeconds,
      remainingSecondsWhenNotRunning: resetDurationSeconds
    };

    await options.stateStore.writeTimerState(resetTimerState);

    const synchronizedGameState = synchronizeGameProgressStateWithTimer(
      canonicalStateResult.gameState,
      resetTimerState,
      nowTimestampMilliseconds
    );

    if (!areGameStatesEqual(canonicalStateResult.gameState, synchronizedGameState)) {
      await options.stateStore.writeGameState(synchronizedGameState);
    }

    return createTimerStatusResponse(
      false,
      resetTimerState.hasStartedAtLeastOnce,
      resetTimerState.remainingSecondsWhenNotRunning,
      resetTimerState.configuredDurationSeconds
    );
  }

  async function getTimerStateMessageResponse(): Promise<TimerMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
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
    const nowTimestampMilliseconds = options.clock.now();
    const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);

    return createGameStatusResponse(
      canonicalStateResult.gameState,
      canonicalStateResult.timerState,
      nowTimestampMilliseconds,
      statusMessage
    );
  }

  async function selectProject(projectId: string): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);

    if (canonicalStateResult.timerState.isRunning) {
      return createErrorResponse("Pause focus before changing projects.");
    }

    const projectDefinition = PROJECT_DEFINITION_BY_ID[projectId as keyof typeof PROJECT_DEFINITION_BY_ID];

    if (projectDefinition.type === "egg" && canonicalStateResult.gameState.ducks.length >= MAX_DUCK_COUNT) {
      return createErrorResponse("Duck cap reached. Egg projects are disabled.");
    }

    const updatedGameState = selectActiveProject(canonicalStateResult.gameState, projectDefinition.id);
    await options.stateStore.writeGameState(updatedGameState);

    return createGameStatusResponse(
      updatedGameState,
      canonicalStateResult.timerState,
      nowTimestampMilliseconds,
      `${projectDefinition.displayName} selected.`
    );
  }

  async function claimProject(): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);

    if (canonicalStateResult.timerState.isRunning) {
      return createErrorResponse("Pause focus before claiming.");
    }

    const result = claimActiveProject(canonicalStateResult.gameState, nowTimestampMilliseconds);

    if (!areGameStatesEqual(canonicalStateResult.gameState, result.gameState)) {
      await options.stateStore.writeGameState(result.gameState);
    }

    return createGameStatusResponse(
      result.gameState,
      canonicalStateResult.timerState,
      nowTimestampMilliseconds,
      result.statusMessage
    );
  }

  async function updateGameWithResult(resultGameState: GameState, statusMessage: string | null): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    const timerState = await options.stateStore.readTimerState();
    await options.stateStore.writeGameState(resultGameState);

    return createGameStatusResponse(resultGameState, timerState, nowTimestampMilliseconds, statusMessage);
  }

  async function renameDuckById(duckId: string, name: string): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);
    const result = renameDuck(canonicalStateResult.gameState, duckId, name);
    return updateGameWithResult(result.gameState, result.statusMessage);
  }

  async function feedDuckById(duckId: string, feedMode: "single" | "toNextStage"): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);
    const result = feedDuck(canonicalStateResult.gameState, duckId, feedMode, nowTimestampMilliseconds);
    return updateGameWithResult(result.gameState, result.statusMessage);
  }

  async function placeDuckById(duckId: string, x: number, y: number): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);
    const result = updateDuckPlacement(canonicalStateResult.gameState, duckId, { x, y }, nowTimestampMilliseconds);
    return updateGameWithResult(result.gameState, result.statusMessage);
  }

  async function saveSimulationDucks(
    updates: Parameters<typeof updateDuckSimulationState>[1]
  ): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);
    const updatedGameState = updateDuckSimulationState(canonicalStateResult.gameState, updates, nowTimestampMilliseconds);
    return updateGameWithResult(updatedGameState, null);
  }

  async function saveCamera(homesteadCamera: GameState["homesteadCamera"]): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    const canonicalStateResult = await getCanonicalTimerAndGameState(nowTimestampMilliseconds);
    const updatedGameState = saveHomesteadCamera(canonicalStateResult.gameState, homesteadCamera);
    return updateGameWithResult(updatedGameState, null);
  }

  async function handleMessage(message: ExtensionRequestMessage): Promise<ExtensionMessageResponse> {
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
      return saveSimulationDucks(message.updates);
    }

    if (message.type === SAVE_HOMESTEAD_CAMERA_MESSAGE_TYPE) {
      return saveCamera(message.homesteadCamera);
    }

    return createErrorResponse("Unknown message type.");
  }

  async function initializeState(): Promise<void> {
    await options.stateStore.writeTimerState(await options.stateStore.readTimerState());
    await options.stateStore.writeGameState(await options.stateStore.readGameState(options.clock.now()));
  }

  return {
    handleMessage,
    initializeState,
    stopRunningTimerIfActive
  };
}

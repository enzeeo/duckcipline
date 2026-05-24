import { MAX_DUCK_COUNT } from "../shared/balance.js";
import {
  applyCompletedFocusSessionToTotals,
  claimActiveProject,
  feedDuck,
  renameDuck,
  saveHomesteadState,
  selectActiveProject,
  synchronizeGameProgressStateWithTimer,
  updateDuckPlacement
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
  SAVE_HOMESTEAD_STATE_MESSAGE_TYPE,
  SELECT_PROJECT_MESSAGE_TYPE,
  START_TIMER_MESSAGE_TYPE,
  STOP_TIMER_MESSAGE_TYPE,
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
  HomesteadSaveSnapshot,
  ProjectId,
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

interface CanonicalStateSnapshot {
  initialTimerState: TimerState;
  initialGameState: GameState;
  canonicalState: CanonicalStateResult;
}

interface CanonicalStateTransition<TResponse> {
  timerState?: TimerState;
  gameState?: GameState;
  createResponse(canonicalState: CanonicalStateResult): TResponse;
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

function createTimerStatusResponseFromState(
  timerState: TimerState,
  nowTimestampMilliseconds: number
): TimerMessageResponse {
  const remainingSeconds = timerState.isRunning
    ? calculateRemainingSecondsForRunningTimer(timerState, nowTimestampMilliseconds)
    : timerState.remainingSecondsWhenNotRunning;

  return createTimerStatusResponse(
    timerState.isRunning,
    timerState.hasStartedAtLeastOnce,
    remainingSeconds,
    timerState.configuredDurationSeconds
  );
}

function areTimerStatesEqual(leftState: TimerState, rightState: TimerState): boolean {
  return JSON.stringify(leftState) === JSON.stringify(rightState);
}

function areGameStatesEqual(leftState: GameState, rightState: GameState): boolean {
  return JSON.stringify(leftState) === JSON.stringify(rightState);
}

export function createBackgroundApplication(options: BackgroundApplicationOptions) {
  async function readCanonicalTimerAndGameState(
    nowTimestampMilliseconds: number
  ): Promise<CanonicalStateSnapshot> {
    const initialTimerState = await options.stateStore.readTimerState();
    const initialGameState = await options.stateStore.readGameState(nowTimestampMilliseconds);
    let timerState = initialTimerState;
    let gameState = initialGameState;

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
      }
    }

    gameState = synchronizeGameProgressStateWithTimer(
      gameState,
      timerState,
      nowTimestampMilliseconds
    );

    return {
      initialTimerState,
      initialGameState,
      canonicalState: { timerState, gameState }
    };
  }

  async function withCanonicalState<TResponse>(
    nowTimestampMilliseconds: number,
    transition: (canonicalState: CanonicalStateResult) => CanonicalStateTransition<TResponse>
  ): Promise<TResponse> {
    const {
      initialTimerState,
      initialGameState,
      canonicalState
    } = await readCanonicalTimerAndGameState(nowTimestampMilliseconds);
    const transitionResult = transition(canonicalState);
    const timerState = transitionResult.timerState ?? canonicalState.timerState;
    const gameState = synchronizeGameProgressStateWithTimer(
      transitionResult.gameState ?? canonicalState.gameState,
      timerState,
      nowTimestampMilliseconds
    );
    const finalCanonicalState = { timerState, gameState };

    if (!areTimerStatesEqual(initialTimerState, timerState)) {
      await options.stateStore.writeTimerState(timerState);
    }

    if (!areGameStatesEqual(initialGameState, gameState)) {
      await options.stateStore.writeGameState(gameState);
    }

    return transitionResult.createResponse(finalCanonicalState);
  }

  async function startTimer(durationSecondsFromMessage: number): Promise<TimerMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    return withCanonicalState<TimerMessageResponse>(nowTimestampMilliseconds, ({ timerState, gameState }) => {
      if (gameState.activeProjectId === null) {
        return {
          createResponse: () => createErrorResponse("Pick a project before starting focus.")
        };
      }

      const activeProjectProgress = gameState.projectProgressById[gameState.activeProjectId];

      if (activeProjectProgress?.isReadyToClaim) {
        return {
          createResponse: () => createErrorResponse("Claim or change the ready project before starting.")
        };
      }

      if (timerState.isRunning) {
        return {
          createResponse: ({ timerState: finalTimerState }) =>
            createTimerStatusResponseFromState(finalTimerState, nowTimestampMilliseconds)
        };
      }

      const shouldResumePausedTimer =
        timerState.hasStartedAtLeastOnce &&
        timerState.remainingSecondsWhenNotRunning > 0;
      const configuredDurationSeconds = parseTimerDurationSeconds(durationSecondsFromMessage);
      const updatedTimerState: TimerState = shouldResumePausedTimer
        ? {
            ...timerState,
            isRunning: true,
            startedAtTimestampMilliseconds: calculateStartedAtTimestampMillisecondsForResumedTimer(
              timerState,
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

      return {
        timerState: updatedTimerState,
        createResponse: ({ timerState: finalTimerState }) =>
          createTimerStatusResponseFromState(finalTimerState, nowTimestampMilliseconds)
      };
    });
  }

  async function stopRunningTimerIfActive(nowTimestampMilliseconds: number): Promise<TimerState> {
    return withCanonicalState<TimerState>(nowTimestampMilliseconds, ({ timerState }) => {
      if (!timerState.isRunning) {
        return {
          createResponse: ({ timerState: finalTimerState }) => finalTimerState
        };
      }

      const remainingSecondsWhenStopped = calculateRemainingSecondsForRunningTimer(
        timerState,
        nowTimestampMilliseconds
      );
      const stoppedTimerState: TimerState = {
        ...timerState,
        isRunning: false,
        startedAtTimestampMilliseconds: null,
        remainingSecondsWhenNotRunning: remainingSecondsWhenStopped
      };

      return {
        timerState: stoppedTimerState,
        createResponse: ({ timerState: finalTimerState }) => finalTimerState
      };
    });
  }

  async function pauseTimer(): Promise<TimerMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    const stoppedTimerState = await stopRunningTimerIfActive(nowTimestampMilliseconds);
    return createTimerStatusResponseFromState(stoppedTimerState, nowTimestampMilliseconds);
  }

  async function resetTimer(durationSecondsFromMessage: number): Promise<TimerMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    return withCanonicalState<TimerMessageResponse>(nowTimestampMilliseconds, ({ timerState }) => {
      const resetDurationSeconds = timerState.hasStartedAtLeastOnce
        ? timerState.configuredDurationSeconds
        : parseTimerDurationSeconds(durationSecondsFromMessage);
      const resetTimerState: TimerState = {
        ...createDefaultTimerState(),
        configuredDurationSeconds: resetDurationSeconds,
        remainingSecondsWhenNotRunning: resetDurationSeconds
      };

      return {
        timerState: resetTimerState,
        createResponse: ({ timerState: finalTimerState }) =>
          createTimerStatusResponseFromState(finalTimerState, nowTimestampMilliseconds)
      };
    });
  }

  async function getTimerStateMessageResponse(): Promise<TimerMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    return withCanonicalState<TimerMessageResponse>(nowTimestampMilliseconds, () => ({
      createResponse: ({ timerState }) => createTimerStatusResponseFromState(timerState, nowTimestampMilliseconds)
    }));
  }

  async function getGameStateMessageResponse(statusMessage: string | null = null): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    return withCanonicalState<GameMessageResponse>(nowTimestampMilliseconds, () => ({
      createResponse: ({ gameState, timerState }) =>
        createGameStatusResponse(gameState, timerState, nowTimestampMilliseconds, statusMessage)
    }));
  }

  async function selectProject(projectId: ProjectId): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    return withCanonicalState<GameMessageResponse>(nowTimestampMilliseconds, ({ timerState, gameState }) => {
      if (timerState.isRunning) {
        return {
          createResponse: () => createErrorResponse("Pause focus before changing projects.")
        };
      }

      const projectDefinition = PROJECT_DEFINITION_BY_ID[projectId];

      if (projectDefinition.type === "egg" && gameState.ducks.length >= MAX_DUCK_COUNT) {
        return {
          createResponse: () => createErrorResponse("Duck cap reached. Egg projects are disabled.")
        };
      }

      const updatedGameState = selectActiveProject(gameState, projectDefinition.id);

      return {
        gameState: updatedGameState,
        createResponse: ({ gameState: finalGameState, timerState: finalTimerState }) =>
          createGameStatusResponse(
            finalGameState,
            finalTimerState,
            nowTimestampMilliseconds,
            `${projectDefinition.displayName} selected.`
          )
      };
    });
  }

  async function claimProject(): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    return withCanonicalState<GameMessageResponse>(nowTimestampMilliseconds, ({ timerState, gameState }) => {
      if (timerState.isRunning) {
        return {
          createResponse: () => createErrorResponse("Pause focus before claiming.")
        };
      }

      const result = claimActiveProject(gameState, nowTimestampMilliseconds);

      return {
        gameState: result.gameState,
        createResponse: ({ gameState: finalGameState, timerState: finalTimerState }) =>
          createGameStatusResponse(finalGameState, finalTimerState, nowTimestampMilliseconds, result.statusMessage)
      };
    });
  }

  async function renameDuckById(duckId: string, name: string): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    return withCanonicalState<GameMessageResponse>(nowTimestampMilliseconds, ({ gameState }) => {
      const result = renameDuck(gameState, duckId, name);

      return {
        gameState: result.gameState,
        createResponse: ({ gameState: finalGameState, timerState }) =>
          createGameStatusResponse(finalGameState, timerState, nowTimestampMilliseconds, result.statusMessage)
      };
    });
  }

  async function feedDuckById(duckId: string, feedMode: "single" | "toNextStage"): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    return withCanonicalState<GameMessageResponse>(nowTimestampMilliseconds, ({ gameState }) => {
      const result = feedDuck(gameState, duckId, feedMode, nowTimestampMilliseconds);

      return {
        gameState: result.gameState,
        createResponse: ({ gameState: finalGameState, timerState }) =>
          createGameStatusResponse(finalGameState, timerState, nowTimestampMilliseconds, result.statusMessage)
      };
    });
  }

  async function placeDuckById(duckId: string, x: number, y: number): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    return withCanonicalState<GameMessageResponse>(nowTimestampMilliseconds, ({ gameState }) => {
      const result = updateDuckPlacement(gameState, duckId, { x, y }, nowTimestampMilliseconds);

      return {
        gameState: result.gameState,
        createResponse: ({ gameState: finalGameState, timerState }) =>
          createGameStatusResponse(finalGameState, timerState, nowTimestampMilliseconds, result.statusMessage)
      };
    });
  }

  async function saveHomestead(snapshot: HomesteadSaveSnapshot): Promise<GameMessageResponse> {
    const nowTimestampMilliseconds = options.clock.now();
    return withCanonicalState<GameMessageResponse>(nowTimestampMilliseconds, ({ gameState }) => {
      const updatedGameState = saveHomesteadState(gameState, snapshot, nowTimestampMilliseconds);

      return {
        gameState: updatedGameState,
        createResponse: ({ gameState: finalGameState, timerState }) =>
          createGameStatusResponse(finalGameState, timerState, nowTimestampMilliseconds, null)
      };
    });
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

    if (message.type === SAVE_HOMESTEAD_STATE_MESSAGE_TYPE) {
      return saveHomestead(message.snapshot);
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

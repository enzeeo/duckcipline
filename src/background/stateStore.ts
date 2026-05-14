import {
  createDefaultGameState,
  migrateLegacyDuckRewardsState,
  normalizeGameState
} from "../shared/gameLogic.js";
import type { GameState, TimerState } from "../shared/types.js";
import { createDefaultTimerState, isTimerState } from "../timer/timerState.js";

export const TIMER_STATE_STORAGE_KEY = "timerState";
export const GAME_STATE_STORAGE_KEY = "gameState";
export const LEGACY_DUCK_REWARDS_STATE_STORAGE_KEY = "duckRewardsState";

export interface BackgroundStateStore {
  readTimerState(): Promise<TimerState>;
  writeTimerState(timerState: TimerState): Promise<void>;
  readGameState(nowTimestampMilliseconds: number): Promise<GameState>;
  writeGameState(gameState: GameState): Promise<void>;
}

export interface MemoryStateStoreOptions {
  timerState?: TimerState;
  gameState?: GameState;
}

export function createChromeStateStore(chromeApi: typeof chrome): BackgroundStateStore {
  return {
    async readTimerState(): Promise<TimerState> {
      const storageValues = await chromeApi.storage.session.get(TIMER_STATE_STORAGE_KEY);
      const storedTimerState = storageValues[TIMER_STATE_STORAGE_KEY];

      if (!isTimerState(storedTimerState)) {
        return createDefaultTimerState();
      }

      return {
        ...createDefaultTimerState(),
        ...storedTimerState
      };
    },

    async writeTimerState(timerState: TimerState): Promise<void> {
      await chromeApi.storage.session.set({
        [TIMER_STATE_STORAGE_KEY]: timerState
      });
    },

    async readGameState(nowTimestampMilliseconds: number): Promise<GameState> {
      const storageValues = await chromeApi.storage.local.get([
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
    },

    async writeGameState(gameState: GameState): Promise<void> {
      await chromeApi.storage.local.set({
        [GAME_STATE_STORAGE_KEY]: gameState
      });
    }
  };
}

export function createMemoryStateStore(options: MemoryStateStoreOptions = {}): BackgroundStateStore {
  let timerState = options.timerState ?? createDefaultTimerState();
  let gameState = options.gameState ?? createDefaultGameState();

  return {
    async readTimerState(): Promise<TimerState> {
      return structuredClone(timerState);
    },

    async writeTimerState(nextTimerState: TimerState): Promise<void> {
      timerState = structuredClone(nextTimerState);
    },

    async readGameState(): Promise<GameState> {
      return structuredClone(gameState);
    },

    async writeGameState(nextGameState: GameState): Promise<void> {
      gameState = structuredClone(nextGameState);
    }
  };
}

import {
  CLAIM_ACTIVE_PROJECT_MESSAGE_TYPE,
  FEED_DUCK_MESSAGE_TYPE,
  GET_GAME_STATE_MESSAGE_TYPE,
  GET_TIMER_STATE_MESSAGE_TYPE,
  PAUSE_TIMER_MESSAGE_TYPE,
  PLACE_DUCK_MESSAGE_TYPE,
  RENAME_DUCK_MESSAGE_TYPE,
  RESET_TIMER_MESSAGE_TYPE,
  SAVE_HOMESTEAD_CAMERA_MESSAGE_TYPE,
  SELECT_PROJECT_MESSAGE_TYPE,
  START_TIMER_MESSAGE_TYPE,
  UPDATE_DUCK_SIMULATION_STATE_MESSAGE_TYPE,
  isGameMessageResponse,
  isTimerMessageResponse,
  type GameRequestMessage,
  type TimerRequestMessage
} from "../shared/messages.js";
import type {
  DuckPosition,
  DuckSimulationStateUpdate,
  FeedDuckMode,
  GameMessageResponse,
  HomesteadCameraState,
  ProjectId,
  TimerMessageResponse
} from "../shared/types.js";

export interface RuntimeMessageSender {
  sendMessage(message: TimerRequestMessage): Promise<unknown>;
  sendMessage(message: GameRequestMessage): Promise<unknown>;
}

function createErrorResponse(message: string): { error: string } {
  return { error: message };
}

export class PopupRuntimeClient {
  constructor(private readonly runtime: RuntimeMessageSender) {}

  async getTimerState(): Promise<TimerMessageResponse> {
    return this.sendTimerMessage({ type: GET_TIMER_STATE_MESSAGE_TYPE });
  }

  async startTimer(durationSeconds: number): Promise<TimerMessageResponse> {
    return this.sendTimerMessage({ type: START_TIMER_MESSAGE_TYPE, durationSeconds });
  }

  async pauseTimer(): Promise<TimerMessageResponse> {
    return this.sendTimerMessage({ type: PAUSE_TIMER_MESSAGE_TYPE });
  }

  async resetTimer(durationSeconds: number): Promise<TimerMessageResponse> {
    return this.sendTimerMessage({ type: RESET_TIMER_MESSAGE_TYPE, durationSeconds });
  }

  async getGameState(): Promise<GameMessageResponse> {
    return this.sendGameMessage({ type: GET_GAME_STATE_MESSAGE_TYPE });
  }

  async selectProject(projectId: ProjectId): Promise<GameMessageResponse> {
    return this.sendGameMessage({ type: SELECT_PROJECT_MESSAGE_TYPE, projectId });
  }

  async claimActiveProject(): Promise<GameMessageResponse> {
    return this.sendGameMessage({ type: CLAIM_ACTIVE_PROJECT_MESSAGE_TYPE });
  }

  async placeDuck(duckId: string, worldPosition: DuckPosition): Promise<GameMessageResponse> {
    return this.sendGameMessage({
      type: PLACE_DUCK_MESSAGE_TYPE,
      duckId,
      x: worldPosition.x,
      y: worldPosition.y
    });
  }

  async renameDuck(duckId: string, name: string): Promise<GameMessageResponse> {
    return this.sendGameMessage({ type: RENAME_DUCK_MESSAGE_TYPE, duckId, name });
  }

  async feedDuck(duckId: string, feedMode: FeedDuckMode): Promise<GameMessageResponse> {
    return this.sendGameMessage({ type: FEED_DUCK_MESSAGE_TYPE, duckId, feedMode });
  }

  async updateDuckSimulationState(updates: DuckSimulationStateUpdate[]): Promise<GameMessageResponse> {
    return this.sendGameMessage({ type: UPDATE_DUCK_SIMULATION_STATE_MESSAGE_TYPE, updates });
  }

  async saveHomesteadCamera(homesteadCamera: HomesteadCameraState): Promise<GameMessageResponse> {
    return this.sendGameMessage({ type: SAVE_HOMESTEAD_CAMERA_MESSAGE_TYPE, homesteadCamera });
  }

  private async sendTimerMessage(message: TimerRequestMessage): Promise<TimerMessageResponse> {
    const response = await this.runtime.sendMessage(message);

    if (!isTimerMessageResponse(response)) {
      return createErrorResponse("Unexpected timer response.");
    }

    return response;
  }

  private async sendGameMessage(message: GameRequestMessage): Promise<GameMessageResponse> {
    const response = await this.runtime.sendMessage(message);

    if (!isGameMessageResponse(response)) {
      return createErrorResponse("Unexpected game response.");
    }

    return response;
  }
}

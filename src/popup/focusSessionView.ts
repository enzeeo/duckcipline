import type { GameMessageResponse, GameStatusResponse, ProjectDefinitionResponse, ProjectId, TimerMessageResponse, TimerStatusResponse } from "../shared/types.js";
import { createAssetUrl } from "./assetLoader.js";
import type { PopupRuntimeClient } from "./popupRuntimeClient.js";
import { getFocusRewardArt } from "./rewardArt.js";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const DEFAULT_DURATION_SECONDS = 25 * SECONDS_PER_MINUTE;
const MAXIMUM_DURATION_HOURS = 99;
const MAXIMUM_DURATION_MINUTES_OR_SECONDS = 59;

export interface FocusSessionViewOptions {
  runtimeClient: PopupRuntimeClient;
  showStatus(message: string | null, isError?: boolean): void;
  onTimerResponse(timerResponse: TimerMessageResponse): Promise<void>;
  onGameResponse(gameResponse: GameMessageResponse): Promise<void>;
  refreshTimerDisplay(): Promise<void>;
  refreshGameDisplay(): Promise<void>;
}

function getRequiredElement<T extends HTMLElement>(elementId: string, constructor: { new (): T }): T {
  const element = document.getElementById(elementId);

  if (!(element instanceof constructor)) {
    throw new Error(`Required element not found: ${elementId}`);
  }

  return element;
}

function padTimeSegment(segmentValue: number): string {
  return String(segmentValue).padStart(2, "0");
}

function formatAsHoursMinutesSeconds(totalSeconds: number): string {
  const normalizedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(normalizedSeconds / (MINUTES_PER_HOUR * SECONDS_PER_MINUTE));
  const minutes = Math.floor((normalizedSeconds % (MINUTES_PER_HOUR * SECONDS_PER_MINUTE)) / SECONDS_PER_MINUTE);
  const seconds = normalizedSeconds % SECONDS_PER_MINUTE;

  return `${padTimeSegment(hours)}:${padTimeSegment(minutes)}:${padTimeSegment(seconds)}`;
}

function formatProjectSeconds(totalSeconds: number): string {
  if (totalSeconds < SECONDS_PER_MINUTE) {
    return `${Math.floor(totalSeconds)}s`;
  }

  return `${Math.floor(totalSeconds / SECONDS_PER_MINUTE)}m`;
}

export class FocusSessionView {
  private readonly timerDisplayElement = getRequiredElement("timerDisplay", HTMLParagraphElement);
  private readonly timerStateTextElement = getRequiredElement("timerStateText", HTMLParagraphElement);
  private readonly timerProgressBarElement = getRequiredElement("timerProgressBar", HTMLDivElement);
  private readonly activeRewardStageElement = getRequiredElement("activeRewardStage", HTMLElement);
  private readonly rewardNestImageElement = getRequiredElement("rewardNestImage", HTMLImageElement);
  private readonly activeRewardImageElement = getRequiredElement("activeRewardImage", HTMLImageElement);
  private readonly activeRewardNameTextElement = getRequiredElement("activeRewardNameText", HTMLParagraphElement);
  private readonly activeRewardPromptTextElement = getRequiredElement("activeRewardPromptText", HTMLParagraphElement);
  private readonly projectProgressBarElement = getRequiredElement("projectProgressBar", HTMLDivElement);
  private readonly startButtonElement = getRequiredElement("startButton", HTMLButtonElement);
  private readonly pauseButtonElement = getRequiredElement("pauseButton", HTMLButtonElement);
  private readonly resetButtonElement = getRequiredElement("resetButton", HTMLButtonElement);
  private readonly durationHoursInputElement = getRequiredElement("durationHoursInput", HTMLInputElement);
  private readonly durationMinutesInputElement = getRequiredElement("durationMinutesInput", HTMLInputElement);
  private readonly durationSecondsInputElement = getRequiredElement("durationSecondsInput", HTMLInputElement);
  private readonly clearDurationButtonElement = getRequiredElement("clearDurationButton", HTMLButtonElement);
  private readonly activeProjectTextElement = getRequiredElement("activeProjectText", HTMLParagraphElement);
  private readonly projectProgressTextElement = getRequiredElement("projectProgressText", HTMLParagraphElement);
  private readonly claimProjectButtonElement = getRequiredElement("claimProjectButton", HTMLButtonElement);
  private readonly eggProjectListElement = getRequiredElement("eggProjectList", HTMLDivElement);
  private readonly seedProjectListElement = getRequiredElement("seedProjectList", HTMLDivElement);
  private readonly duckCapacityTextElement = getRequiredElement("duckCapacityText", HTMLParagraphElement);
  private readonly sessionStatsTextElement = getRequiredElement("sessionStatsText", HTMLParagraphElement);

  private timerStateSnapshot: TimerStatusResponse | null = null;
  private gameStateSnapshot: GameStatusResponse | null = null;

  constructor(private readonly options: FocusSessionViewOptions) {
    this.rewardNestImageElement.src = createAssetUrl("src/assets/pixel/objects/nest.png");
    this.setDurationInputsFromSeconds(DEFAULT_DURATION_SECONDS);
  }

  bindEvents(): void {
    for (const durationInputElement of this.getDurationInputElements()) {
      durationInputElement.addEventListener("focus", () => {
        durationInputElement.select();
      });
      durationInputElement.addEventListener("input", () => {
        this.handleDurationInput(durationInputElement);
      });
      durationInputElement.addEventListener("blur", () => {
        this.handleDurationInputBlur(durationInputElement);
      });
      durationInputElement.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }

        const nextInputElement = this.getNextDurationInput(durationInputElement);

        if (nextInputElement !== null) {
          nextInputElement.focus();
          nextInputElement.select();
        } else {
          durationInputElement.blur();
        }
      });
    }

    this.clearDurationButtonElement.addEventListener("click", () => {
      this.clearDurationInputs();
    });
    this.startButtonElement.addEventListener("click", () => {
      this.handleStartButtonClick().catch(() => {
        this.options.showStatus("Start failed.", true);
      });
    });
    this.pauseButtonElement.addEventListener("click", () => {
      this.handlePauseButtonClick().catch(() => {
        this.options.showStatus("Pause failed.", true);
      });
    });
    this.resetButtonElement.addEventListener("click", () => {
      this.handleResetButtonClick().catch(() => {
        this.options.showStatus("Reset failed.", true);
      });
    });
    this.claimProjectButtonElement.addEventListener("click", () => {
      this.handleClaimProjectButtonClick().catch(() => {
        this.options.showStatus("Claim failed.", true);
      });
    });
  }

  getSelectedDurationSeconds(): number {
    const hours = this.readDurationSegment(this.durationHoursInputElement, MAXIMUM_DURATION_HOURS);
    const minutes = this.readDurationSegment(this.durationMinutesInputElement, MAXIMUM_DURATION_MINUTES_OR_SECONDS);
    const seconds = this.readDurationSegment(this.durationSecondsInputElement, MAXIMUM_DURATION_MINUTES_OR_SECONDS);

    return hours * MINUTES_PER_HOUR * SECONDS_PER_MINUTE + minutes * SECONDS_PER_MINUTE + seconds;
  }

  renderTimer(timerState: TimerMessageResponse): void {
    if ("error" in timerState) {
      this.options.showStatus(timerState.error, true);
      return;
    }

    this.timerStateSnapshot = timerState;
    this.timerDisplayElement.textContent = formatAsHoursMinutesSeconds(timerState.remainingSeconds);
    this.timerStateTextElement.textContent = timerState.isRunning
      ? "Focusing"
      : timerState.hasStartedAtLeastOnce && timerState.remainingSeconds > 0
        ? "Paused"
        : "Ready";

    const elapsedSeconds = timerState.configuredDurationSeconds - timerState.remainingSeconds;
    const timerProgressPercent =
      timerState.configuredDurationSeconds > 0 ? (elapsedSeconds / timerState.configuredDurationSeconds) * 100 : 0;
    this.timerProgressBarElement.style.width = `${Math.min(100, Math.max(0, timerProgressPercent))}%`;
  }

  renderGame(gameResponse: GameMessageResponse): void {
    if ("error" in gameResponse) {
      this.options.showStatus(gameResponse.error, true);
      return;
    }

    this.gameStateSnapshot = gameResponse;

    this.duckCapacityTextElement.textContent =
      `Ducks: ${gameResponse.gameState.ducks.length} / ${gameResponse.maxDuckCount}`;
    this.sessionStatsTextElement.textContent =
      `Sessions: ${gameResponse.gameState.totalCompletedSessions} · ` +
      `Focus: ${gameResponse.gameState.totalCompletedFocusSeconds}s`;

    const activeProjectDefinition = this.findProjectDefinition(gameResponse.gameState.activeProjectId);

    if (activeProjectDefinition === null) {
      this.activeProjectTextElement.textContent = "No project selected.";
      this.projectProgressTextElement.textContent = "Choose an egg or seed project.";
      this.projectProgressBarElement.style.width = "0%";
      this.claimProjectButtonElement.hidden = true;
    } else {
      const progressSeconds = this.getActiveProjectProgressSeconds(activeProjectDefinition);
      const progressPercent = (progressSeconds / activeProjectDefinition.requiredProgressSeconds) * 100;
      const isReady = this.isActiveProjectReady();
      this.activeProjectTextElement.textContent =
        `${activeProjectDefinition.displayName}: ${activeProjectDefinition.rewardDescription}`;
      this.projectProgressTextElement.textContent =
        `${Math.floor(progressSeconds)} / ${activeProjectDefinition.requiredProgressSeconds} seconds` +
        (isReady ? " · ready" : "");
      this.projectProgressBarElement.style.width = `${Math.min(100, progressPercent)}%`;
      this.claimProjectButtonElement.hidden = !isReady;
      this.claimProjectButtonElement.textContent = activeProjectDefinition.type === "egg" ? "Claim duck" : "Claim seeds";
    }

    this.updateActiveRewardStage(activeProjectDefinition);
    this.renderProjectPicker();
    this.updateActionButtons();
  }

  updateActionButtons(): void {
    const isTimerRunning = this.timerStateSnapshot?.isRunning === true;
    const hasActiveProject = this.gameStateSnapshot?.gameState.activeProjectId !== null;
    const activeProjectReady = this.isActiveProjectReady();
    const hasPositiveDuration = this.getSelectedDurationSeconds() > 0;

    this.startButtonElement.disabled = isTimerRunning || !hasActiveProject || activeProjectReady || !hasPositiveDuration;
    this.pauseButtonElement.disabled = !isTimerRunning;
    this.resetButtonElement.disabled = false;
    this.startButtonElement.textContent =
      this.timerStateSnapshot?.hasStartedAtLeastOnce === true && (this.timerStateSnapshot?.remainingSeconds ?? 0) > 0
        ? "Resume"
        : "Start";
    this.claimProjectButtonElement.disabled = isTimerRunning;
  }

  private getDurationInputElements(): HTMLInputElement[] {
    return [this.durationHoursInputElement, this.durationMinutesInputElement, this.durationSecondsInputElement];
  }

  private clampDurationSegment(segmentValue: number, maximumValue: number): number {
    if (!Number.isFinite(segmentValue) || segmentValue < 0) {
      return 0;
    }

    return Math.min(maximumValue, Math.floor(segmentValue));
  }

  private readDurationSegment(inputElement: HTMLInputElement, maximumValue: number): number {
    const parsedValue = Number.parseInt(inputElement.value, 10);
    return this.clampDurationSegment(parsedValue, maximumValue);
  }

  private writeDurationSegment(inputElement: HTMLInputElement, segmentValue: number): void {
    inputElement.value = padTimeSegment(segmentValue);
  }

  private setDurationInputsFromSeconds(totalSeconds: number): void {
    const normalizedSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.min(MAXIMUM_DURATION_HOURS, Math.floor(normalizedSeconds / (MINUTES_PER_HOUR * SECONDS_PER_MINUTE)));
    const remainingSecondsAfterHours = normalizedSeconds - hours * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;
    const minutes = Math.floor(remainingSecondsAfterHours / SECONDS_PER_MINUTE);
    const seconds = remainingSecondsAfterHours % SECONDS_PER_MINUTE;

    this.writeDurationSegment(this.durationHoursInputElement, hours);
    this.writeDurationSegment(this.durationMinutesInputElement, minutes);
    this.writeDurationSegment(this.durationSecondsInputElement, seconds);
  }

  private normalizeDurationInput(inputElement: HTMLInputElement, maximumValue: number): void {
    this.writeDurationSegment(inputElement, this.readDurationSegment(inputElement, maximumValue));
  }

  private getDurationInputMaximum(inputElement: HTMLInputElement): number {
    return inputElement === this.durationHoursInputElement ? MAXIMUM_DURATION_HOURS : MAXIMUM_DURATION_MINUTES_OR_SECONDS;
  }

  private getNextDurationInput(inputElement: HTMLInputElement): HTMLInputElement | null {
    if (inputElement === this.durationHoursInputElement) {
      return this.durationMinutesInputElement;
    }

    if (inputElement === this.durationMinutesInputElement) {
      return this.durationSecondsInputElement;
    }

    return null;
  }

  private handleDurationInput(inputElement: HTMLInputElement): void {
    inputElement.value = inputElement.value.replace(/\D/g, "").slice(0, 2);
    this.updateActionButtons();

    if (inputElement.value.length < 2) {
      return;
    }

    const nextInputElement = this.getNextDurationInput(inputElement);

    if (nextInputElement !== null) {
      nextInputElement.focus();
      nextInputElement.select();
    }
  }

  private handleDurationInputBlur(inputElement: HTMLInputElement): void {
    this.normalizeDurationInput(inputElement, this.getDurationInputMaximum(inputElement));
    this.updateActionButtons();
  }

  private clearDurationInputs(): void {
    this.setDurationInputsFromSeconds(0);
    this.updateActionButtons();
    this.durationHoursInputElement.focus();
    this.durationHoursInputElement.select();
  }

  private findProjectDefinition(projectId: ProjectId | null): ProjectDefinitionResponse | null {
    if (projectId === null || this.gameStateSnapshot === null) {
      return null;
    }

    return this.gameStateSnapshot.projectDefinitions.find((projectDefinition) => projectDefinition.id === projectId) ?? null;
  }

  private getActiveProjectProgressSeconds(projectDefinition: ProjectDefinitionResponse | null): number {
    if (this.gameStateSnapshot === null || this.gameStateSnapshot.gameState.activeProjectId === null || projectDefinition === null) {
      return 0;
    }

    const progressState = this.gameStateSnapshot.gameState.projectProgressById[this.gameStateSnapshot.gameState.activeProjectId];
    return Math.min(progressState?.progressSeconds ?? 0, projectDefinition.requiredProgressSeconds);
  }

  private isActiveProjectReady(): boolean {
    if (this.gameStateSnapshot === null || this.gameStateSnapshot.gameState.activeProjectId === null) {
      return false;
    }

    return this.gameStateSnapshot.gameState.projectProgressById[this.gameStateSnapshot.gameState.activeProjectId]?.isReadyToClaim === true;
  }

  private updateActiveRewardStage(projectDefinition: ProjectDefinitionResponse | null): void {
    const rewardArt = getFocusRewardArt(projectDefinition);
    const isEmpty = rewardArt === null || projectDefinition === null;
    const isSeedReward = projectDefinition?.type === "seeds";

    this.activeRewardStageElement.classList.toggle("is-empty", isEmpty);
    this.activeRewardStageElement.classList.toggle("is-egg-reward", projectDefinition?.type === "egg");
    this.activeRewardStageElement.classList.toggle("is-seed-reward", isSeedReward);
    this.rewardNestImageElement.hidden = isSeedReward;

    if (isEmpty) {
      this.activeRewardImageElement.hidden = true;
      this.activeRewardImageElement.removeAttribute("src");
      this.activeRewardImageElement.alt = "";
      this.activeRewardNameTextElement.textContent = "Pick a project";
      this.activeRewardPromptTextElement.textContent = "Your reward will wait in the nest.";
      return;
    }

    this.activeRewardImageElement.hidden = false;
    this.activeRewardImageElement.src = createAssetUrl(rewardArt.relativePath);
    this.activeRewardImageElement.alt = rewardArt.altText;
    this.activeRewardNameTextElement.textContent = projectDefinition.displayName;
    this.activeRewardPromptTextElement.textContent = projectDefinition.rewardDescription;
  }

  private createProjectButton(projectDefinition: ProjectDefinitionResponse): HTMLButtonElement {
    const button = document.createElement("button");
    const isTimerRunning = this.timerStateSnapshot?.isRunning === true;
    const isSelected = this.gameStateSnapshot?.gameState.activeProjectId === projectDefinition.id;
    const isDuckCapacityFull =
      projectDefinition.type === "egg" &&
      (this.gameStateSnapshot?.gameState.ducks.length ?? 0) >= (this.gameStateSnapshot?.maxDuckCount ?? 20);

    button.className = "project-button";
    button.classList.toggle("is-selected", isSelected);
    button.type = "button";
    button.disabled = isTimerRunning || isDuckCapacityFull;
    button.innerHTML = `<strong>${projectDefinition.displayName}</strong><span>${formatProjectSeconds(
      projectDefinition.requiredProgressSeconds
    )} · ${projectDefinition.rewardDescription}</span>`;
    button.addEventListener("click", () => {
      this.handleSelectProject(projectDefinition.id).catch(() => {
        this.options.showStatus("Project selection failed.", true);
      });
    });

    return button;
  }

  private renderProjectPicker(): void {
    if (this.gameStateSnapshot === null) {
      return;
    }

    this.eggProjectListElement.replaceChildren();
    this.seedProjectListElement.replaceChildren();

    for (const projectDefinition of this.gameStateSnapshot.projectDefinitions) {
      const button = this.createProjectButton(projectDefinition);

      if (projectDefinition.type === "egg") {
        this.eggProjectListElement.append(button);
      } else {
        this.seedProjectListElement.append(button);
      }
    }
  }

  private async handleStartButtonClick(): Promise<void> {
    if (this.getSelectedDurationSeconds() <= 0) {
      this.options.showStatus("Enter a focus duration.", true);
      this.updateActionButtons();
      return;
    }

    const timerResponse = await this.options.runtimeClient.startTimer(this.getSelectedDurationSeconds());
    await this.options.onTimerResponse(timerResponse);

    if ("error" in timerResponse) {
      this.options.showStatus(timerResponse.error, true);
    }

    await this.options.refreshGameDisplay();
  }

  private async handlePauseButtonClick(): Promise<void> {
    await this.options.onTimerResponse(await this.options.runtimeClient.pauseTimer());
    await this.options.refreshGameDisplay();
  }

  private async handleResetButtonClick(): Promise<void> {
    if (this.getSelectedDurationSeconds() <= 0) {
      this.options.showStatus("Enter a focus duration.", true);
      this.updateActionButtons();
      return;
    }

    await this.options.onTimerResponse(await this.options.runtimeClient.resetTimer(this.getSelectedDurationSeconds()));
    await this.options.refreshGameDisplay();
  }

  private async handleSelectProject(projectId: ProjectId): Promise<void> {
    await this.options.onGameResponse(await this.options.runtimeClient.selectProject(projectId));
    this.renderProjectPicker();
  }

  private async handleClaimProjectButtonClick(): Promise<void> {
    await this.options.onGameResponse(await this.options.runtimeClient.claimActiveProject());
    await this.options.refreshTimerDisplay();
  }
}

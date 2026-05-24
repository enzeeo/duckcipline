import { DUCK_GROWTH_SEED_REQUIREMENTS } from "../shared/balance.js";
import { getActivityLabel } from "../shared/duckDefinitions.js";
import { HOMESTEAD_FRAME_GUTTER } from "../shared/homesteadMap.js";
import type {
  Duck,
  DuckPosition,
  FeedDuckMode,
  GameMessageResponse,
  GameStatusResponse,
  HomesteadSaveSnapshot
} from "../shared/types.js";
import { createHomesteadInteraction, type HomesteadCanvasMetrics, type HomesteadInteractionEffect, type HomesteadInteractionSnapshot } from "./homesteadInteraction.js";
import { renderHomesteadCanvas } from "./canvasRenderer.js";
import type { PopupRuntimeClient } from "./popupRuntimeClient.js";
import type { SpriteMap } from "./assetLoader.js";

export interface HomesteadViewOptions {
  runtimeClient: PopupRuntimeClient;
  showStatus(message: string | null, isError?: boolean): void;
  onGameResponse(gameResponse: GameMessageResponse): Promise<void>;
  isHomesteadActive(): boolean;
}

function getRequiredElement<T extends HTMLElement>(elementId: string, constructor: { new (): T }): T {
  const element = document.getElementById(elementId);

  if (!(element instanceof constructor)) {
    throw new Error(`Required element not found: ${elementId}`);
  }

  return element;
}

export class HomesteadView {
  private readonly homesteadTabElement = getRequiredElement("homesteadTab", HTMLElement);
  private readonly homesteadFrameElement = getRequiredElement("homesteadFrame", HTMLDivElement);
  private readonly homesteadCanvasElement = getRequiredElement("homesteadCanvas", HTMLCanvasElement);
  private readonly placementHintTextElement = getRequiredElement("placementHintText", HTMLParagraphElement);
  private readonly unplacedDuckTrayElement = getRequiredElement("unplacedDuckTray", HTMLDivElement);
  private readonly duckDetailsEmptyTextElement = getRequiredElement("duckDetailsEmptyText", HTMLParagraphElement);
  private readonly duckDetailsContentElement = getRequiredElement("duckDetailsContent", HTMLDivElement);
  private readonly selectedDuckNameTextElement = getRequiredElement("selectedDuckNameText", HTMLInputElement);
  private readonly selectedDuckStageTextElement = getRequiredElement("selectedDuckStageText", HTMLParagraphElement);
  private readonly selectedDuckMetaTextElement = getRequiredElement("selectedDuckMetaText", HTMLParagraphElement);
  private readonly feedOneSeedButtonElement = getRequiredElement("feedOneSeedButton", HTMLButtonElement);
  private readonly feedToNextStageButtonElement = getRequiredElement("feedToNextStageButton", HTMLButtonElement);
  private readonly followDuckButtonElement = getRequiredElement("followDuckButton", HTMLButtonElement);

  private gameStateSnapshot: GameStatusResponse | null = null;
  private homesteadInteractionSnapshot: HomesteadInteractionSnapshot | null = null;
  private spriteMap: SpriteMap = {};
  private readonly homesteadInteraction = createHomesteadInteraction();
  private animationFrameId: number | null = null;

  constructor(private readonly options: HomesteadViewOptions) {}

  bindEvents(): void {
    this.selectedDuckNameTextElement.addEventListener("blur", () => {
      this.handleRenameDuck().catch(() => {
        this.options.showStatus("Rename failed.", true);
      });
    });
    this.selectedDuckNameTextElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        this.selectedDuckNameTextElement.blur();
      }
    });
    this.feedOneSeedButtonElement.addEventListener("click", () => {
      this.handleFeedDuck("single").catch(() => {
        this.options.showStatus("Feed failed.", true);
      });
    });
    this.feedToNextStageButtonElement.addEventListener("click", () => {
      this.handleFeedDuck("toNextStage").catch(() => {
        this.options.showStatus("Feed failed.", true);
      });
    });
    this.followDuckButtonElement.addEventListener("click", () => {
      this.applyHomesteadEffect(this.homesteadInteraction.dispatch({
        type: "followToggled",
        canvasSize: this.getHomesteadCanvasSize(),
        timestampMilliseconds: performance.now()
      })).catch(() => {
        this.options.showStatus("Homestead unavailable.", true);
      });
    });

    this.homesteadCanvasElement.addEventListener("pointerdown", (event) => {
      this.handleCanvasPointerDown(event);
    });
    this.homesteadCanvasElement.addEventListener("pointermove", (event) => {
      this.handleCanvasPointerMove(event);
    });
    this.homesteadCanvasElement.addEventListener("pointerup", (event) => {
      this.handleCanvasPointerUp(event);
    });
    this.homesteadCanvasElement.addEventListener("pointercancel", (event) => {
      this.handleCanvasPointerUp(event);
    });
    this.homesteadCanvasElement.addEventListener("wheel", (event) => {
      if (this.gameStateSnapshot === null) {
        return;
      }

      event.preventDefault();
      const zoomMultiplier = event.deltaY < 0 ? 1.1 : 0.9;
      this.applyHomesteadEffect(this.homesteadInteraction.dispatch({
        type: "wheelZoomed",
        requestedZoom: this.gameStateSnapshot.gameState.homesteadCamera.zoom * zoomMultiplier,
        clientX: event.clientX,
        clientY: event.clientY,
        canvasMetrics: this.getHomesteadCanvasMetrics()
      })).catch(() => {
        this.options.showStatus("Homestead unavailable.", true);
      });
    }, { passive: false });
    this.homesteadCanvasElement.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    this.homesteadCanvasElement.addEventListener("drop", (event) => {
      event.preventDefault();
      const duckId = event.dataTransfer?.getData("text/plain") || null;
      this.applyHomesteadEffect(this.homesteadInteraction.dispatch({
        type: "nativeDuckDropped",
        duckId,
        clientX: event.clientX,
        clientY: event.clientY,
        canvasMetrics: this.getHomesteadCanvasMetrics()
      })).catch(() => {
        this.options.showStatus("Placement failed.", true);
      });
    });

    new ResizeObserver(() => {
      this.resizeCanvasToFrame();
      this.renderCanvas();
    }).observe(this.homesteadFrameElement);

    window.addEventListener("beforeunload", () => {
      this.saveHomesteadState().catch(() => {});
    });
  }

  setSpriteMap(spriteMap: SpriteMap): void {
    this.spriteMap = spriteMap;
    this.renderCanvas();
  }

  async syncGameResponse(gameResponse: GameStatusResponse): Promise<GameStatusResponse> {
    const effect = this.homesteadInteraction.dispatch({
      type: "gameResponseSynced",
      gameResponse,
      isHomesteadActive: this.options.isHomesteadActive(),
      nowTimestampMilliseconds: Date.now()
    });
    await this.applyHomesteadEffect(effect);
    this.syncGameStateSnapshotFromHomestead();
    this.updateFollowDuckButton();
    return this.gameStateSnapshot ?? gameResponse;
  }

  renderGame(): void {
    this.renderUnplacedDuckTray();
    this.renderDuckDetails();
    this.resizeCanvasToFrame();
    this.renderCanvas();
  }

  async activate(): Promise<void> {
    this.resizeCanvasToFrame();
    this.startAnimationLoop();
    await this.applyHomesteadEffect(this.homesteadInteraction.dispatch({
      type: "catchUpAfterAway",
      nowTimestampMilliseconds: Date.now(),
      random: Math.random
    }));
  }

  async deactivate(): Promise<void> {
    await this.applyHomesteadEffect(this.homesteadInteraction.dispatch({
      type: "homesteadDeactivated",
      nowTimestampMilliseconds: Date.now()
    }));
    this.stopAnimationLoop();
  }

  async saveHomesteadState(): Promise<void> {
    await this.applyHomesteadEffect(this.homesteadInteraction.dispatch({
      type: "homesteadSaveRequested",
      nowTimestampMilliseconds: Date.now()
    }));
  }

  resizeCanvasToFrame(): void {
    if (this.gameStateSnapshot === null || this.homesteadTabElement.hidden) {
      return;
    }

    const frameBounds = this.homesteadFrameElement.getBoundingClientRect();
    const canvasWidth = Math.max(240, Math.floor(frameBounds.width - HOMESTEAD_FRAME_GUTTER * 2));
    const canvasHeight = Math.max(220, Math.floor(frameBounds.height - HOMESTEAD_FRAME_GUTTER * 2));

    if (this.homesteadCanvasElement.width !== canvasWidth || this.homesteadCanvasElement.height !== canvasHeight) {
      this.homesteadCanvasElement.width = canvasWidth;
      this.homesteadCanvasElement.height = canvasHeight;
    }

    this.homesteadInteraction.dispatch({ type: "canvasResized", canvasSize: { width: canvasWidth, height: canvasHeight } });
    this.syncGameStateSnapshotFromHomestead();
  }

  renderCanvas(): void {
    const renderState = this.homesteadInteractionSnapshot?.renderState ?? null;

    if (renderState === null) {
      return;
    }

    renderHomesteadCanvas({
      canvas: this.homesteadCanvasElement,
      camera: renderState.camera,
      ducks: renderState.ducks,
      animationFrameIndex: Math.floor(Date.now() / 180) % 4,
      currentTimestampMilliseconds: Date.now(),
      spriteMap: this.spriteMap
    });
  }

  private getHomesteadCanvasMetrics(): HomesteadCanvasMetrics {
    const canvasBounds = this.homesteadCanvasElement.getBoundingClientRect();

    return {
      width: this.homesteadCanvasElement.width,
      height: this.homesteadCanvasElement.height,
      boundsLeft: canvasBounds.left,
      boundsTop: canvasBounds.top,
      boundsWidth: canvasBounds.width,
      boundsHeight: canvasBounds.height
    };
  }

  private getHomesteadCanvasSize(): { width: number; height: number } {
    return {
      width: this.homesteadCanvasElement.width,
      height: this.homesteadCanvasElement.height
    };
  }

  private syncGameStateSnapshotFromHomestead(): void {
    this.homesteadInteractionSnapshot = this.homesteadInteraction.getSnapshot();
    this.gameStateSnapshot = this.homesteadInteractionSnapshot?.gameResponse ?? null;
  }

  private updateFollowDuckButton(): void {
    this.followDuckButtonElement.textContent = this.homesteadInteractionSnapshot?.isFollowingSelectedDuck ? "Unfollow" : "Follow";
  }

  private createDuckThumbnail(duck: Duck): HTMLButtonElement {
    const button = document.createElement("button");
    const sprite = document.createElement("span");

    button.className = "duck-thumbnail";
    button.classList.toggle("is-selected", this.homesteadInteractionSnapshot?.selectedUnplacedDuckId === duck.id);
    button.dataset.duckId = duck.id;
    button.type = "button";
    button.draggable = true;
    button.title = duck.name;
    sprite.className = "duck-thumbnail-sprite";
    button.append(sprite);
    button.addEventListener("click", () => {
      this.applyHomesteadEffect(this.homesteadInteraction.dispatch({ type: "unplacedDuckClicked", duckId: duck.id })).catch(() => {
        this.options.showStatus("Homestead unavailable.", true);
      });
    });
    button.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", duck.id);
      this.applyHomesteadEffect(this.homesteadInteraction.dispatch({ type: "nativeDuckDragStarted", duckId: duck.id })).catch(() => {
        this.options.showStatus("Homestead unavailable.", true);
      });
    });
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }

      this.applyHomesteadEffect(this.homesteadInteraction.dispatch({
        type: "unplacedDuckDragStarted",
        duckId: duck.id,
        pointer: { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY }
      })).catch(() => {
        this.options.showStatus("Homestead unavailable.", true);
      });
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointermove", (event) => {
      this.applyHomesteadEffect(this.homesteadInteraction.dispatch({
        type: "unplacedDuckDragMoved",
        pointer: { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY }
      })).catch(() => {
        this.options.showStatus("Homestead unavailable.", true);
      });
    });
    button.addEventListener("pointerup", (event) => {
      this.applyHomesteadEffect(this.homesteadInteraction.dispatch({
        type: "unplacedDuckDragEnded",
        pointer: { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY },
        canvasMetrics: this.getHomesteadCanvasMetrics()
      })).catch(() => {
        this.options.showStatus("Placement failed.", true);
      });
    });
    button.addEventListener("pointercancel", () => {
      this.applyHomesteadEffect(this.homesteadInteraction.dispatch({ type: "unplacedDuckDragCanceled", duckId: duck.id })).catch(() => {
        this.options.showStatus("Homestead unavailable.", true);
      });
    });

    return button;
  }

  private renderUnplacedDuckTray(): void {
    if (this.gameStateSnapshot === null) {
      return;
    }

    const unplacedDucks = this.homesteadInteractionSnapshot?.unplacedDucks ?? [];
    this.unplacedDuckTrayElement.replaceChildren();

    if (unplacedDucks.length === 0) {
      const emptyText = document.createElement("p");
      emptyText.className = "drawer-empty";
      emptyText.textContent = "No ducks waiting.";
      this.unplacedDuckTrayElement.append(emptyText);
      return;
    }

    for (const duck of unplacedDucks) {
      this.unplacedDuckTrayElement.append(this.createDuckThumbnail(duck));
    }
  }

  private getSelectedDuck(): Duck | null {
    return this.homesteadInteractionSnapshot?.selectedDuck ?? null;
  }

  private getSeedsNeededForSelectedDuck(duck: Duck): number | null {
    if (duck.growthStage === "adultDuck") {
      return null;
    }

    return DUCK_GROWTH_SEED_REQUIREMENTS[duck.growthStage] - duck.seedsFedForCurrentStage;
  }

  private renderDuckDetails(): void {
    const selectedDuck = this.getSelectedDuck();

    if (selectedDuck === null) {
      this.duckDetailsEmptyTextElement.hidden = false;
      this.duckDetailsContentElement.hidden = true;
      return;
    }

    const seedsNeeded = this.getSeedsNeededForSelectedDuck(selectedDuck);
    const ageSeconds = Math.max(
      0,
      Math.floor(((this.gameStateSnapshot?.nowTimestampMilliseconds ?? Date.now()) - selectedDuck.hatchedAtTimestampMilliseconds) / 1000)
    );
    const seedCount = this.gameStateSnapshot?.gameState.seedCount ?? 0;

    this.duckDetailsEmptyTextElement.hidden = true;
    this.duckDetailsContentElement.hidden = false;
    if (document.activeElement !== this.selectedDuckNameTextElement) {
      this.selectedDuckNameTextElement.value = selectedDuck.name;
    }
    this.selectedDuckStageTextElement.textContent = selectedDuck.growthStage;
    this.selectedDuckMetaTextElement.textContent =
      `${selectedDuck.variantId} · ${getActivityLabel(selectedDuck.activity)} · ` +
      `${selectedDuck.favoriteActivity} · Age ${ageSeconds}s` +
      (seedsNeeded === null ? " · fully grown" : ` · ${selectedDuck.seedsFedForCurrentStage} fed, ${seedsNeeded} to grow`);
    this.updateFollowDuckButton();
    this.feedOneSeedButtonElement.disabled = seedsNeeded === null || seedCount < 1;
    this.feedToNextStageButtonElement.disabled = seedsNeeded === null || seedCount < seedsNeeded;
  }

  private async placeDuckAtWorldPosition(duckId: string, worldPosition: DuckPosition): Promise<void> {
    await this.options.onGameResponse(await this.options.runtimeClient.placeDuck(duckId, worldPosition));
    await this.applyHomesteadEffect(this.homesteadInteraction.dispatch({
      type: "duckPlacementSucceeded",
      duckId,
      canvasSize: this.getHomesteadCanvasSize(),
      timestampMilliseconds: performance.now()
    }));
  }

  private handleCanvasPointerDown(event: PointerEvent): void {
    this.applyHomesteadEffect(this.homesteadInteraction.dispatch({
      type: "canvasPointerDown",
      pointer: { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY },
      canvasMetrics: this.getHomesteadCanvasMetrics(),
      timestampMilliseconds: performance.now()
    })).catch(() => {
      this.options.showStatus("Homestead unavailable.", true);
    });
  }

  private handleCanvasPointerMove(event: PointerEvent): void {
    this.applyHomesteadEffect(this.homesteadInteraction.dispatch({
      type: "canvasPointerMove",
      pointer: { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY },
      canvasMetrics: this.getHomesteadCanvasMetrics()
    })).catch(() => {
      this.options.showStatus("Homestead unavailable.", true);
    });
  }

  private handleCanvasPointerUp(event: PointerEvent): void {
    this.applyHomesteadEffect(this.homesteadInteraction.dispatch({
      type: "canvasPointerUp",
      pointer: { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY },
      canvasMetrics: this.getHomesteadCanvasMetrics()
    })).catch(() => {
      this.options.showStatus("Placement failed.", true);
    });
  }

  private animationLoop(timestampMilliseconds: number): void {
    this.applyHomesteadEffect(this.homesteadInteraction.dispatch({
      type: "animationFrameAdvanced",
      timestampMilliseconds,
      isHomesteadActive: this.options.isHomesteadActive(),
      canvasSize: this.getHomesteadCanvasSize(),
      nowTimestampMilliseconds: Date.now(),
      random: Math.random
    })).catch(() => {
      this.options.showStatus("Homestead unavailable.", true);
    });

    this.animationFrameId = window.requestAnimationFrame((nextTimestampMilliseconds) => {
      this.animationLoop(nextTimestampMilliseconds);
    });
  }

  private startAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      return;
    }

    this.homesteadInteraction.dispatch({ type: "animationStarted" });
    this.animationFrameId = window.requestAnimationFrame((timestampMilliseconds) => {
      this.animationLoop(timestampMilliseconds);
    });
  }

  private stopAnimationLoop(): void {
    if (this.animationFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }

  private async sendHomesteadSave(saveSnapshot: HomesteadSaveSnapshot | null): Promise<void> {
    if (saveSnapshot === null) {
      return;
    }

    await this.options.runtimeClient.saveHomesteadState(saveSnapshot);
  }

  private async applyHomesteadEffect(effect: HomesteadInteractionEffect): Promise<void> {
    this.syncGameStateSnapshotFromHomestead();
    this.updateFollowDuckButton();

    if (effect.captureCanvasPointerId !== null) {
      this.homesteadCanvasElement.setPointerCapture(effect.captureCanvasPointerId);
    }

    if (effect.isCanvasDragging !== null) {
      this.homesteadCanvasElement.classList.toggle("is-dragging", effect.isCanvasDragging);
    }

    if (effect.duckThumbnailDrag !== null) {
      const thumbnailElement = this.unplacedDuckTrayElement.querySelector<HTMLButtonElement>(
        `.duck-thumbnail[data-duck-id="${CSS.escape(effect.duckThumbnailDrag.duckId)}"]`
      );
      thumbnailElement?.classList.toggle("is-pointer-dragging", effect.duckThumbnailDrag.isDragging);
    }

    if (effect.placementHintText !== null) {
      this.placementHintTextElement.textContent = effect.placementHintText;
    }

    if (effect.statusMessage !== null) {
      this.options.showStatus(effect.statusMessage.text, effect.statusMessage.isError);
    }

    if (effect.renderUnplacedDuckTray) {
      this.renderUnplacedDuckTray();
    }

    if (effect.renderDuckDetails) {
      this.renderDuckDetails();
    }

    if (effect.renderCanvas) {
      this.renderCanvas();
    }

    if (effect.placementRequest !== null) {
      await this.placeDuckAtWorldPosition(effect.placementRequest.duckId, effect.placementRequest.worldPosition);
    }

    await this.sendHomesteadSave(effect.saveHomesteadState);
  }

  private async handleRenameDuck(): Promise<void> {
    const selectedDuck = this.getSelectedDuck();

    if (selectedDuck === null) {
      return;
    }

    await this.options.onGameResponse(await this.options.runtimeClient.renameDuck(selectedDuck.id, this.selectedDuckNameTextElement.value));
  }

  private async handleFeedDuck(feedMode: FeedDuckMode): Promise<void> {
    const selectedDuck = this.getSelectedDuck();

    if (selectedDuck === null) {
      return;
    }

    await this.options.onGameResponse(await this.options.runtimeClient.feedDuck(selectedDuck.id, feedMode));
  }
}

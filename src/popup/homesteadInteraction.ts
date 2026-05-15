import {
  HOMESTEAD_MAX_ZOOM,
  HOMESTEAD_MIN_ZOOM,
  HOMESTEAD_TILE_SIZE,
  clampCamera,
  getCenteredTileWorldPosition,
  getTilePositionFromWorldPosition,
  getTileTerrainKindAt,
  isManualDuckPlacementValid
} from "../shared/homesteadMap.js";
import { isDuckEatingAnimationActive } from "../shared/duckAnimation.js";
import type {
  Duck,
  DuckActivity,
  DuckPosition,
  DuckSimulationStateUpdate,
  GameStatusResponse,
  HomesteadCameraState
} from "../shared/types.js";
import {
  pruneDuckRoamStates,
  simulateDuckMovementCatchUp,
  simulateDuckMovement as simulateHomesteadDuckMovement,
  type DuckRoamState
} from "./homesteadSimulation.js";

const CAMERA_FOCUS_ANIMATION_MILLISECONDS = 420;
const CAMERA_FOCUS_POSITION_EPSILON = 0.5;
const DUCK_CLICK_FOCUS_ZOOM = 1.25;
const CANVAS_POINTER_DRAG_THRESHOLD_PIXELS = 5;
const UNPLACED_DUCK_DRAG_THRESHOLD_PIXELS = 6;
const SIMULATION_SAVE_INTERVAL_MILLISECONDS = 5000;

export interface HomesteadCanvasSize {
  width: number;
  height: number;
}

export interface HomesteadCanvasMetrics extends HomesteadCanvasSize {
  boundsLeft: number;
  boundsTop: number;
  boundsWidth: number;
  boundsHeight: number;
}

export interface HomesteadPointerInput {
  pointerId: number;
  clientX: number;
  clientY: number;
}

export interface HomesteadRenderState {
  camera: HomesteadCameraState;
  ducks: Duck[];
}

interface HomesteadFrameResult {
  shouldSaveCamera: boolean;
  shouldSaveHomestead: boolean;
}

export interface HomesteadSaveSnapshot {
  camera: HomesteadCameraState;
  duckSimulationUpdates: DuckSimulationStateUpdate[];
}

interface HomesteadPlacementResult {
  isValid: boolean;
  centeredPosition: DuckPosition | null;
}

interface HomesteadPointerDownResult {
  shouldCapturePointer: boolean;
  shouldRenderCanvas: boolean;
  shouldRenderDuckDetails: boolean;
  isDraggingCamera: boolean;
}

interface HomesteadPointerMoveResult {
  shouldRenderCanvas: boolean;
}

interface HomesteadPointerUpResult {
  duckPlacementRequest: { duckId: string; worldPosition: DuckPosition } | null;
  shouldSaveCamera: boolean;
  shouldRenderCanvas: boolean;
  stoppedCameraDrag: boolean;
}

interface UnplacedDuckDragMoveResult {
  hasMoved: boolean;
}

interface UnplacedDuckDragEndResult {
  duckId: string;
  hasMoved: boolean;
}

interface PointerDragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
  startCamera: HomesteadCameraState;
  hasMoved: boolean;
}

interface PinchZoomState {
  pointerIdA: number;
  pointerIdB: number;
  startDistance: number;
  startCamera: HomesteadCameraState;
}

interface CameraFocusAnimationState {
  startedAtTimestampMilliseconds: number;
  fromCamera: HomesteadCameraState;
  toCamera: HomesteadCameraState;
}

interface UnplacedDuckPointerDragState {
  duckId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
  hasMoved: boolean;
}

export interface HomesteadInteractionSnapshot {
  gameResponse: GameStatusResponse;
  renderState: HomesteadRenderState;
  selectedDuck: Duck | null;
  selectedUnplacedDuckId: string | null;
  unplacedDucks: Duck[];
  isFollowingSelectedDuck: boolean;
}

export type HomesteadInteractionEvent =
  | {
      type: "gameResponseSynced";
      gameResponse: GameStatusResponse;
      isHomesteadActive: boolean;
      nowTimestampMilliseconds: number;
    }
  | { type: "canvasResized"; canvasSize: HomesteadCanvasSize }
  | {
      type: "canvasPointerDown";
      pointer: HomesteadPointerInput;
      canvasMetrics: HomesteadCanvasMetrics;
      timestampMilliseconds: number;
    }
  | { type: "canvasPointerMove"; pointer: HomesteadPointerInput; canvasMetrics: HomesteadCanvasMetrics }
  | { type: "canvasPointerUp"; pointer: HomesteadPointerInput; canvasMetrics: HomesteadCanvasMetrics }
  | {
      type: "wheelZoomed";
      requestedZoom: number;
      clientX: number;
      clientY: number;
      canvasMetrics: HomesteadCanvasMetrics;
    }
  | { type: "unplacedDuckClicked"; duckId: string }
  | { type: "unplacedDuckDragStarted"; duckId: string; pointer: HomesteadPointerInput }
  | { type: "unplacedDuckDragMoved"; pointer: HomesteadPointerInput }
  | { type: "unplacedDuckDragEnded"; pointer: HomesteadPointerInput; canvasMetrics: HomesteadCanvasMetrics }
  | { type: "unplacedDuckDragCanceled"; duckId: string }
  | { type: "nativeDuckDragStarted"; duckId: string }
  | { type: "nativeDuckDropped"; duckId: string | null; clientX: number; clientY: number; canvasMetrics: HomesteadCanvasMetrics }
  | { type: "followToggled"; canvasSize: HomesteadCanvasSize; timestampMilliseconds: number }
  | {
      type: "animationFrameAdvanced";
      timestampMilliseconds: number;
      isHomesteadActive: boolean;
      canvasSize: HomesteadCanvasSize;
      nowTimestampMilliseconds: number;
      random: () => number;
    }
  | { type: "catchUpAfterAway"; nowTimestampMilliseconds: number; random: () => number }
  | { type: "animationStarted" }
  | { type: "homesteadDeactivated"; nowTimestampMilliseconds: number }
  | { type: "duckPlacementSucceeded"; duckId: string; canvasSize: HomesteadCanvasSize; timestampMilliseconds: number }
  | { type: "cameraSaveRequested" }
  | { type: "homesteadSaveRequested"; nowTimestampMilliseconds: number };

export interface HomesteadInteractionEffect {
  gameResponse: GameStatusResponse | null;
  renderCanvas: boolean;
  renderDuckDetails: boolean;
  renderUnplacedDuckTray: boolean;
  captureCanvasPointerId: number | null;
  isCanvasDragging: boolean | null;
  duckThumbnailDrag: { duckId: string; isDragging: boolean } | null;
  placementRequest: { duckId: string; worldPosition: DuckPosition } | null;
  placementHintText: string | null;
  statusMessage: { text: string; isError: boolean } | null;
  saveCamera: HomesteadCameraState | null;
  saveHomestead: HomesteadSaveSnapshot | null;
}

export interface HomesteadInteraction {
  dispatch(event: HomesteadInteractionEvent): HomesteadInteractionEffect;
  getSnapshot(): HomesteadInteractionSnapshot | null;
}

function createEmptyEffect(gameResponse: GameStatusResponse | null = null): HomesteadInteractionEffect {
  return {
    gameResponse,
    renderCanvas: false,
    renderDuckDetails: false,
    renderUnplacedDuckTray: false,
    captureCanvasPointerId: null,
    isCanvasDragging: null,
    duckThumbnailDrag: null,
    placementRequest: null,
    placementHintText: null,
    statusMessage: null,
    saveCamera: null,
    saveHomestead: null
  };
}

class HomesteadInteractionController implements HomesteadInteraction {
  private gameResponse: GameStatusResponse | null = null;
  private selectedDuckId: string | null = null;
  private selectedUnplacedDuckId: string | null = null;
  private pointerDragState: PointerDragState | null = null;
  private activeCanvasPointerById = new Map<number, HomesteadPointerInput>();
  private pinchZoomState: PinchZoomState | null = null;
  private cameraFocusAnimationState: CameraFocusAnimationState | null = null;
  private unplacedDuckPointerDragState: UnplacedDuckPointerDragState | null = null;
  private suppressedThumbnailClickDuckId: string | null = null;
  private isFollowingSelectedDuck = false;
  private previousAnimationTimestampMilliseconds = 0;
  private lastSimulationSaveTimestampMilliseconds = 0;
  private lastLocalHomesteadSaveTimestampMilliseconds = 0;
  private localDucks: Duck[] = [];
  private duckRoamStateById = new Map<string, DuckRoamState>();

  dispatch(event: HomesteadInteractionEvent): HomesteadInteractionEffect {
    switch (event.type) {
      case "gameResponseSynced": {
        return createEmptyEffect(
          this.mergeGameResponse(event.gameResponse, event.isHomesteadActive, event.nowTimestampMilliseconds)
        );
      }
      case "canvasResized": {
        this.resizeCanvas(event.canvasSize);
        return createEmptyEffect(this.gameResponse);
      }
      case "canvasPointerDown": {
        const result = this.handleCanvasPointerDown(event.pointer, event.canvasMetrics, event.timestampMilliseconds);
        return {
          ...createEmptyEffect(this.gameResponse),
          captureCanvasPointerId: result.shouldCapturePointer ? event.pointer.pointerId : null,
          isCanvasDragging: result.isDraggingCamera ? true : null,
          renderCanvas: result.shouldRenderCanvas,
          renderDuckDetails: result.shouldRenderDuckDetails
        };
      }
      case "canvasPointerMove": {
        const result = this.handleCanvasPointerMove(event.pointer, event.canvasMetrics);
        return {
          ...createEmptyEffect(this.gameResponse),
          renderCanvas: result.shouldRenderCanvas
        };
      }
      case "canvasPointerUp": {
        const result = this.handleCanvasPointerUp(event.pointer, event.canvasMetrics);
        const placementEffect =
          result.duckPlacementRequest === null
            ? {}
            : this.createPlacementEffectFromWorldPosition(
              result.duckPlacementRequest.duckId,
              result.duckPlacementRequest.worldPosition
            );

        return {
          ...createEmptyEffect(this.gameResponse),
          ...placementEffect,
          isCanvasDragging: result.stoppedCameraDrag ? false : null,
          renderCanvas: result.shouldRenderCanvas,
          saveCamera: result.shouldSaveCamera ? this.createCameraSaveState() : null
        };
      }
      case "wheelZoomed": {
        const didZoom = this.handleWheelZoom(event.requestedZoom, event.clientX, event.clientY, event.canvasMetrics);
        return {
          ...createEmptyEffect(this.gameResponse),
          renderCanvas: didZoom,
          renderDuckDetails: didZoom,
          saveCamera: didZoom ? this.createCameraSaveState() : null
        };
      }
      case "unplacedDuckClicked": {
        if (this.consumeSuppressedThumbnailClick(event.duckId)) {
          return createEmptyEffect(this.gameResponse);
        }

        const selectedUnplacedDuckId = this.toggleUnplacedDuckSelection(event.duckId);
        return {
          ...createEmptyEffect(this.gameResponse),
          placementHintText: selectedUnplacedDuckId ? "Click a valid grass/path tile." : "Click a duck, then click the map.",
          renderUnplacedDuckTray: true,
          renderCanvas: true
        };
      }
      case "nativeDuckDragStarted": {
        this.selectUnplacedDuck(event.duckId);
        return createEmptyEffect(this.gameResponse);
      }
      case "unplacedDuckDragStarted": {
        this.startUnplacedDuckPointerDrag(event.duckId, event.pointer);
        return createEmptyEffect(this.gameResponse);
      }
      case "unplacedDuckDragMoved": {
        const result = this.moveUnplacedDuckPointerDrag(event.pointer);

        return {
          ...createEmptyEffect(this.gameResponse),
          duckThumbnailDrag: result === null ? null : {
            duckId: this.unplacedDuckPointerDragState?.duckId ?? "",
            isDragging: result.hasMoved
          }
        };
      }
      case "unplacedDuckDragEnded": {
        const result = this.endUnplacedDuckPointerDrag(event.pointer.pointerId);

        if (result === null) {
          return createEmptyEffect(this.gameResponse);
        }

        return {
          ...createEmptyEffect(this.gameResponse),
          duckThumbnailDrag: { duckId: result.duckId, isDragging: false },
          ...(result.hasMoved
            ? this.createPlacementEffectFromClientPoint(
              result.duckId,
              event.pointer.clientX,
              event.pointer.clientY,
              event.canvasMetrics
            )
            : {})
        };
      }
      case "unplacedDuckDragCanceled": {
        return {
          ...createEmptyEffect(this.gameResponse),
          duckThumbnailDrag: this.cancelUnplacedDuckPointerDrag(event.duckId)
            ? { duckId: event.duckId, isDragging: false }
            : null
        };
      }
      case "nativeDuckDropped": {
        const duckId = event.duckId ?? this.selectedUnplacedDuckId;

        return {
          ...createEmptyEffect(this.gameResponse),
          ...(duckId === null ? {} : this.createPlacementEffectFromClientPoint(duckId, event.clientX, event.clientY, event.canvasMetrics))
        };
      }
      case "followToggled": {
        const isFollowingSelectedDuck = this.toggleFollowSelectedDuck(event.canvasSize, event.timestampMilliseconds);

        return {
          ...createEmptyEffect(this.gameResponse),
          renderCanvas: isFollowingSelectedDuck
        };
      }
      case "animationFrameAdvanced": {
        const result = this.advanceAnimationFrame(event);

        return {
          ...createEmptyEffect(this.gameResponse),
          renderCanvas: true,
          saveCamera: result.shouldSaveCamera ? this.createCameraSaveState() : null,
          saveHomestead: result.shouldSaveHomestead ? this.createHomesteadSaveSnapshot(event.nowTimestampMilliseconds) : null
        };
      }
      case "catchUpAfterAway": {
        const didCatchUp = this.catchUpAfterAway(event.nowTimestampMilliseconds, event.random);

        return {
          ...createEmptyEffect(this.gameResponse),
          renderCanvas: didCatchUp,
          renderDuckDetails: didCatchUp,
          saveHomestead: didCatchUp ? this.createHomesteadSaveSnapshot(event.nowTimestampMilliseconds) : null
        };
      }
      case "animationStarted": {
        this.resetAnimationClock();
        return createEmptyEffect(this.gameResponse);
      }
      case "homesteadDeactivated": {
        return {
          ...createEmptyEffect(this.gameResponse),
          saveHomestead: this.createHomesteadSaveSnapshot(event.nowTimestampMilliseconds)
        };
      }
      case "duckPlacementSucceeded": {
        this.finishDuckPlacement(event.duckId, event.canvasSize, event.timestampMilliseconds);
        return {
          ...createEmptyEffect(this.gameResponse),
          placementHintText: "Duck placed.",
          renderCanvas: true,
          renderDuckDetails: true,
          renderUnplacedDuckTray: true
        };
      }
      case "cameraSaveRequested": {
        return {
          ...createEmptyEffect(this.gameResponse),
          saveCamera: this.createCameraSaveState()
        };
      }
      case "homesteadSaveRequested": {
        return {
          ...createEmptyEffect(this.gameResponse),
          saveHomestead: this.createHomesteadSaveSnapshot(event.nowTimestampMilliseconds)
        };
      }
    }
  }

  getSnapshot(): HomesteadInteractionSnapshot | null {
    const renderState = this.getRenderState();

    if (this.gameResponse === null || renderState === null) {
      return null;
    }

    return {
      gameResponse: this.gameResponse,
      renderState,
      selectedDuck: this.getSelectedDuck(),
      selectedUnplacedDuckId: this.selectedUnplacedDuckId,
      unplacedDucks: this.getUnplacedDucks(),
      isFollowingSelectedDuck: this.isFollowingSelectedDuck
    };
  }

  mergeGameResponse(
    gameResponse: GameStatusResponse,
    isHomesteadActive: boolean,
    nowTimestampMilliseconds: number
  ): GameStatusResponse {
    const mergedDucks = this.mergeLiveDuckSimulationState(
      gameResponse.gameState.ducks,
      isHomesteadActive,
      nowTimestampMilliseconds
    );
    this.gameResponse = {
      ...gameResponse,
      gameState: {
        ...gameResponse.gameState,
        ducks: mergedDucks
      }
    };
    this.setLocalDucks(mergedDucks);
    this.duckRoamStateById = pruneDuckRoamStates(this.localDucks, this.duckRoamStateById);

    return this.gameResponse;
  }

  getGameResponse(): GameStatusResponse | null {
    return this.gameResponse;
  }

  getRenderState(): HomesteadRenderState | null {
    if (this.gameResponse === null) {
      return null;
    }

    return {
      camera: this.gameResponse.gameState.homesteadCamera,
      ducks: this.localDucks
    };
  }

  getSelectedDuck(): Duck | null {
    if (this.selectedDuckId === null) {
      return null;
    }

    return this.localDucks.find((duck) => duck.id === this.selectedDuckId) ?? null;
  }

  getSelectedUnplacedDuckId(): string | null {
    return this.selectedUnplacedDuckId;
  }

  getUnplacedDucks(): Duck[] {
    return this.gameResponse?.gameState.ducks.filter((duck) => duck.placementStatus === "unplaced") ?? [];
  }

  getIsFollowingSelectedDuck(): boolean {
    return this.isFollowingSelectedDuck;
  }

  getPointerWorldPosition(clientX: number, clientY: number, canvasMetrics: HomesteadCanvasMetrics): DuckPosition {
    const scaleX = canvasMetrics.width / canvasMetrics.boundsWidth;
    const scaleY = canvasMetrics.height / canvasMetrics.boundsHeight;
    const canvasX = (clientX - canvasMetrics.boundsLeft) * scaleX;
    const canvasY = (clientY - canvasMetrics.boundsTop) * scaleY;
    const camera = this.gameResponse?.gameState.homesteadCamera ?? { x: 0, y: 0, zoom: 1 };

    return {
      x: canvasX / camera.zoom + camera.x,
      y: canvasY / camera.zoom + camera.y
    };
  }

  findDuckAtWorldPosition(position: DuckPosition): Duck | null {
    for (const duck of this.localDucks) {
      if (duck.placementStatus !== "placed" || duck.position === null) {
        continue;
      }

      const distanceX = Math.abs(duck.position.x - position.x);
      const distanceY = Math.abs(duck.position.y - position.y);

      if (distanceX <= HOMESTEAD_TILE_SIZE / 2 && distanceY <= HOMESTEAD_TILE_SIZE / 2) {
        return duck;
      }
    }

    return null;
  }

  resizeCanvas(canvasSize: HomesteadCanvasSize): void {
    if (this.gameResponse === null) {
      return;
    }

    this.updateCamera(clampCamera(this.gameResponse.gameState.homesteadCamera, canvasSize.width, canvasSize.height));
  }

  createPlacementResult(worldPosition: DuckPosition): HomesteadPlacementResult {
    const tileColumn = Math.floor(worldPosition.x / HOMESTEAD_TILE_SIZE);
    const tileRow = Math.floor(worldPosition.y / HOMESTEAD_TILE_SIZE);
    const centeredPosition = getCenteredTileWorldPosition(tileColumn, tileRow);

    if (!isManualDuckPlacementValid(centeredPosition)) {
      return {
        isValid: false,
        centeredPosition: null
      };
    }

    return {
      isValid: true,
      centeredPosition
    };
  }

  createPlacementEffectFromClientPoint(
    duckId: string,
    clientX: number,
    clientY: number,
    canvasMetrics: HomesteadCanvasMetrics
  ): Partial<HomesteadInteractionEffect> {
    if (!this.isClientPointInsideCanvas(clientX, clientY, canvasMetrics)) {
      return {};
    }

    return this.createPlacementEffectFromWorldPosition(
      duckId,
      this.getPointerWorldPosition(clientX, clientY, canvasMetrics)
    );
  }

  createPlacementEffectFromWorldPosition(
    duckId: string,
    worldPosition: DuckPosition
  ): Partial<HomesteadInteractionEffect> {
    const placementResult = this.createPlacementResult(worldPosition);

    if (!placementResult.isValid || placementResult.centeredPosition === null) {
      return {
        placementHintText: "That tile is blocked.",
        statusMessage: { text: "Invalid placement.", isError: true },
        renderCanvas: true
      };
    }

    return {
      placementRequest: {
        duckId,
        worldPosition: placementResult.centeredPosition
      }
    };
  }

  finishDuckPlacement(duckId: string, canvasSize: HomesteadCanvasSize, timestampMilliseconds: number): void {
    this.selectedUnplacedDuckId = null;
    this.selectedDuckId = duckId;
    this.setFollowSelectedDuck(false);
    this.resetDuckRoamState(duckId);
    const placedDuck = this.localDucks.find((duck) => duck.id === duckId);

    if (placedDuck !== undefined) {
      this.startCameraFocusOnDuck(placedDuck, canvasSize, timestampMilliseconds);
    }
  }

  setFollowSelectedDuck(isFollowing: boolean): void {
    this.isFollowingSelectedDuck = isFollowing && this.selectedDuckId !== null;
  }

  toggleFollowSelectedDuck(canvasSize: HomesteadCanvasSize, timestampMilliseconds: number): boolean {
    const selectedDuck = this.getSelectedDuck();

    if (selectedDuck === null) {
      return false;
    }

    this.setFollowSelectedDuck(!this.isFollowingSelectedDuck);

    if (this.isFollowingSelectedDuck) {
      this.startCameraFocusOnDuck(selectedDuck, canvasSize, timestampMilliseconds);
    }

    return this.isFollowingSelectedDuck;
  }

  stopFollowingForManualCameraInput(): void {
    if (this.isFollowingSelectedDuck) {
      this.setFollowSelectedDuck(false);
    }

    this.cameraFocusAnimationState = null;
  }

  consumeSuppressedThumbnailClick(duckId: string): boolean {
    if (this.suppressedThumbnailClickDuckId !== duckId) {
      return false;
    }

    this.suppressedThumbnailClickDuckId = null;
    return true;
  }

  toggleUnplacedDuckSelection(duckId: string): string | null {
    this.selectedUnplacedDuckId = this.selectedUnplacedDuckId === duckId ? null : duckId;
    return this.selectedUnplacedDuckId;
  }

  selectUnplacedDuck(duckId: string): void {
    this.selectedUnplacedDuckId = duckId;
  }

  startUnplacedDuckPointerDrag(duckId: string, pointer: HomesteadPointerInput): void {
    this.selectedUnplacedDuckId = duckId;
    this.unplacedDuckPointerDragState = {
      duckId,
      pointerId: pointer.pointerId,
      startClientX: pointer.clientX,
      startClientY: pointer.clientY,
      currentClientX: pointer.clientX,
      currentClientY: pointer.clientY,
      hasMoved: false
    };
  }

  moveUnplacedDuckPointerDrag(pointer: HomesteadPointerInput): UnplacedDuckDragMoveResult | null {
    if (
      this.unplacedDuckPointerDragState === null ||
      this.unplacedDuckPointerDragState.pointerId !== pointer.pointerId
    ) {
      return null;
    }

    const totalDeltaX = Math.abs(pointer.clientX - this.unplacedDuckPointerDragState.startClientX);
    const totalDeltaY = Math.abs(pointer.clientY - this.unplacedDuckPointerDragState.startClientY);
    this.unplacedDuckPointerDragState.currentClientX = pointer.clientX;
    this.unplacedDuckPointerDragState.currentClientY = pointer.clientY;
    this.unplacedDuckPointerDragState.hasMoved =
      this.unplacedDuckPointerDragState.hasMoved ||
      totalDeltaX + totalDeltaY > UNPLACED_DUCK_DRAG_THRESHOLD_PIXELS;

    return {
      hasMoved: this.unplacedDuckPointerDragState.hasMoved
    };
  }

  endUnplacedDuckPointerDrag(pointerId: number): UnplacedDuckDragEndResult | null {
    if (this.unplacedDuckPointerDragState === null || this.unplacedDuckPointerDragState.pointerId !== pointerId) {
      return null;
    }

    const endedDragState = this.unplacedDuckPointerDragState;
    this.unplacedDuckPointerDragState = null;

    if (endedDragState.hasMoved) {
      this.suppressedThumbnailClickDuckId = endedDragState.duckId;
    }

    return {
      duckId: endedDragState.duckId,
      hasMoved: endedDragState.hasMoved
    };
  }

  cancelUnplacedDuckPointerDrag(duckId: string): boolean {
    if (this.unplacedDuckPointerDragState?.duckId !== duckId) {
      return false;
    }

    this.unplacedDuckPointerDragState = null;
    return true;
  }

  isClientPointInsideCanvas(clientX: number, clientY: number, canvasMetrics: HomesteadCanvasMetrics): boolean {
    return (
      clientX >= canvasMetrics.boundsLeft &&
      clientX <= canvasMetrics.boundsLeft + canvasMetrics.boundsWidth &&
      clientY >= canvasMetrics.boundsTop &&
      clientY <= canvasMetrics.boundsTop + canvasMetrics.boundsHeight
    );
  }

  handleCanvasPointerDown(
    pointer: HomesteadPointerInput,
    canvasMetrics: HomesteadCanvasMetrics,
    timestampMilliseconds: number
  ): HomesteadPointerDownResult {
    if (this.gameResponse === null) {
      return {
        shouldCapturePointer: false,
        shouldRenderCanvas: false,
        shouldRenderDuckDetails: false,
        isDraggingCamera: false
      };
    }

    this.activeCanvasPointerById.set(pointer.pointerId, pointer);

    if (this.activeCanvasPointerById.size === 2) {
      const activePointers = [...this.activeCanvasPointerById.values()];
      this.pinchZoomState = {
        pointerIdA: activePointers[0].pointerId,
        pointerIdB: activePointers[1].pointerId,
        startDistance: Math.hypot(
          activePointers[0].clientX - activePointers[1].clientX,
          activePointers[0].clientY - activePointers[1].clientY
        ),
        startCamera: this.gameResponse.gameState.homesteadCamera
      };
      this.pointerDragState = null;
      this.stopFollowingForManualCameraInput();
      return {
        shouldCapturePointer: false,
        shouldRenderCanvas: false,
        shouldRenderDuckDetails: false,
        isDraggingCamera: false
      };
    }

    const worldPosition = this.getPointerWorldPosition(pointer.clientX, pointer.clientY, canvasMetrics);
    const clickedDuck = this.findDuckAtWorldPosition(worldPosition);

    if (clickedDuck !== null) {
      this.selectedDuckId = clickedDuck.id;
      this.selectedUnplacedDuckId = null;
      this.setFollowSelectedDuck(false);
      this.startCameraFocusOnDuck(clickedDuck, canvasMetrics, timestampMilliseconds);
      this.resetDuckRoamState(clickedDuck.id);
      return {
        shouldCapturePointer: true,
        shouldRenderCanvas: true,
        shouldRenderDuckDetails: true,
        isDraggingCamera: false
      };
    }

    this.stopFollowingForManualCameraInput();
    this.pointerDragState = {
      pointerId: pointer.pointerId,
      startClientX: pointer.clientX,
      startClientY: pointer.clientY,
      lastClientX: pointer.clientX,
      lastClientY: pointer.clientY,
      startCamera: this.gameResponse.gameState.homesteadCamera,
      hasMoved: false
    };

    return {
      shouldCapturePointer: true,
      shouldRenderCanvas: false,
      shouldRenderDuckDetails: false,
      isDraggingCamera: true
    };
  }

  handleCanvasPointerMove(pointer: HomesteadPointerInput, canvasMetrics: HomesteadCanvasMetrics): HomesteadPointerMoveResult {
    if (this.activeCanvasPointerById.has(pointer.pointerId)) {
      this.activeCanvasPointerById.set(pointer.pointerId, pointer);
    }

    if (this.pinchZoomState !== null && this.gameResponse !== null) {
      const pointerA = this.activeCanvasPointerById.get(this.pinchZoomState.pointerIdA);
      const pointerB = this.activeCanvasPointerById.get(this.pinchZoomState.pointerIdB);

      if (pointerA !== undefined && pointerB !== undefined && this.pinchZoomState.startDistance > 0) {
        const nextDistance = Math.hypot(pointerA.clientX - pointerB.clientX, pointerA.clientY - pointerB.clientY);
        const centerClientX = (pointerA.clientX + pointerB.clientX) / 2;
        const centerClientY = (pointerA.clientY + pointerB.clientY) / 2;
        this.updateLocalZoom(
          this.pinchZoomState.startCamera.zoom * (nextDistance / this.pinchZoomState.startDistance),
          centerClientX,
          centerClientY,
          canvasMetrics,
          this.pinchZoomState.startCamera
        );
        return { shouldRenderCanvas: true };
      }

      return { shouldRenderCanvas: false };
    }

    if (this.pointerDragState === null || this.pointerDragState.pointerId !== pointer.pointerId) {
      return { shouldRenderCanvas: false };
    }

    const totalDeltaX = Math.abs(pointer.clientX - this.pointerDragState.startClientX);
    const totalDeltaY = Math.abs(pointer.clientY - this.pointerDragState.startClientY);
    this.pointerDragState.hasMoved =
      this.pointerDragState.hasMoved || totalDeltaX + totalDeltaY > CANVAS_POINTER_DRAG_THRESHOLD_PIXELS;

    this.updateLocalCameraFromDrag(pointer, canvasMetrics);
    this.pointerDragState.lastClientX = pointer.clientX;
    this.pointerDragState.lastClientY = pointer.clientY;

    return { shouldRenderCanvas: true };
  }

  handleCanvasPointerUp(pointer: HomesteadPointerInput, canvasMetrics: HomesteadCanvasMetrics): HomesteadPointerUpResult {
    this.activeCanvasPointerById.delete(pointer.pointerId);
    this.pinchZoomState = null;

    if (this.pointerDragState === null || this.pointerDragState.pointerId !== pointer.pointerId) {
      return {
        duckPlacementRequest: null,
        shouldSaveCamera: this.activeCanvasPointerById.size === 0,
        shouldRenderCanvas: false,
        stoppedCameraDrag: false
      };
    }

    const endedDragState = this.pointerDragState;
    this.pointerDragState = null;

    if (!endedDragState.hasMoved && this.selectedUnplacedDuckId !== null) {
      return {
        duckPlacementRequest: {
          duckId: this.selectedUnplacedDuckId,
          worldPosition: this.getPointerWorldPosition(pointer.clientX, pointer.clientY, canvasMetrics)
        },
        shouldSaveCamera: false,
        shouldRenderCanvas: true,
        stoppedCameraDrag: true
      };
    }

    return {
      duckPlacementRequest: null,
      shouldSaveCamera: true,
      shouldRenderCanvas: true,
      stoppedCameraDrag: true
    };
  }

  updateLocalZoom(
    requestedZoom: number,
    clientX: number,
    clientY: number,
    canvasMetrics: HomesteadCanvasMetrics,
    baseCamera: HomesteadCameraState | null = null
  ): void {
    if (this.gameResponse === null) {
      return;
    }

    const camera = baseCamera ?? this.gameResponse.gameState.homesteadCamera;
    const scaleX = canvasMetrics.width / canvasMetrics.boundsWidth;
    const scaleY = canvasMetrics.height / canvasMetrics.boundsHeight;
    const canvasX = (clientX - canvasMetrics.boundsLeft) * scaleX;
    const canvasY = (clientY - canvasMetrics.boundsTop) * scaleY;
    const nextZoom = Math.min(Math.max(requestedZoom, HOMESTEAD_MIN_ZOOM), HOMESTEAD_MAX_ZOOM);
    const anchorWorldX = camera.x + canvasX / camera.zoom;
    const anchorWorldY = camera.y + canvasY / camera.zoom;
    const nextCamera = clampCamera(
      {
        zoom: nextZoom,
        x: anchorWorldX - canvasX / nextZoom,
        y: anchorWorldY - canvasY / nextZoom
      },
      canvasMetrics.width,
      canvasMetrics.height
    );

    this.updateCamera(nextCamera);
  }

  handleWheelZoom(requestedZoom: number, clientX: number, clientY: number, canvasMetrics: HomesteadCanvasMetrics): boolean {
    if (this.gameResponse === null) {
      return false;
    }

    this.stopFollowingForManualCameraInput();
    this.updateLocalZoom(requestedZoom, clientX, clientY, canvasMetrics);
    return true;
  }

  catchUpAfterAway(nowTimestampMilliseconds: number, random: () => number): boolean {
    if (this.gameResponse === null) {
      return false;
    }

    const lastHomesteadSimulationTimestampMilliseconds = Math.max(
      this.gameResponse.gameState.lastHomesteadSimulationTimestampMilliseconds,
      this.lastLocalHomesteadSaveTimestampMilliseconds
    );
    const elapsedMilliseconds = nowTimestampMilliseconds - lastHomesteadSimulationTimestampMilliseconds;

    if (elapsedMilliseconds <= 0) {
      return false;
    }

    const simulationResult = simulateDuckMovementCatchUp({
      ducks: this.localDucks,
      roamStateById: this.duckRoamStateById,
      elapsedMilliseconds,
      nowTimestampMilliseconds,
      random
    });

    this.setLocalDucks(simulationResult.ducks, nowTimestampMilliseconds);
    this.duckRoamStateById = simulationResult.roamStateById;

    return simulationResult.appliedElapsedMilliseconds > 0;
  }

  advanceAnimationFrame(input: {
    timestampMilliseconds: number;
    isHomesteadActive: boolean;
    canvasSize: HomesteadCanvasSize;
    nowTimestampMilliseconds: number;
    random: () => number;
  }): HomesteadFrameResult {
    const deltaMilliseconds =
      this.previousAnimationTimestampMilliseconds === 0
        ? 16
        : input.timestampMilliseconds - this.previousAnimationTimestampMilliseconds;
    this.previousAnimationTimestampMilliseconds = input.timestampMilliseconds;

    this.simulateDuckMovement(
      deltaMilliseconds,
      input.isHomesteadActive,
      input.nowTimestampMilliseconds,
      input.random,
      input.canvasSize,
      input.timestampMilliseconds
    );
    const shouldSaveCamera = this.updateCameraFocusAnimation(input.timestampMilliseconds, input.canvasSize);
    const shouldSaveHomestead =
      input.isHomesteadActive &&
      input.timestampMilliseconds - this.lastSimulationSaveTimestampMilliseconds > SIMULATION_SAVE_INTERVAL_MILLISECONDS;

    if (shouldSaveHomestead) {
      this.lastSimulationSaveTimestampMilliseconds = input.timestampMilliseconds;
    }

    return {
      shouldSaveCamera,
      shouldSaveHomestead
    };
  }

  resetAnimationClock(): void {
    this.previousAnimationTimestampMilliseconds = 0;
  }

  createCameraSaveState(): HomesteadCameraState | null {
    return this.gameResponse?.gameState.homesteadCamera ?? null;
  }

  createHomesteadSaveSnapshot(nowTimestampMilliseconds: number): HomesteadSaveSnapshot | null {
    const camera = this.createCameraSaveState();

    if (camera === null || this.gameResponse === null) {
      return null;
    }

    this.lastLocalHomesteadSaveTimestampMilliseconds = nowTimestampMilliseconds;
    this.normalizeLocalDucksForSimulationSave(nowTimestampMilliseconds);
    this.setLocalDucks(this.localDucks, nowTimestampMilliseconds);

    return {
      camera,
      duckSimulationUpdates: this.createDuckSimulationUpdates()
    };
  }

  resetDuckRoamState(duckId: string): void {
    this.duckRoamStateById.delete(duckId);
  }

  private mergeLiveDuckSimulationState(
    ducks: Duck[],
    isHomesteadActive: boolean,
    nowTimestampMilliseconds: number
  ): Duck[] {
    if (!isHomesteadActive) {
      return ducks;
    }

    const liveDuckById = new Map(this.localDucks.map((duck) => [duck.id, duck]));

    return ducks.map((duck) => {
      const liveDuck = liveDuckById.get(duck.id);

      if (
        liveDuck?.placementStatus === "placed" &&
        liveDuck.position !== null &&
        duck.placementStatus === "placed" &&
        duck.position !== null
      ) {
        const shouldKeepServerEatingAnimation =
          duck.activity === "eat" &&
          isDuckEatingAnimationActive(duck.lastUpdatedAtTimestampMilliseconds, nowTimestampMilliseconds) &&
          duck.lastUpdatedAtTimestampMilliseconds >= liveDuck.lastUpdatedAtTimestampMilliseconds;

        return {
          ...duck,
          position: liveDuck.position,
          activity: shouldKeepServerEatingAnimation ? duck.activity : liveDuck.activity,
          facingDirection: liveDuck.facingDirection,
          lastUpdatedAtTimestampMilliseconds: shouldKeepServerEatingAnimation
            ? duck.lastUpdatedAtTimestampMilliseconds
            : liveDuck.lastUpdatedAtTimestampMilliseconds
        };
      }

      return duck;
    });
  }

  private updateLocalCameraFromDrag(pointer: HomesteadPointerInput, canvasSize: HomesteadCanvasSize): void {
    if (this.gameResponse === null || this.pointerDragState === null) {
      return;
    }

    const nextCamera = clampCamera(
      {
        ...this.pointerDragState.startCamera,
        x: this.pointerDragState.startCamera.x - (pointer.clientX - this.pointerDragState.startClientX) / this.pointerDragState.startCamera.zoom,
        y: this.pointerDragState.startCamera.y - (pointer.clientY - this.pointerDragState.startClientY) / this.pointerDragState.startCamera.zoom
      },
      canvasSize.width,
      canvasSize.height
    );

    this.updateCamera(nextCamera);
  }

  private simulateDuckMovement(
    deltaMilliseconds: number,
    isHomesteadActive: boolean,
    nowTimestampMilliseconds: number,
    random: () => number,
    canvasSize: HomesteadCanvasSize,
    animationTimestampMilliseconds: number
  ): void {
    if (!isHomesteadActive || this.gameResponse === null) {
      return;
    }

    const simulationResult = simulateHomesteadDuckMovement({
      ducks: this.localDucks,
      roamStateById: this.duckRoamStateById,
      draggedDuckId: this.unplacedDuckPointerDragState?.duckId ?? null,
      deltaMilliseconds,
      nowTimestampMilliseconds,
      random
    });

    this.setLocalDucks(simulationResult.ducks, nowTimestampMilliseconds);
    this.duckRoamStateById = simulationResult.roamStateById;
    this.followSelectedDuckIfNeeded(canvasSize, animationTimestampMilliseconds);
  }

  private followSelectedDuckIfNeeded(canvasSize: HomesteadCanvasSize, timestampMilliseconds: number): void {
    if (!this.isFollowingSelectedDuck) {
      return;
    }

    const selectedDuck = this.getSelectedDuck();

    if (selectedDuck === null) {
      this.setFollowSelectedDuck(false);
      return;
    }

    if (this.gameResponse === null || selectedDuck.position === null) {
      return;
    }

    if (this.cameraFocusAnimationState === null) {
      this.startCameraFocusOnDuck(selectedDuck, canvasSize, timestampMilliseconds);
      return;
    }

    this.cameraFocusAnimationState = {
      ...this.cameraFocusAnimationState,
      toCamera: this.getCenteredCameraForPosition(selectedDuck.position, this.cameraFocusAnimationState.toCamera, canvasSize)
    };
  }

  private startCameraFocusOnDuck(duck: Duck, canvasSize: HomesteadCanvasSize, timestampMilliseconds: number): void {
    if (this.gameResponse === null || duck.position === null) {
      return;
    }

    const fromCamera = this.gameResponse.gameState.homesteadCamera;
    const toCamera = this.getCenteredCameraForPosition(duck.position, { ...fromCamera, zoom: DUCK_CLICK_FOCUS_ZOOM }, canvasSize);

    if (this.isCameraSettledAtTarget(fromCamera, toCamera)) {
      this.cameraFocusAnimationState = null;
      return;
    }

    this.cameraFocusAnimationState = {
      startedAtTimestampMilliseconds: timestampMilliseconds,
      fromCamera,
      toCamera
    };
  }

  private getCenteredCameraForPosition(
    position: DuckPosition,
    camera: HomesteadCameraState,
    canvasSize: HomesteadCanvasSize
  ): HomesteadCameraState {
    return clampCamera(
      {
        ...camera,
        x: position.x - canvasSize.width / camera.zoom / 2,
        y: position.y - canvasSize.height / camera.zoom / 2
      },
      canvasSize.width,
      canvasSize.height
    );
  }

  private updateCameraFocusAnimation(timestampMilliseconds: number, canvasSize: HomesteadCanvasSize): boolean {
    if (this.gameResponse === null || this.cameraFocusAnimationState === null) {
      return false;
    }

    const progress = Math.min(
      1,
      (timestampMilliseconds - this.cameraFocusAnimationState.startedAtTimestampMilliseconds) /
        CAMERA_FOCUS_ANIMATION_MILLISECONDS
    );
    const easedProgress = this.easeCameraFocusProgress(progress);
    const animatedCamera = clampCamera(
      {
        x:
          this.cameraFocusAnimationState.fromCamera.x +
          (this.cameraFocusAnimationState.toCamera.x - this.cameraFocusAnimationState.fromCamera.x) * easedProgress,
        y:
          this.cameraFocusAnimationState.fromCamera.y +
          (this.cameraFocusAnimationState.toCamera.y - this.cameraFocusAnimationState.fromCamera.y) * easedProgress,
        zoom:
          this.cameraFocusAnimationState.fromCamera.zoom +
          (this.cameraFocusAnimationState.toCamera.zoom - this.cameraFocusAnimationState.fromCamera.zoom) * easedProgress
      },
      canvasSize.width,
      canvasSize.height
    );

    this.updateCamera(progress >= 1 ? this.cameraFocusAnimationState.toCamera : animatedCamera);

    if (progress < 1) {
      return false;
    }

    this.cameraFocusAnimationState = null;
    return true;
  }

  private easeCameraFocusProgress(progress: number): number {
    const clampedProgress = Math.min(Math.max(progress, 0), 1);
    return 1 - Math.pow(1 - clampedProgress, 3);
  }

  private isCameraSettledAtTarget(camera: HomesteadCameraState, targetCamera: HomesteadCameraState): boolean {
    return (
      Math.abs(camera.x - targetCamera.x) <= CAMERA_FOCUS_POSITION_EPSILON &&
      Math.abs(camera.y - targetCamera.y) <= CAMERA_FOCUS_POSITION_EPSILON &&
      camera.zoom === targetCamera.zoom
    );
  }

  private updateCamera(camera: HomesteadCameraState): void {
    if (this.gameResponse === null) {
      return;
    }

    this.gameResponse = {
      ...this.gameResponse,
      gameState: {
        ...this.gameResponse.gameState,
        homesteadCamera: camera
      }
    };
  }

  private setLocalDucks(ducks: Duck[], lastHomesteadSimulationTimestampMilliseconds: number | null = null): void {
    this.localDucks = ducks;

    if (this.gameResponse === null) {
      return;
    }

    this.gameResponse = {
      ...this.gameResponse,
      gameState: {
        ...this.gameResponse.gameState,
        ducks,
        lastHomesteadSimulationTimestampMilliseconds:
          lastHomesteadSimulationTimestampMilliseconds ??
          this.gameResponse.gameState.lastHomesteadSimulationTimestampMilliseconds
      }
    };
  }

  private getPersistableDuckActivity(duck: Duck, nowTimestampMilliseconds: number): DuckActivity {
    if (duck.activity !== "eat") {
      return duck.activity;
    }

    if (isDuckEatingAnimationActive(duck.lastUpdatedAtTimestampMilliseconds, nowTimestampMilliseconds)) {
      return "eat";
    }

    if (duck.position === null) {
      return "idle";
    }

    const tilePosition = getTilePositionFromWorldPosition(duck.position);
    return getTileTerrainKindAt(tilePosition.column, tilePosition.row) === "water" ? "swim" : "idle";
  }

  private normalizeLocalDucksForSimulationSave(nowTimestampMilliseconds: number): void {
    this.localDucks = this.localDucks.map((duck) => ({
      ...duck,
      activity: this.getPersistableDuckActivity(duck, nowTimestampMilliseconds)
    }));
  }

  private createDuckSimulationUpdates(): DuckSimulationStateUpdate[] {
    const updates: DuckSimulationStateUpdate[] = [];

    for (const duck of this.localDucks) {
      if (duck.placementStatus !== "placed" || duck.position === null) {
        continue;
      }

      updates.push({
        duckId: duck.id,
        position: duck.position,
        activity: duck.activity,
        facingDirection: duck.facingDirection,
        lastUpdatedAtTimestampMilliseconds: duck.lastUpdatedAtTimestampMilliseconds
      });
    }

    return updates;
  }
}

export function createHomesteadInteraction(): HomesteadInteraction {
  return new HomesteadInteractionController();
}

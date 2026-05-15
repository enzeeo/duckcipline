import { describe, expect, it } from "vitest";
import {
  HOMESTEAD_MAX_ZOOM,
  getCenteredTileWorldPosition
} from "../shared/homesteadMap.js";
import type { Duck, GameStatusResponse, HomesteadCameraState } from "../shared/types.js";
import { createHomesteadInteraction, type HomesteadCanvasMetrics } from "./homesteadInteraction.js";

const TEST_CANVAS_METRICS: HomesteadCanvasMetrics = {
  width: 800,
  height: 600,
  boundsLeft: 0,
  boundsTop: 0,
  boundsWidth: 800,
  boundsHeight: 600
};

function createDuck(overrides: Partial<Duck> = {}): Duck {
  return {
    id: "duck-1",
    name: "Quill",
    variantId: "yellow",
    sourceEggProjectId: "meadowEgg",
    growthStage: "duckling",
    seedsFedForCurrentStage: 0,
    placementStatus: "placed",
    position: getCenteredTileWorldPosition(2, 1),
    homePosition: getCenteredTileWorldPosition(2, 1),
    activity: "idle",
    facingDirection: "right",
    favoriteActivity: "path patrol",
    hatchedAtTimestampMilliseconds: 1_000,
    lastUpdatedAtTimestampMilliseconds: 1_000,
    ...overrides
  };
}

function createGameResponse(overrides: {
  ducks?: Duck[];
  homesteadCamera?: HomesteadCameraState;
  lastHomesteadSimulationTimestampMilliseconds?: number;
} = {}): GameStatusResponse {
  return {
    gameState: {
      activeProjectId: null,
      projectProgressById: {},
      ducks: overrides.ducks ?? [createDuck()],
      seedCount: 0,
      totalCompletedSessions: 0,
      totalCompletedFocusSeconds: 0,
      homesteadCamera: overrides.homesteadCamera ?? { x: 0, y: 0, zoom: 1 },
      lastHomesteadSimulationTimestampMilliseconds: overrides.lastHomesteadSimulationTimestampMilliseconds ?? 0
    },
    projectDefinitions: [],
    maxDuckCount: 12,
    nowTimestampMilliseconds: 2_000,
    statusMessage: null
  };
}

function syncGameResponse(interaction: ReturnType<typeof createHomesteadInteraction>, gameResponse = createGameResponse()): void {
  interaction.dispatch({
    type: "gameResponseSynced",
    gameResponse,
    isHomesteadActive: true,
    nowTimestampMilliseconds: 2_000
  });
}

describe("homesteadInteraction", () => {
  it("selects a placed duck from the canvas, then toggles follow", () => {
    const interaction = createHomesteadInteraction();
    const duck = createDuck();
    syncGameResponse(interaction, createGameResponse({ ducks: [duck] }));

    const selectEffect = interaction.dispatch({
      type: "canvasPointerDown",
      pointer: {
        pointerId: 1,
        clientX: duck.position?.x ?? 0,
        clientY: duck.position?.y ?? 0
      },
      canvasMetrics: TEST_CANVAS_METRICS,
      timestampMilliseconds: 100
    });

    expect(selectEffect.renderDuckDetails).toBe(true);
    expect(selectEffect.renderCanvas).toBe(true);
    expect(interaction.getSnapshot()?.selectedDuck?.id).toBe(duck.id);

    const focusEffect = interaction.dispatch({
      type: "animationFrameAdvanced",
      timestampMilliseconds: 520,
      isHomesteadActive: true,
      canvasSize: TEST_CANVAS_METRICS,
      nowTimestampMilliseconds: 2_500,
      random: () => 0
    });

    expect(focusEffect.saveCamera?.zoom).toBe(1.75);

    const followEffect = interaction.dispatch({
      type: "followToggled",
      canvasSize: TEST_CANVAS_METRICS,
      timestampMilliseconds: 120
    });

    expect(followEffect.renderCanvas).toBe(true);
    expect(interaction.getSnapshot()?.isFollowingSelectedDuck).toBe(true);
  });

  it("drags the camera and pinches zoom, producing render and save effects", () => {
    const interaction = createHomesteadInteraction();
    syncGameResponse(interaction, createGameResponse({ homesteadCamera: { x: 100, y: 100, zoom: 1 } }));

    const dragStartEffect = interaction.dispatch({
      type: "canvasPointerDown",
      pointer: { pointerId: 1, clientX: 400, clientY: 300 },
      canvasMetrics: TEST_CANVAS_METRICS,
      timestampMilliseconds: 100
    });
    expect(dragStartEffect.captureCanvasPointerId).toBe(1);
    expect(dragStartEffect.isCanvasDragging).toBe(true);

    const dragMoveEffect = interaction.dispatch({
      type: "canvasPointerMove",
      pointer: { pointerId: 1, clientX: 390, clientY: 300 },
      canvasMetrics: TEST_CANVAS_METRICS
    });
    expect(dragMoveEffect.renderCanvas).toBe(true);

    const dragEndEffect = interaction.dispatch({
      type: "canvasPointerUp",
      pointer: { pointerId: 1, clientX: 390, clientY: 300 },
      canvasMetrics: TEST_CANVAS_METRICS
    });
    expect(dragEndEffect.isCanvasDragging).toBe(false);
    expect(dragEndEffect.saveCamera).not.toBeNull();

    interaction.dispatch({
      type: "canvasPointerDown",
      pointer: { pointerId: 2, clientX: 100, clientY: 100 },
      canvasMetrics: TEST_CANVAS_METRICS,
      timestampMilliseconds: 200
    });
    interaction.dispatch({
      type: "canvasPointerDown",
      pointer: { pointerId: 3, clientX: 200, clientY: 100 },
      canvasMetrics: TEST_CANVAS_METRICS,
      timestampMilliseconds: 200
    });
    const pinchMoveEffect = interaction.dispatch({
      type: "canvasPointerMove",
      pointer: { pointerId: 3, clientX: 300, clientY: 100 },
      canvasMetrics: TEST_CANVAS_METRICS
    });

    expect(pinchMoveEffect.renderCanvas).toBe(true);
    expect(interaction.getSnapshot()?.gameResponse.gameState.homesteadCamera.zoom).toBeGreaterThan(1);

    const wheelEffect = interaction.dispatch({
      type: "wheelZoomed",
      requestedZoom: 100,
      clientX: 400,
      clientY: 300,
      canvasMetrics: TEST_CANVAS_METRICS
    });
    expect(wheelEffect.saveCamera?.zoom).toBe(HOMESTEAD_MAX_ZOOM);
  });

  it("selects an unplaced duck, rejects a blocked click, and drag-drops onto the canvas", () => {
    const interaction = createHomesteadInteraction();
    const unplacedDuck = createDuck({
      placementStatus: "unplaced",
      position: null,
      homePosition: null
    });
    syncGameResponse(interaction, createGameResponse({ ducks: [unplacedDuck] }));

    const selectEffect = interaction.dispatch({ type: "unplacedDuckClicked", duckId: unplacedDuck.id });
    expect(selectEffect.placementHintText).toBe("Click a valid grass/path tile.");
    expect(interaction.getSnapshot()?.selectedUnplacedDuckId).toBe(unplacedDuck.id);

    const blockedPosition = getCenteredTileWorldPosition(0, 1);
    interaction.dispatch({
      type: "canvasPointerDown",
      pointer: { pointerId: 1, clientX: blockedPosition.x, clientY: blockedPosition.y },
      canvasMetrics: TEST_CANVAS_METRICS,
      timestampMilliseconds: 100
    });
    const blockedEffect = interaction.dispatch({
      type: "canvasPointerUp",
      pointer: { pointerId: 1, clientX: blockedPosition.x, clientY: blockedPosition.y },
      canvasMetrics: TEST_CANVAS_METRICS
    });
    expect(blockedEffect.placementRequest).toBeNull();
    expect(blockedEffect.statusMessage).toEqual({ text: "Invalid placement.", isError: true });

    interaction.dispatch({
      type: "unplacedDuckDragStarted",
      duckId: unplacedDuck.id,
      pointer: { pointerId: 2, clientX: 0, clientY: 0 }
    });
    const dragMoveEffect = interaction.dispatch({
      type: "unplacedDuckDragMoved",
      pointer: { pointerId: 2, clientX: 12, clientY: 0 }
    });
    expect(dragMoveEffect.duckThumbnailDrag).toEqual({ duckId: unplacedDuck.id, isDragging: true });

    const validPosition = getCenteredTileWorldPosition(2, 1);
    const dragEndEffect = interaction.dispatch({
      type: "unplacedDuckDragEnded",
      pointer: { pointerId: 2, clientX: validPosition.x, clientY: validPosition.y },
      canvasMetrics: TEST_CANVAS_METRICS
    });
    expect(dragEndEffect.duckThumbnailDrag).toEqual({ duckId: unplacedDuck.id, isDragging: false });
    expect(dragEndEffect.placementRequest).toEqual({ duckId: unplacedDuck.id, worldPosition: validPosition });
  });

  it("advances animation frames and emits save effects at the existing cadence", () => {
    const interaction = createHomesteadInteraction();
    const duck = createDuck({
      position: getCenteredTileWorldPosition(22, 14),
      homePosition: getCenteredTileWorldPosition(22, 14)
    });
    syncGameResponse(interaction, createGameResponse({ ducks: [duck] }));

    const earlyFrameEffect = interaction.dispatch({
      type: "animationFrameAdvanced",
      timestampMilliseconds: 1_000,
      isHomesteadActive: true,
      canvasSize: TEST_CANVAS_METRICS,
      nowTimestampMilliseconds: 2_000,
      random: () => 0
    });
    expect(earlyFrameEffect.renderCanvas).toBe(true);
    expect(earlyFrameEffect.saveHomestead).toBeNull();

    const saveFrameEffect = interaction.dispatch({
      type: "animationFrameAdvanced",
      timestampMilliseconds: 6_100,
      isHomesteadActive: true,
      canvasSize: TEST_CANVAS_METRICS,
      nowTimestampMilliseconds: 7_100,
      random: () => 0
    });
    expect(saveFrameEffect.saveHomestead?.duckSimulationUpdates).toHaveLength(1);
    expect(saveFrameEffect.saveHomestead?.duckSimulationUpdates[0].duckId).toBe(duck.id);
  });

  it("catches up after away and saves only placed duck simulation updates", () => {
    const interaction = createHomesteadInteraction();
    const placedDuck = createDuck({
      position: getCenteredTileWorldPosition(22, 14),
      homePosition: getCenteredTileWorldPosition(22, 14)
    });
    const unplacedDuck = createDuck({
      id: "duck-2",
      placementStatus: "unplaced",
      position: null,
      homePosition: null
    });
    syncGameResponse(
      interaction,
      createGameResponse({
        ducks: [placedDuck, unplacedDuck],
        lastHomesteadSimulationTimestampMilliseconds: 1_000
      })
    );

    const effect = interaction.dispatch({
      type: "catchUpAfterAway",
      nowTimestampMilliseconds: 6_000,
      random: () => 0
    });

    expect(effect.renderCanvas).toBe(true);
    expect(effect.saveHomestead?.duckSimulationUpdates).toHaveLength(1);
    expect(effect.saveHomestead?.duckSimulationUpdates[0].duckId).toBe(placedDuck.id);
  });
});

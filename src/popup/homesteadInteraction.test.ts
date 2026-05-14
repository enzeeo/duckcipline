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
      lastHomesteadSimulationTimestampMilliseconds: 0
    },
    projectDefinitions: [],
    maxDuckCount: 12,
    nowTimestampMilliseconds: 2_000,
    statusMessage: null
  };
}

describe("homesteadInteraction", () => {
  it("selects ducks and toggles follow state", () => {
    const interaction = createHomesteadInteraction();
    const duck = createDuck();
    interaction.mergeGameResponse(createGameResponse({ ducks: [duck] }), true);

    const pointerDownResult = interaction.handleCanvasPointerDown(
      {
        pointerId: 1,
        clientX: duck.position?.x ?? 0,
        clientY: duck.position?.y ?? 0
      },
      TEST_CANVAS_METRICS,
      100
    );

    expect(pointerDownResult.shouldRenderDuckDetails).toBe(true);
    expect(interaction.getSelectedDuck()?.id).toBe(duck.id);
    expect(interaction.toggleFollowSelectedDuck(TEST_CANVAS_METRICS, 120)).toBe(true);
    expect(interaction.getIsFollowingSelectedDuck()).toBe(true);
    interaction.setFollowSelectedDuck(false);
    expect(interaction.getIsFollowingSelectedDuck()).toBe(false);
  });

  it("clamps zoom and updates camera during drag", () => {
    const interaction = createHomesteadInteraction();
    interaction.mergeGameResponse(createGameResponse(), true);

    interaction.handleWheelZoom(100, 400, 300, TEST_CANVAS_METRICS);
    expect(interaction.getGameResponse()?.gameState.homesteadCamera.zoom).toBe(HOMESTEAD_MAX_ZOOM);

    interaction.handleCanvasPointerDown(
      { pointerId: 1, clientX: 400, clientY: 300 },
      TEST_CANVAS_METRICS,
      100
    );
    interaction.handleCanvasPointerMove({ pointerId: 1, clientX: 100, clientY: 300 }, TEST_CANVAS_METRICS);

    expect(interaction.getGameResponse()?.gameState.homesteadCamera.x).toBeGreaterThan(0);
  });

  it("tracks drag and pinch pointer transitions", () => {
    const interaction = createHomesteadInteraction();
    interaction.mergeGameResponse(createGameResponse({ homesteadCamera: { x: 100, y: 100, zoom: 1 } }), true);

    const dragStart = interaction.handleCanvasPointerDown(
      { pointerId: 1, clientX: 400, clientY: 300 },
      TEST_CANVAS_METRICS,
      100
    );
    expect(dragStart.isDraggingCamera).toBe(true);
    expect(interaction.handleCanvasPointerMove({ pointerId: 1, clientX: 390, clientY: 300 }, TEST_CANVAS_METRICS))
      .toEqual({ shouldRenderCanvas: true });
    expect(interaction.handleCanvasPointerUp({ pointerId: 1, clientX: 390, clientY: 300 }, TEST_CANVAS_METRICS))
      .toMatchObject({ shouldSaveCamera: true, stoppedCameraDrag: true });

    interaction.handleCanvasPointerDown({ pointerId: 2, clientX: 100, clientY: 100 }, TEST_CANVAS_METRICS, 200);
    interaction.handleCanvasPointerDown({ pointerId: 3, clientX: 200, clientY: 100 }, TEST_CANVAS_METRICS, 200);
    expect(interaction.handleCanvasPointerMove({ pointerId: 3, clientX: 300, clientY: 100 }, TEST_CANVAS_METRICS))
      .toEqual({ shouldRenderCanvas: true });
    expect(interaction.getGameResponse()?.gameState.homesteadCamera.zoom).toBeGreaterThan(1);
  });

  it("advances simulated ducks but leaves dragged ducks in place", () => {
    const movingInteraction = createHomesteadInteraction();
    const blockedDuck = createDuck({
      position: getCenteredTileWorldPosition(22, 14),
      homePosition: getCenteredTileWorldPosition(22, 14)
    });
    movingInteraction.mergeGameResponse(createGameResponse({ ducks: [blockedDuck] }), true);
    movingInteraction.advanceAnimationFrame({
      timestampMilliseconds: 1_000,
      isHomesteadActive: true,
      canvasSize: TEST_CANVAS_METRICS,
      nowTimestampMilliseconds: 2_000,
      random: () => 0
    });
    movingInteraction.advanceAnimationFrame({
      timestampMilliseconds: 2_000,
      isHomesteadActive: true,
      canvasSize: TEST_CANVAS_METRICS,
      nowTimestampMilliseconds: 3_000,
      random: () => 0
    });

    expect(movingInteraction.getRenderState()?.ducks[0].position).not.toEqual(blockedDuck.position);

    const draggedInteraction = createHomesteadInteraction();
    draggedInteraction.mergeGameResponse(createGameResponse({ ducks: [blockedDuck] }), true);
    draggedInteraction.startUnplacedDuckPointerDrag(blockedDuck.id, { pointerId: 1, clientX: 0, clientY: 0 });
    draggedInteraction.advanceAnimationFrame({
      timestampMilliseconds: 1_000,
      isHomesteadActive: true,
      canvasSize: TEST_CANVAS_METRICS,
      nowTimestampMilliseconds: 2_000,
      random: () => 0
    });

    expect(draggedInteraction.getRenderState()?.ducks[0].position).toEqual(blockedDuck.position);
  });

  it("creates save snapshots only when homestead state exists", () => {
    const interaction = createHomesteadInteraction();
    expect(interaction.createHomesteadSaveSnapshot()).toBeNull();

    const placedDuck = createDuck();
    const unplacedDuck = createDuck({
      id: "duck-2",
      placementStatus: "unplaced",
      position: null,
      homePosition: null
    });
    interaction.mergeGameResponse(createGameResponse({ ducks: [placedDuck, unplacedDuck] }), true);

    const saveSnapshot = interaction.createHomesteadSaveSnapshot();
    expect(saveSnapshot?.camera).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(saveSnapshot?.duckSimulationUpdates).toHaveLength(1);
    expect(saveSnapshot?.duckSimulationUpdates[0].duckId).toBe(placedDuck.id);
  });
});

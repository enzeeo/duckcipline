import { describe, expect, it } from "vitest";
import {
  FEED_DUCK_MESSAGE_TYPE,
  SAVE_HOMESTEAD_STATE_MESSAGE_TYPE,
  START_TIMER_MESSAGE_TYPE,
  isExtensionRequestMessage
} from "./messages.js";

describe("messages", () => {
  it("rejects unknown message types", () => {
    expect(isExtensionRequestMessage({ type: "unknown" })).toBe(false);
  });

  it("rejects start timer messages without a numeric duration", () => {
    expect(isExtensionRequestMessage({ type: START_TIMER_MESSAGE_TYPE })).toBe(false);
    expect(isExtensionRequestMessage({ type: START_TIMER_MESSAGE_TYPE, durationSeconds: "25" })).toBe(false);
  });

  it("accepts representative game mutation messages", () => {
    expect(isExtensionRequestMessage({ type: FEED_DUCK_MESSAGE_TYPE, duckId: "duck-1", feedMode: "single" })).toBe(true);
  });

  it("accepts homestead state saves with camera and optional simulation updates", () => {
    expect(
      isExtensionRequestMessage({
        type: SAVE_HOMESTEAD_STATE_MESSAGE_TYPE,
        snapshot: {
          camera: { x: 1, y: 2, zoom: 1.5 },
          duckSimulationUpdates: null
        }
      })
    ).toBe(true);

    expect(
      isExtensionRequestMessage({
        type: SAVE_HOMESTEAD_STATE_MESSAGE_TYPE,
        snapshot: {
          camera: { x: 1, y: 2, zoom: 1.5 },
          duckSimulationUpdates: [
            {
              duckId: "duck-1",
              position: { x: 10, y: 20 },
              activity: "wander",
              facingDirection: "right",
              lastUpdatedAtTimestampMilliseconds: 1_000
            }
          ]
        }
      })
    ).toBe(true);
  });

  it("rejects invalid homestead state saves and old split save messages", () => {
    expect(isExtensionRequestMessage({ type: SAVE_HOMESTEAD_STATE_MESSAGE_TYPE })).toBe(false);
    expect(
      isExtensionRequestMessage({
        type: SAVE_HOMESTEAD_STATE_MESSAGE_TYPE,
        snapshot: {
          camera: { x: 1, y: 2 },
          duckSimulationUpdates: null
        }
      })
    ).toBe(false);
    expect(
      isExtensionRequestMessage({
        type: SAVE_HOMESTEAD_STATE_MESSAGE_TYPE,
        snapshot: {
          camera: { x: 1, y: 2, zoom: 1 },
          duckSimulationUpdates: [{ duckId: "duck-1", position: { x: 10, y: 20 } }]
        }
      })
    ).toBe(false);
    expect(isExtensionRequestMessage({ type: "updateDuckSimulationState", updates: [] })).toBe(false);
    expect(isExtensionRequestMessage({ type: "saveHomesteadCamera", homesteadCamera: { x: 0, y: 0, zoom: 1 } })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  FEED_DUCK_MESSAGE_TYPE,
  START_TIMER_MESSAGE_TYPE,
  UPDATE_DUCK_SIMULATION_STATE_MESSAGE_TYPE,
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

  it("accepts only minimal duck simulation updates", () => {
    expect(
      isExtensionRequestMessage({
        type: UPDATE_DUCK_SIMULATION_STATE_MESSAGE_TYPE,
        updates: [
          {
            duckId: "duck-1",
            position: { x: 10, y: 20 },
            activity: "wander",
            facingDirection: "right",
            lastUpdatedAtTimestampMilliseconds: 1_000
          }
        ]
      })
    ).toBe(true);

    expect(
      isExtensionRequestMessage({
        type: UPDATE_DUCK_SIMULATION_STATE_MESSAGE_TYPE,
        ducks: [{ id: "duck-1", name: "Mutated" }]
      })
    ).toBe(false);
  });
});

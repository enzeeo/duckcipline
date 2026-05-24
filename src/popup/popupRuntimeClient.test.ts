import { describe, expect, it } from "vitest";
import { PopupRuntimeClient, type RuntimeMessageSender } from "./popupRuntimeClient.js";

describe("PopupRuntimeClient", () => {
  it("builds timer messages and accepts valid timer responses", async () => {
    const sentMessages: unknown[] = [];
    const runtime: RuntimeMessageSender = {
      async sendMessage(message) {
        sentMessages.push(message);
        return {
          isRunning: true,
          hasStartedAtLeastOnce: true,
          remainingSeconds: 30,
          configuredDurationSeconds: 60
        };
      }
    };

    const client = new PopupRuntimeClient(runtime);
    await expect(client.startTimer(60)).resolves.toMatchObject({ remainingSeconds: 30 });
    expect(sentMessages).toEqual([{ type: "startTimer", durationSeconds: 60 }]);
  });

  it("returns a timer error for invalid timer responses", async () => {
    const client = new PopupRuntimeClient({
      async sendMessage() {
        return { unexpected: true };
      }
    });

    await expect(client.getTimerState()).resolves.toEqual({ error: "Unexpected timer response." });
  });

  it("builds game messages and rejects invalid game responses", async () => {
    const sentMessages: unknown[] = [];
    const client = new PopupRuntimeClient({
      async sendMessage(message) {
        sentMessages.push(message);
        return null;
      }
    });

    await expect(client.feedDuck("duck-1", "single")).resolves.toEqual({ error: "Unexpected game response." });
    expect(sentMessages).toEqual([{ type: "feedDuck", duckId: "duck-1", feedMode: "single" }]);
  });

  it("builds one homestead state save message", async () => {
    const sentMessages: unknown[] = [];
    const client = new PopupRuntimeClient({
      async sendMessage(message) {
        sentMessages.push(message);
        return null;
      }
    });

    await client.saveHomesteadState({
      camera: { x: 1, y: 2, zoom: 1.5 },
      duckSimulationUpdates: []
    });

    expect(sentMessages).toEqual([
      {
        type: "saveHomesteadState",
        snapshot: {
          camera: { x: 1, y: 2, zoom: 1.5 },
          duckSimulationUpdates: []
        }
      }
    ]);
  });
});

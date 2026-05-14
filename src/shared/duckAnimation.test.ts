import { describe, expect, it } from "vitest";
import {
  DUCK_EATING_ANIMATION_DURATION_MILLISECONDS,
  isDuckEatingAnimationActive
} from "./duckAnimation.js";

describe("duckAnimation", () => {
  it("keeps eating active only inside the feed animation window", () => {
    expect(isDuckEatingAnimationActive(1_000, 1_000 + DUCK_EATING_ANIMATION_DURATION_MILLISECONDS - 1)).toBe(true);
    expect(isDuckEatingAnimationActive(1_000, 1_000 + DUCK_EATING_ANIMATION_DURATION_MILLISECONDS)).toBe(false);
  });
});

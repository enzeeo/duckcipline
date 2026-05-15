import type { DuckActivity, DuckGrowthStage, DuckVariantId } from "./types.js";

export type DuckAnimationName = "idle" | "wander" | "swim" | "eat" | "sleep";
export type DuckMovementFamily = "land" | "pond";

export const DUCK_VARIANT_IDS: readonly DuckVariantId[] = [
  "meadow-a",
  "meadow-b",
  "pond-a",
  "pond-b",
  "fancy-a",
  "fancy-b",
  "brown-green",
  "white",
  "yellow",
  "gray",
  "light-brown",
  "gold",
  "white-black"
] as const;

export const HATCHABLE_DUCK_VARIANT_IDS: readonly DuckVariantId[] = [
  "brown-green",
  "white",
  "yellow",
  "gray",
  "light-brown",
  "gold",
  "white-black"
] as const;

export const DUCK_GROWTH_STAGES: readonly DuckGrowthStage[] = ["duckling", "youngDuck", "adultDuck"] as const;
export const DUCK_ANIMATION_NAMES: readonly DuckAnimationName[] = ["idle", "wander", "swim", "eat", "sleep"] as const;

const LEGACY_DUCK_VARIANT_IDS = new Set<DuckVariantId>([
  "meadow-a",
  "meadow-b",
  "pond-a",
  "pond-b",
  "fancy-a",
  "fancy-b"
]);

const DUCK_MOVEMENT_FAMILY_BY_ID: Record<DuckVariantId, DuckMovementFamily> = {
  "meadow-a": "land",
  "meadow-b": "land",
  "pond-a": "pond",
  "pond-b": "pond",
  "fancy-a": "land",
  "fancy-b": "land",
  "brown-green": "pond",
  white: "land",
  yellow: "land",
  gray: "land",
  "light-brown": "land",
  gold: "land",
  "white-black": "land"
};

const DEFAULT_DUCK_NAMES = [
  "Puddle",
  "Waddle",
  "Sprout",
  "Pebble",
  "Moss",
  "Sunny",
  "Clover",
  "Quill",
  "River",
  "Fern",
  "Biscuit",
  "Maple",
  "Noodle",
  "Pip",
  "Marigold",
  "Dewdrop",
  "Button",
  "Acorn",
  "Juniper",
  "Minnow"
] as const;

const FAVORITE_ACTIVITIES = [
  "pond watching",
  "seed sorting",
  "path patrol",
  "flower naps",
  "muddy walks",
  "sun patches"
] as const;

function normalizeDuckNameForComparison(name: string): string {
  return name.trim().toLowerCase();
}

export function createDefaultDuckName(duckCountBeforeCreate: number, existingDuckNames: readonly string[] = []): string {
  const usedDuckNames = new Set(existingDuckNames.map(normalizeDuckNameForComparison));

  for (let offset = 0; offset < DEFAULT_DUCK_NAMES.length; offset += 1) {
    const defaultName = DEFAULT_DUCK_NAMES[(duckCountBeforeCreate + offset) % DEFAULT_DUCK_NAMES.length];

    if (!usedDuckNames.has(normalizeDuckNameForComparison(defaultName))) {
      return defaultName;
    }
  }

  return DEFAULT_DUCK_NAMES[duckCountBeforeCreate % DEFAULT_DUCK_NAMES.length];
}

export function createFavoriteActivity(duckCountBeforeCreate: number): string {
  return FAVORITE_ACTIVITIES[duckCountBeforeCreate % FAVORITE_ACTIVITIES.length];
}

export function getDuckVariantFamily(variantId: DuckVariantId): DuckMovementFamily {
  return DUCK_MOVEMENT_FAMILY_BY_ID[variantId];
}

export function getDuckSpriteName(variantId: DuckVariantId, growthStage: DuckGrowthStage): string {
  if (growthStage === "duckling") {
    return `duckling-${variantId}.png`;
  }

  if (growthStage === "youngDuck") {
    return `young-duck-${variantId}.png`;
  }

  if (LEGACY_DUCK_VARIANT_IDS.has(variantId)) {
    const legacyFamily = variantId.replace(/-[ab]$/, "");
    return `adult-duck-${legacyFamily}-${variantId.endsWith("-a") ? "a" : "b"}.png`;
  }

  return `adult-duck-${variantId}.png`;
}

export function getDuckAnimationSpriteName(
  variantId: DuckVariantId,
  growthStage: DuckGrowthStage,
  activity: DuckAnimationName,
  frameIndex: number
): string {
  const staticSpriteName = getDuckSpriteName(variantId, growthStage);
  const spriteNameWithoutExtension = staticSpriteName.replace(/\.png$/, "");
  const normalizedFrameIndex = Math.max(0, Math.min(3, Math.floor(frameIndex)));

  return `${spriteNameWithoutExtension}-${activity}-${normalizedFrameIndex}.png`;
}

export function getActivityLabel(activity: DuckActivity): string {
  if (activity === "idle") {
    return "Idle";
  }

  if (activity === "wander") {
    return "Wandering";
  }

  if (activity === "swim") {
    return "Swimming";
  }

  if (activity === "rest") {
    return "Resting";
  }

  return "Eating";
}

import {
  DUCK_ANIMATION_NAMES,
  DUCK_GROWTH_STAGES,
  HATCHABLE_DUCK_VARIANT_IDS,
  getDuckAnimationSpriteName,
  getDuckSpriteName
} from "./duckDefinitions.js";

const hatchableDuckStaticAssetPaths = HATCHABLE_DUCK_VARIANT_IDS.flatMap((variantId) =>
  DUCK_GROWTH_STAGES.map((growthStage) => getDuckSpriteName(variantId, growthStage))
);

const hatchableDuckAnimationAssetPaths = HATCHABLE_DUCK_VARIANT_IDS.flatMap((variantId) =>
  DUCK_GROWTH_STAGES.flatMap((growthStage) =>
    DUCK_ANIMATION_NAMES.flatMap((activity) =>
      Array.from({ length: 4 }, (_, frameIndex) => getDuckAnimationSpriteName(variantId, growthStage, activity, frameIndex))
    )
  )
);

export const PIXEL_ASSET_PATHS = {
  ducks: [...hatchableDuckStaticAssetPaths, ...hatchableDuckAnimationAssetPaths],
  tiles: [
    "grass.png",
    "grass-variant-1.png",
    "water.png",
    "water-ripple-0.png",
    "water-ripple-1.png",
    "water-ripple-2.png",
    "water-ripple-3.png",
    "path.png",
    "dirt-path.png",
    "flower.png"
  ],
  objects: ["tree.png", "rock.png", "reeds.png", "lily-pad.png", "nest.png"],
  ui: ["panel-frame.png", "egg-meadow.png", "egg-pond.png", "egg-fancy.png", "seed.png"]
} as const;

export const PIXEL_ASSET_BASE_PATH = "../assets/pixel";
export const PIXEL_TILE_SIZE = 32;
export const PIXEL_DUCK_SPRITE_SIZE = 32;
export const PIXEL_DUCK_ANIMATION_FRAME_COUNT = 4;

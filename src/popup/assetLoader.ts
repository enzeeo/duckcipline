import type { DuckActivity, DuckGrowthStage, DuckVariantId } from "../shared/types.js";
import {
  DUCK_ANIMATION_NAMES,
  DUCK_GROWTH_STAGES,
  DUCK_VARIANT_IDS,
  type DuckAnimationName,
  getDuckAnimationSpriteName,
  getDuckSpriteName
} from "../shared/duckDefinitions.js";

export type SpriteKey =
  | "tile:grass"
  | "tile:water"
  | "tile:path"
  | "tile:flower"
  | "tile:grassVariant"
  | "tile:dirtPath"
  | `tile:waterRipple:${number}`
  | "object:tree"
  | "object:rock"
  | "object:reeds"
  | "object:lilyPad"
  | "object:nest"
  | `duck:${DuckVariantId}:${DuckGrowthStage}`
  | `duck:${DuckVariantId}:${DuckGrowthStage}:${DuckActivity | DuckAnimationName}:${number}`;

export type SpriteMap = Partial<Record<SpriteKey, HTMLImageElement>>;

const bundledAssetUrlByPath = import.meta.glob(["../assets/pixel/**/*.png", "!../assets/pixel/source-sheets/*.png"], {
  eager: true,
  import: "default",
  query: "?url"
}) as Record<string, string>;

export function createAssetUrl(relativePath: string): string {
  const sourceAssetPath = relativePath.replace("src/assets/pixel", "../assets/pixel");
  const bundledAssetUrl = bundledAssetUrlByPath[sourceAssetPath];

  if (bundledAssetUrl) {
    return bundledAssetUrl;
  }

  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(relativePath);
  }

  return `../${relativePath}`;
}

function loadImage(relativePath: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();

    image.addEventListener("load", () => {
      resolve(image);
    });
    image.addEventListener("error", () => {
      resolve(null);
    });

    image.src = createAssetUrl(relativePath);
  });
}

export async function loadPixelSprites(): Promise<SpriteMap> {
  const spriteEntries: Array<[SpriteKey, string]> = [
    ["tile:grass", "src/assets/pixel/tiles/grass.png"],
    ["tile:water", "src/assets/pixel/tiles/water.png"],
    ["tile:path", "src/assets/pixel/tiles/path.png"],
    ["tile:flower", "src/assets/pixel/tiles/flower.png"],
    ["tile:grassVariant", "src/assets/pixel/tiles/grass-variant-1.png"],
    ["tile:dirtPath", "src/assets/pixel/tiles/dirt-path.png"],
    ["tile:waterRipple:0", "src/assets/pixel/tiles/water-ripple-0.png"],
    ["tile:waterRipple:1", "src/assets/pixel/tiles/water-ripple-1.png"],
    ["tile:waterRipple:2", "src/assets/pixel/tiles/water-ripple-2.png"],
    ["tile:waterRipple:3", "src/assets/pixel/tiles/water-ripple-3.png"],
    ["object:tree", "src/assets/pixel/objects/tree.png"],
    ["object:rock", "src/assets/pixel/objects/rock.png"],
    ["object:reeds", "src/assets/pixel/objects/reeds.png"],
    ["object:lilyPad", "src/assets/pixel/objects/lily-pad.png"],
    ["object:nest", "src/assets/pixel/objects/nest.png"]
  ];

  for (const variantId of DUCK_VARIANT_IDS) {
    for (const growthStage of DUCK_GROWTH_STAGES) {
      spriteEntries.push([
        `duck:${variantId}:${growthStage}`,
        `src/assets/pixel/ducks/${getDuckSpriteName(variantId, growthStage)}`
      ]);

      for (const activity of DUCK_ANIMATION_NAMES) {
        for (let frameIndex = 0; frameIndex < 4; frameIndex += 1) {
          spriteEntries.push([
            `duck:${variantId}:${growthStage}:${activity}:${frameIndex}`,
            `src/assets/pixel/ducks/${getDuckAnimationSpriteName(variantId, growthStage, activity, frameIndex)}`
          ]);
        }
      }
    }
  }

  const spriteMap: SpriteMap = {};

  await Promise.all(
    spriteEntries.map(async ([spriteKey, relativePath]) => {
      const image = await loadImage(relativePath);

      if (image !== null) {
        spriteMap[spriteKey] = image;
      }
    })
  );

  return spriteMap;
}

import {
  HOMESTEAD_COLUMNS,
  HOMESTEAD_OBJECTS,
  HOMESTEAD_ROWS,
  HOMESTEAD_TILE_SIZE,
  getTileTypeAt
} from "../shared/homesteadMap.js";
import type { Duck, HomesteadCameraState } from "../shared/types.js";
import type { SpriteKey, SpriteMap } from "./assetLoader.js";

interface RenderOptions {
  canvas: HTMLCanvasElement;
  camera: HomesteadCameraState;
  ducks: Duck[];
  animationFrameIndex: number;
  spriteMap: SpriteMap;
}

function drawPixelTileFallback(
  context: CanvasRenderingContext2D,
  spriteKey: SpriteKey,
  x: number,
  y: number,
  size: number
): void {
  if (spriteKey === "tile:water") {
    context.fillStyle = "#4f9db0";
    context.fillRect(x, y, size, size);
    context.fillStyle = "#2e6f7e";
    context.fillRect(x + 4, y + 10, size - 8, 3);
    return;
  }

  if (spriteKey.startsWith("tile:waterRipple")) {
    context.fillStyle = "#4f9db0";
    context.fillRect(x, y, size, size);
    context.fillStyle = "#c6f3ff";
    context.fillRect(x + 7, y + 9, size - 14, 2);
    context.fillRect(x + 11, y + 19, size - 18, 2);
    return;
  }

  if (spriteKey === "tile:path" || spriteKey === "tile:dirtPath") {
    context.fillStyle = "#b88745";
    context.fillRect(x, y, size, size);
    context.fillStyle = "#9b6f35";
    context.fillRect(x + 3, y + 20, 6, 4);
    context.fillRect(x + 20, y + 7, 5, 5);
    return;
  }

  if (spriteKey === "tile:flower") {
    context.fillStyle = "#78a653";
    context.fillRect(x, y, size, size);
    context.fillStyle = "#f2c14e";
    context.fillRect(x + 12, y + 12, 8, 8);
    return;
  }

  context.fillStyle = spriteKey === "tile:grassVariant" ? "#86b95e" : "#7dad56";
  context.fillRect(x, y, size, size);
  context.fillStyle = "#6b9747";
  context.fillRect(x + 4, y + 5, 5, 2);
  context.fillRect(x + 20, y + 19, 7, 2);
}

function drawObjectFallback(
  context: CanvasRenderingContext2D,
  spriteKey: SpriteKey,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  if (spriteKey === "object:tree") {
    context.fillStyle = "#6b4b28";
    context.fillRect(x + width / 2 - 5, y + height - 22, 10, 18);
    context.fillStyle = "#3e5d2e";
    context.fillRect(x + 8, y + 8, width - 16, height - 24);
    context.fillStyle = "#5f7f3f";
    context.fillRect(x + 16, y, width - 32, height - 30);
    return;
  }

  if (spriteKey === "object:reeds") {
    context.fillStyle = "#5f7f3f";
    context.fillRect(x + 9, y + 8, 4, height - 8);
    context.fillRect(x + 18, y + 4, 4, height - 4);
    context.fillStyle = "#9b6f35";
    context.fillRect(x + 8, y + 6, 6, 4);
    context.fillRect(x + 17, y + 2, 6, 4);
    return;
  }

  if (spriteKey === "object:lilyPad") {
    context.fillStyle = "#3f8f46";
    context.fillRect(x + 6, y + 9, width - 12, height - 14);
    context.clearRect(x + width - 11, y + 9, 5, 5);
    context.fillStyle = "#dfeec3";
    context.fillRect(x + 14, y + 14, 4, 3);
    return;
  }

  if (spriteKey === "object:nest") {
    context.fillStyle = "#8b5a2b";
    context.fillRect(x + 5, y + 12, width - 10, height - 14);
    context.fillStyle = "#c08a43";
    context.fillRect(x + 9, y + 9, width - 18, 5);
    return;
  }

  context.fillStyle = "#8d8976";
  context.fillRect(x + 6, y + 10, width - 12, height - 14);
  context.fillStyle = "#b9b29c";
  context.fillRect(x + 12, y + 7, width - 20, 5);
}

function drawDuckFallback(
  context: CanvasRenderingContext2D,
  duck: Duck,
  x: number,
  y: number,
  size: number
): void {
  const isFancy = duck.variantId.startsWith("fancy");
  const isPond = duck.variantId.startsWith("pond");

  if (duck.activity === "swim") {
    context.strokeStyle = "#c6f3ff";
    context.lineWidth = 2;
    context.strokeRect(x + 3, y + 18, size - 6, 6);
  }

  context.fillStyle = isFancy ? "#fff8df" : isPond ? "#dceef2" : "#f2c14e";
  context.fillRect(x + 8, y + 10, 16, 14);
  context.fillRect(x + 18, y + 7, 8, 8);
  context.fillStyle = "#d9822b";
  context.fillRect(x + 25, y + 11, 5, 3);
  context.fillStyle = "#2f2418";
  context.fillRect(x + 22, y + 10, 2, 2);

  if (duck.growthStage === "duckling") {
    context.clearRect(x + size - 5, y + size - 5, 4, 4);
  }
}

function drawSpriteOrFallback(
  context: CanvasRenderingContext2D,
  spriteMap: SpriteMap,
  spriteKey: SpriteKey,
  x: number,
  y: number,
  width: number,
  height: number,
  duck: Duck | null = null,
  isMirrored: boolean = false
): void {
  if (isMirrored) {
    context.save();
    context.translate(x + width, y);
    context.scale(-1, 1);
    drawSpriteOrFallback(context, spriteMap, spriteKey, 0, 0, width, height, duck, false);
    context.restore();
    return;
  }

  const image = spriteMap[spriteKey];

  if (image) {
    context.drawImage(image, x, y, width, height);
    return;
  }

  if (spriteKey.startsWith("tile:")) {
    drawPixelTileFallback(context, spriteKey, x, y, width);
    return;
  }

  if (spriteKey.startsWith("object:")) {
    drawObjectFallback(context, spriteKey, x, y, width, height);
    return;
  }

  if (duck) {
    drawDuckFallback(context, duck, x, y, width);
  }
}

function getPixelAlignedScreenCoordinate(worldCoordinate: number, cameraCoordinate: number, zoom: number): number {
  return Math.floor((worldCoordinate - cameraCoordinate) * zoom);
}

export function renderHomesteadCanvas(options: RenderOptions): void {
  const context = options.canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, options.canvas.width, options.canvas.height);

  const zoom = options.camera.zoom;
  const viewportWorldWidth = options.canvas.width / zoom;
  const viewportWorldHeight = options.canvas.height / zoom;
  const renderedTileSize = Math.ceil(HOMESTEAD_TILE_SIZE * zoom);
  const startColumn = Math.max(0, Math.floor(options.camera.x / HOMESTEAD_TILE_SIZE) - 1);
  const endColumn = Math.min(
    HOMESTEAD_COLUMNS,
    Math.ceil((options.camera.x + viewportWorldWidth) / HOMESTEAD_TILE_SIZE) + 1
  );
  const startRow = Math.max(0, Math.floor(options.camera.y / HOMESTEAD_TILE_SIZE) - 1);
  const endRow = Math.min(
    HOMESTEAD_ROWS,
    Math.ceil((options.camera.y + viewportWorldHeight) / HOMESTEAD_TILE_SIZE) + 1
  );

  for (let row = startRow; row < endRow; row += 1) {
    for (let column = startColumn; column < endColumn; column += 1) {
      const tileType = getTileTypeAt(column, row);
      const spriteKey: SpriteKey =
        tileType === "waterRipple" ? `tile:waterRipple:${options.animationFrameIndex}` : `tile:${tileType}`;
      drawSpriteOrFallback(
        context,
        options.spriteMap,
        spriteKey,
        getPixelAlignedScreenCoordinate(column * HOMESTEAD_TILE_SIZE, options.camera.x, zoom),
        getPixelAlignedScreenCoordinate(row * HOMESTEAD_TILE_SIZE, options.camera.y, zoom),
        renderedTileSize,
        renderedTileSize
      );
    }
  }

  for (const object of HOMESTEAD_OBJECTS) {
    drawSpriteOrFallback(
      context,
      options.spriteMap,
      `object:${object.type}`,
      getPixelAlignedScreenCoordinate(object.column * HOMESTEAD_TILE_SIZE, options.camera.x, zoom),
      getPixelAlignedScreenCoordinate(object.row * HOMESTEAD_TILE_SIZE, options.camera.y, zoom),
      object.widthTiles * HOMESTEAD_TILE_SIZE * zoom,
      object.heightTiles * HOMESTEAD_TILE_SIZE * zoom
    );
  }

  for (const duck of options.ducks) {
    if (duck.placementStatus !== "placed" || duck.position === null) {
      continue;
    }

    const duckX = (duck.position.x - HOMESTEAD_TILE_SIZE / 2 - options.camera.x) * zoom;
    const duckY = (duck.position.y - HOMESTEAD_TILE_SIZE / 2 - options.camera.y) * zoom;
    const renderedActivity = duck.activity === "rest" ? "sleep" : duck.activity;
    const animatedSpriteKey: SpriteKey =
      `duck:${duck.variantId}:${duck.growthStage}:${renderedActivity}:${options.animationFrameIndex}`;
    const staticSpriteKey: SpriteKey = `duck:${duck.variantId}:${duck.growthStage}`;

    drawSpriteOrFallback(
      context,
      options.spriteMap,
      options.spriteMap[animatedSpriteKey] ? animatedSpriteKey : staticSpriteKey,
      duckX,
      duckY,
      HOMESTEAD_TILE_SIZE * zoom,
      HOMESTEAD_TILE_SIZE * zoom,
      duck,
      duck.facingDirection === "left"
    );
  }
}

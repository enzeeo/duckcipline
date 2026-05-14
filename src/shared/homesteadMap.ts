import type { DuckPosition, HomesteadCameraState } from "./types.js";

export const HOMESTEAD_TILE_SIZE = 32;
export const HOMESTEAD_COLUMNS = 48;
export const HOMESTEAD_ROWS = 36;
export const HOMESTEAD_WORLD_WIDTH = HOMESTEAD_COLUMNS * HOMESTEAD_TILE_SIZE;
export const HOMESTEAD_WORLD_HEIGHT = HOMESTEAD_ROWS * HOMESTEAD_TILE_SIZE;
export const HOMESTEAD_FRAME_GUTTER = 12;
export const HOMESTEAD_MIN_ZOOM = 0.75;
export const HOMESTEAD_MAX_ZOOM = 2;

export type HomesteadTileType = "grass" | "water" | "path" | "flower" | "grassVariant" | "dirtPath" | "waterRipple";
export type HomesteadTileTerrainKind = "ground" | "water";
export type HomesteadObjectType = "tree" | "rock" | "reeds" | "lilyPad" | "nest";

export interface HomesteadObject {
  type: HomesteadObjectType;
  column: number;
  row: number;
  widthTiles: number;
  heightTiles: number;
}

export interface HomesteadMap {
  columns: number;
  rows: number;
  tileSize: number;
  objects: ReadonlyArray<HomesteadObject>;
}

interface OrganicPatch {
  centerColumn: number;
  centerRow: number;
  radiusColumns: number;
  radiusRows: number;
}

const MAIN_POND: OrganicPatch = {
  centerColumn: 28,
  centerRow: 17,
  radiusColumns: 7.2,
  radiusRows: 5.2
};

const GRASS_VARIANT_PATCHES: ReadonlyArray<OrganicPatch> = [
  { centerColumn: 7, centerRow: 7, radiusColumns: 5.8, radiusRows: 4.2 },
  { centerColumn: 17, centerRow: 9, radiusColumns: 5.2, radiusRows: 3.4 },
  { centerColumn: 39, centerRow: 8, radiusColumns: 6.2, radiusRows: 4.8 },
  { centerColumn: 10, centerRow: 29, radiusColumns: 6.6, radiusRows: 4.2 },
  { centerColumn: 30, centerRow: 27, radiusColumns: 7.4, radiusRows: 4.6 },
  { centerColumn: 43, centerRow: 29, radiusColumns: 4.8, radiusRows: 4.0 }
];

const FLOWER_CLUSTERS: ReadonlyArray<OrganicPatch> = [
  { centerColumn: 5, centerRow: 14, radiusColumns: 2.8, radiusRows: 2.0 },
  { centerColumn: 15, centerRow: 5, radiusColumns: 3.0, radiusRows: 1.8 },
  { centerColumn: 36, centerRow: 13, radiusColumns: 3.2, radiusRows: 2.2 },
  { centerColumn: 23, centerRow: 28, radiusColumns: 3.4, radiusRows: 2.0 },
  { centerColumn: 41, centerRow: 24, radiusColumns: 3.0, radiusRows: 2.4 }
];

export const HOMESTEAD_OBJECTS: ReadonlyArray<HomesteadObject> = [
  { type: "tree", column: 4, row: 4, widthTiles: 2, heightTiles: 2 },
  { type: "tree", column: 41, row: 5, widthTiles: 2, heightTiles: 2 },
  { type: "tree", column: 7, row: 28, widthTiles: 2, heightTiles: 2 },
  { type: "rock", column: 13, row: 9, widthTiles: 1, heightTiles: 1 },
  { type: "rock", column: 34, row: 26, widthTiles: 1, heightTiles: 1 },
  { type: "reeds", column: 24, row: 15, widthTiles: 1, heightTiles: 1 },
  { type: "reeds", column: 30, row: 20, widthTiles: 1, heightTiles: 1 },
  { type: "lilyPad", column: 26, row: 17, widthTiles: 1, heightTiles: 1 },
  { type: "lilyPad", column: 30, row: 16, widthTiles: 1, heightTiles: 1 },
  { type: "lilyPad", column: 31, row: 19, widthTiles: 1, heightTiles: 1 },
  { type: "nest", column: 18, row: 14, widthTiles: 1, heightTiles: 1 }
];

export const HOMESTEAD_MAP: HomesteadMap = {
  columns: HOMESTEAD_COLUMNS,
  rows: HOMESTEAD_ROWS,
  tileSize: HOMESTEAD_TILE_SIZE,
  objects: HOMESTEAD_OBJECTS
};

function getDeterministicPercent(column: number, row: number, salt: number): number {
  const firstMix = Math.imul(column + salt * 37, 374761393);
  const secondMix = Math.imul(row + salt * 97, 668265263);
  const mixedValue = (firstMix ^ secondMix) >>> 0;
  const shiftedValue = (mixedValue ^ (mixedValue >>> 13)) >>> 0;

  return shiftedValue % 100;
}

function getOrganicPatchValue(column: number, row: number, patch: OrganicPatch, salt: number): number {
  const normalizedColumn = (column - patch.centerColumn) / patch.radiusColumns;
  const normalizedRow = (row - patch.centerRow) / patch.radiusRows;
  const edgeJitter = (getDeterministicPercent(column, row, salt) - 50) / 420;

  return normalizedColumn * normalizedColumn + normalizedRow * normalizedRow + edgeJitter;
}

function isInsideOrganicPatch(column: number, row: number, patch: OrganicPatch, salt: number): boolean {
  return getOrganicPatchValue(column, row, patch, salt) <= 1;
}

export function isWaterTileType(tileType: HomesteadTileType): boolean {
  return tileType === "water" || tileType === "waterRipple";
}

export function getTileTerrainKind(tileType: HomesteadTileType): HomesteadTileTerrainKind {
  return isWaterTileType(tileType) ? "water" : "ground";
}

function getPathTileTypeAt(column: number, row: number, pondPatchValue: number): HomesteadTileType | null {
  const lowerPathCenterRow = 20 + Math.sin(column * 0.48) * 1.2;
  const lowerPathDistance = Math.abs(row - lowerPathCenterRow);
  const isLowerPath = column >= 3 && column <= 24 && lowerPathDistance <= 1.15;

  const verticalPathCenterColumn = 21 + Math.sin(row * 0.52) * 1.1;
  const verticalPathDistance = Math.abs(column - verticalPathCenterColumn);
  const isVerticalPath = row >= 9 && row <= 26 && verticalPathDistance <= 1.15;

  const isPondBankPath =
    pondPatchValue > 1 &&
    pondPatchValue < 1.34 &&
    column >= MAIN_POND.centerColumn - 8 &&
    column <= MAIN_POND.centerColumn + 8 &&
    row >= MAIN_POND.centerRow - 6 &&
    row <= MAIN_POND.centerRow + 6 &&
    getDeterministicPercent(column, row, 17) < 68;

  if (!isLowerPath && !isVerticalPath && !isPondBankPath) {
    return null;
  }

  return getDeterministicPercent(column, row, 23) < 24 ? "dirtPath" : "path";
}

function isFlowerTileAt(column: number, row: number): boolean {
  if (column <= 2 || row <= 2 || column >= HOMESTEAD_COLUMNS - 2 || row >= HOMESTEAD_ROWS - 2) {
    return false;
  }

  const isInFlowerCluster = FLOWER_CLUSTERS.some((patch, index) => {
    return isInsideOrganicPatch(column, row, patch, 31 + index) && getDeterministicPercent(column, row, 41 + index) < 46;
  });

  if (isInFlowerCluster) {
    return true;
  }

  return GRASS_VARIANT_PATCHES.some((patch, index) => {
    const patchValue = getOrganicPatchValue(column, row, patch, 51 + index);
    return patchValue > 0.82 && patchValue < 1.26 && getDeterministicPercent(column, row, 61 + index) < 12;
  });
}

function isGrassVariantTileAt(column: number, row: number): boolean {
  return GRASS_VARIANT_PATCHES.some((patch, index) => {
    return isInsideOrganicPatch(column, row, patch, 71 + index) && getDeterministicPercent(column, row, 81 + index) < 84;
  });
}

export function clampCamera(
  camera: HomesteadCameraState,
  viewportWidth: number,
  viewportHeight: number
): HomesteadCameraState {
  const zoom = Math.min(Math.max(camera.zoom, HOMESTEAD_MIN_ZOOM), HOMESTEAD_MAX_ZOOM);
  const viewportWorldWidth = viewportWidth / zoom;
  const viewportWorldHeight = viewportHeight / zoom;
  const maxCameraX = Math.max(0, HOMESTEAD_WORLD_WIDTH - viewportWorldWidth);
  const maxCameraY = Math.max(0, HOMESTEAD_WORLD_HEIGHT - viewportWorldHeight);

  return {
    x: Math.min(Math.max(0, camera.x), maxCameraX),
    y: Math.min(Math.max(0, camera.y), maxCameraY),
    zoom
  };
}

export function getTileTypeAt(column: number, row: number): HomesteadTileType {
  const pondPatchValue = getOrganicPatchValue(column, row, MAIN_POND, 7);

  if (pondPatchValue <= 1) {
    return getDeterministicPercent(column, row, 11) < 26 ? "waterRipple" : "water";
  }

  const pathTileType = getPathTileTypeAt(column, row, pondPatchValue);
  if (pathTileType !== null) {
    return pathTileType;
  }

  if (isFlowerTileAt(column, row)) {
    return "flower";
  }

  return isGrassVariantTileAt(column, row) ? "grassVariant" : "grass";
}

export function getTileTerrainKindAt(column: number, row: number): HomesteadTileTerrainKind {
  return getTileTerrainKind(getTileTypeAt(column, row));
}

export function isInsideWorld(column: number, row: number): boolean {
  return column >= 0 && row >= 0 && column < HOMESTEAD_COLUMNS && row < HOMESTEAD_ROWS;
}

export function getTilePositionFromWorldPosition(position: DuckPosition): { column: number; row: number } {
  return {
    column: Math.floor(position.x / HOMESTEAD_TILE_SIZE),
    row: Math.floor(position.y / HOMESTEAD_TILE_SIZE)
  };
}

export function getCenteredTileWorldPosition(column: number, row: number): DuckPosition {
  return {
    x: column * HOMESTEAD_TILE_SIZE + HOMESTEAD_TILE_SIZE / 2,
    y: row * HOMESTEAD_TILE_SIZE + HOMESTEAD_TILE_SIZE / 2
  };
}

export function isObjectBlockingTile(column: number, row: number): boolean {
  return HOMESTEAD_OBJECTS.some((object) => {
    const isInsideObjectColumns = column >= object.column && column < object.column + object.widthTiles;
    const isInsideObjectRows = row >= object.row && row < object.row + object.heightTiles;
    return isInsideObjectColumns && isInsideObjectRows && (object.type === "tree" || object.type === "rock");
  });
}

export function isManualDuckPlacementValid(position: DuckPosition): boolean {
  const tilePosition = getTilePositionFromWorldPosition(position);

  if (!isInsideWorld(tilePosition.column, tilePosition.row)) {
    return false;
  }

  if (getTileTerrainKindAt(tilePosition.column, tilePosition.row) === "water") {
    return false;
  }

  return !isObjectBlockingTile(tilePosition.column, tilePosition.row);
}

export function isDuckAiPositionValid(position: DuckPosition, canEnterWater: boolean): boolean {
  const tilePosition = getTilePositionFromWorldPosition(position);

  if (!isInsideWorld(tilePosition.column, tilePosition.row)) {
    return false;
  }

  if (!canEnterWater && getTileTerrainKindAt(tilePosition.column, tilePosition.row) === "water") {
    return false;
  }

  return !isObjectBlockingTile(tilePosition.column, tilePosition.row);
}

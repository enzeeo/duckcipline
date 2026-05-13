import type { DuckPosition, HomesteadCameraState } from "./types.js";

export const HOMESTEAD_TILE_SIZE = 32;
export const HOMESTEAD_COLUMNS = 48;
export const HOMESTEAD_ROWS = 36;
export const HOMESTEAD_WORLD_WIDTH = HOMESTEAD_COLUMNS * HOMESTEAD_TILE_SIZE;
export const HOMESTEAD_WORLD_HEIGHT = HOMESTEAD_ROWS * HOMESTEAD_TILE_SIZE;
export const HOMESTEAD_FRAME_GUTTER = 12;

export type HomesteadTileType = "grass" | "water" | "path" | "flower" | "grassVariant" | "dirtPath" | "waterRipple";
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

export function clampCamera(
  camera: HomesteadCameraState,
  viewportWidth: number,
  viewportHeight: number
): HomesteadCameraState {
  const maxCameraX = Math.max(0, HOMESTEAD_WORLD_WIDTH - viewportWidth);
  const maxCameraY = Math.max(0, HOMESTEAD_WORLD_HEIGHT - viewportHeight);

  return {
    x: Math.min(Math.max(0, camera.x), maxCameraX),
    y: Math.min(Math.max(0, camera.y), maxCameraY)
  };
}

export function getTileTypeAt(column: number, row: number): HomesteadTileType {
  const pondCenterColumn = 28;
  const pondCenterRow = 17;
  const pondRadiusX = 6.5;
  const pondRadiusY = 4.5;
  const normalizedPondX = (column - pondCenterColumn) / pondRadiusX;
  const normalizedPondY = (row - pondCenterRow) / pondRadiusY;

  if (normalizedPondX * normalizedPondX + normalizedPondY * normalizedPondY <= 1) {
    return (column + row) % 4 === 0 ? "waterRipple" : "water";
  }

  if ((row === 18 && column >= 4 && column <= 21) || (column === 21 && row >= 10 && row <= 25)) {
    return (column + row) % 5 === 0 ? "dirtPath" : "path";
  }

  if ((column + row) % 13 === 0 && column > 2 && row > 2 && column < HOMESTEAD_COLUMNS - 2 && row < HOMESTEAD_ROWS - 2) {
    return "flower";
  }

  return (column * 3 + row) % 11 === 0 ? "grassVariant" : "grass";
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

  if (getTileTypeAt(tilePosition.column, tilePosition.row) === "water") {
    return false;
  }

  return !isObjectBlockingTile(tilePosition.column, tilePosition.row);
}

export function isDuckAiPositionValid(position: DuckPosition, canEnterWater: boolean): boolean {
  const tilePosition = getTilePositionFromWorldPosition(position);

  if (!isInsideWorld(tilePosition.column, tilePosition.row)) {
    return false;
  }

  if (!canEnterWater && getTileTypeAt(tilePosition.column, tilePosition.row) === "water") {
    return false;
  }

  return !isObjectBlockingTile(tilePosition.column, tilePosition.row);
}

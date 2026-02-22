export const PLANT_TILE_SIZE_PIXELS = 16;
export const PLANT_SPRITE_SHEET_WIDTH_PIXELS = 768;
export const PLANT_SPRITE_SHEET_HEIGHT_PIXELS = 432;

export const PLANT_SPRITE_SHEET_PATH = "src/assets/homestead/plants_placeholder.png";

export interface PlantSpriteFrame {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface PlantFrameDefinition {
  plantId: string;
  frame: PlantSpriteFrame;
}

function createPlantSpriteFrameFromTileCoordinates(
  plantTileColumnIndex: number,
  plantTileRowIndex: number
): PlantSpriteFrame {
  return {
    sourceX: plantTileColumnIndex * PLANT_TILE_SIZE_PIXELS,
    sourceY: plantTileRowIndex * PLANT_TILE_SIZE_PIXELS,
    sourceWidth: PLANT_TILE_SIZE_PIXELS,
    sourceHeight: PLANT_TILE_SIZE_PIXELS
  };
}

function createPlantSpriteFrameFromPixelBounds(
  topLeftSourceXPixel: number,
  topLeftSourceYPixel: number,
  bottomRightSourceXPixel: number,
  bottomRightSourceYPixel: number
): PlantSpriteFrame {
  if (bottomRightSourceXPixel <= topLeftSourceXPixel) {
    throw new Error("bottomRightSourceXPixel must be greater than topLeftSourceXPixel.");
  }

  if (bottomRightSourceYPixel <= topLeftSourceYPixel) {
    throw new Error("bottomRightSourceYPixel must be greater than topLeftSourceYPixel.");
  }

  return {
    sourceX: topLeftSourceXPixel,
    sourceY: topLeftSourceYPixel,
    sourceWidth: bottomRightSourceXPixel - topLeftSourceXPixel,
    sourceHeight: bottomRightSourceYPixel - topLeftSourceYPixel
  };
}

function createPlantFrameDefinitionFromTileCoordinates(
  plantId: string,
  plantTileColumnIndex: number,
  plantTileRowIndex: number
): PlantFrameDefinition {
  return {
    plantId,
    frame: createPlantSpriteFrameFromTileCoordinates(plantTileColumnIndex, plantTileRowIndex)
  };
}

function createPlantFrameDefinitionFromPixelBounds(
  plantId: string,
  topLeftSourceXPixel: number,
  topLeftSourceYPixel: number,
  bottomRightSourceXPixel: number,
  bottomRightSourceYPixel: number
): PlantFrameDefinition {
  return {
    plantId,
    frame: createPlantSpriteFrameFromPixelBounds(
      topLeftSourceXPixel,
      topLeftSourceYPixel,
      bottomRightSourceXPixel,
      bottomRightSourceYPixel
    )
  };
}

export const PLANT_FRAME_DEFINITIONS_BY_ID: Record<string, PlantFrameDefinition> = {
  topLeftPlant: createPlantFrameDefinitionFromTileCoordinates("topLeftPlant", 0, 0),
  topSecondPlant: createPlantFrameDefinitionFromTileCoordinates("topSecondPlant", 1, 0),
  topThirdPlant: createPlantFrameDefinitionFromTileCoordinates("topThirdPlant", 2, 0),
  topFourthPlant: createPlantFrameDefinitionFromTileCoordinates("topFourthPlant", 3, 0),
  secondRowLeftPlant: createPlantFrameDefinitionFromTileCoordinates("secondRowLeftPlant", 0, 1),
  secondRowSecondPlant: createPlantFrameDefinitionFromTileCoordinates("secondRowSecondPlant", 1, 1),
  secondRowThirdPlant: createPlantFrameDefinitionFromTileCoordinates("secondRowThirdPlant", 2, 1),
  secondRowFourthPlant: createPlantFrameDefinitionFromTileCoordinates("secondRowFourthPlant", 3, 1),
  customTreeLarge: createPlantFrameDefinitionFromPixelBounds("customTreeLarge", 200, 30, 240, 80)
};

export const PLANT_FRAME_DEFINITIONS: ReadonlyArray<PlantFrameDefinition> = Object.values(
  PLANT_FRAME_DEFINITIONS_BY_ID
);

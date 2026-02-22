export const DUCK_ONE_SPRITE_SHEET_PATH = "src/assets/ducks/duck_1_placeholder.png";

export interface DuckSpriteFrame {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface DuckAnimationDefinition {
  animationId: string;
  frames: ReadonlyArray<DuckSpriteFrame>;
  framesPerSecond: number;
}

function createDuckSpriteFrameFromPixelBounds(
  topLeftSourceXPixel: number,
  topLeftSourceYPixel: number,
  bottomRightSourceXPixel: number,
  bottomRightSourceYPixel: number
): DuckSpriteFrame {
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

export const DUCK_ONE_IDLE_FRAMES: ReadonlyArray<DuckSpriteFrame> = [
  createDuckSpriteFrameFromPixelBounds(7, 200, 30, 220),
  createDuckSpriteFrameFromPixelBounds(38, 200, 61, 220),
  createDuckSpriteFrameFromPixelBounds(69, 200, 92, 220),
  createDuckSpriteFrameFromPixelBounds(100, 200, 123, 220),
  createDuckSpriteFrameFromPixelBounds(131, 200, 154, 220),
  createDuckSpriteFrameFromPixelBounds(162, 200, 185, 220)
];

export const DUCK_ONE_IDLE_ANIMATION_DEFINITION: DuckAnimationDefinition = {
  animationId: "duckOneIdle",
  frames: DUCK_ONE_IDLE_FRAMES,
  framesPerSecond: 8
};

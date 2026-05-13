import type { DuckRewardItemId } from "./types.js";

export interface DuckEggRewardDefinition {
  id: DuckRewardItemId;
  rewardType: "duckEgg";
  displayName: string;
  requiredProgressSeconds: number;
}

export type DuckRewardDefinition = DuckEggRewardDefinition;

export const DUCK_REWARD_DEFINITIONS: ReadonlyArray<DuckRewardDefinition> = [
  {
    id: "duckEgg1",
    rewardType: "duckEgg",
    displayName: "Duck Egg 1",
    requiredProgressSeconds: 2
  },
  {
    id: "duckEgg2",
    rewardType: "duckEgg",
    displayName: "Duck Egg 2",
    requiredProgressSeconds: 3
  }
];

export const DUCK_REWARD_DEFINITION_BY_ID: Record<DuckRewardItemId, DuckRewardDefinition> = {
  duckEgg1: DUCK_REWARD_DEFINITIONS[0],
  duckEgg2: DUCK_REWARD_DEFINITIONS[1]
};

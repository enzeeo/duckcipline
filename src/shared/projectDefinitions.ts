import { getProjectDurationSeconds } from "./balance.js";
import type {
  EggProjectId,
  HatchTableEntry,
  ProjectDefinitionResponse,
  ProjectId,
  ProjectType,
  SeedProjectId
} from "./types.js";

interface BaseProjectDefinition {
  id: ProjectId;
  type: ProjectType;
  displayName: string;
  rewardDescription: string;
}

export interface EggProjectDefinition extends BaseProjectDefinition {
  id: EggProjectId;
  type: "egg";
  hatchTable: ReadonlyArray<HatchTableEntry>;
}

export interface SeedProjectDefinition extends BaseProjectDefinition {
  id: SeedProjectId;
  type: "seeds";
  seedRewardCount: number;
}

export type ProjectDefinition = EggProjectDefinition | SeedProjectDefinition;

export const PROJECT_DEFINITIONS: ReadonlyArray<ProjectDefinition> = [
  {
    id: "meadowEgg",
    type: "egg",
    displayName: "Meadow Egg",
    rewardDescription: "Hatches a meadow duckling",
    hatchTable: [
      { variantId: "yellow", chanceWeight: 40 },
      { variantId: "white", chanceWeight: 35 },
      { variantId: "light-brown", chanceWeight: 25 }
    ]
  },
  {
    id: "pondEgg",
    type: "egg",
    displayName: "Pond Egg",
    rewardDescription: "Hatches a pond duckling",
    hatchTable: [
      { variantId: "brown-green", chanceWeight: 45 },
      { variantId: "gray", chanceWeight: 35 },
      { variantId: "white-black", chanceWeight: 20 }
    ]
  },
  {
    id: "fancyEgg",
    type: "egg",
    displayName: "Fancy Egg",
    rewardDescription: "Hatches a fancy duckling",
    hatchTable: [
      { variantId: "gold", chanceWeight: 50 },
      { variantId: "white-black", chanceWeight: 35 },
      { variantId: "brown-green", chanceWeight: 15 }
    ]
  },
  {
    id: "smallSeedPatch",
    type: "seeds",
    displayName: "Small Seed Patch",
    rewardDescription: "Grows 5 seeds",
    seedRewardCount: 5
  },
  {
    id: "gardenBed",
    type: "seeds",
    displayName: "Garden Bed",
    rewardDescription: "Grows 15 seeds",
    seedRewardCount: 15
  },
  {
    id: "bigHarvest",
    type: "seeds",
    displayName: "Big Harvest",
    rewardDescription: "Grows 35 seeds",
    seedRewardCount: 35
  }
];

export const PROJECT_DEFINITION_BY_ID: Record<ProjectId, ProjectDefinition> = {
  meadowEgg: PROJECT_DEFINITIONS[0],
  pondEgg: PROJECT_DEFINITIONS[1],
  fancyEgg: PROJECT_DEFINITIONS[2],
  smallSeedPatch: PROJECT_DEFINITIONS[3],
  gardenBed: PROJECT_DEFINITIONS[4],
  bigHarvest: PROJECT_DEFINITIONS[5]
};

export function createProjectDefinitionResponses(): ProjectDefinitionResponse[] {
  return PROJECT_DEFINITIONS.map((projectDefinition) => ({
    id: projectDefinition.id,
    type: projectDefinition.type,
    displayName: projectDefinition.displayName,
    requiredProgressSeconds: getProjectDurationSeconds(projectDefinition.id),
    rewardDescription: projectDefinition.rewardDescription
  }));
}

export function isProjectId(value: unknown): value is ProjectId {
  return (
    value === "meadowEgg" ||
    value === "pondEgg" ||
    value === "fancyEgg" ||
    value === "smallSeedPatch" ||
    value === "gardenBed" ||
    value === "bigHarvest"
  );
}

export function isEggProjectId(value: ProjectId): value is EggProjectId {
  return PROJECT_DEFINITION_BY_ID[value].type === "egg";
}

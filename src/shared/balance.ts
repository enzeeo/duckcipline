import type { DuckGrowthStage, ProjectId } from "./types.js";

export const IS_DEBUG_BALANCE_ENABLED = true;

export const MAX_DUCK_COUNT = 20;

export const DUCK_GROWTH_SEED_REQUIREMENTS: Record<Exclude<DuckGrowthStage, "adultDuck">, number> = {
  duckling: 5,
  youngDuck: 10
};

export const NORMAL_PROJECT_DURATION_SECONDS: Record<ProjectId, number> = {
  meadowEgg: 25 * 60,
  pondEgg: 50 * 60,
  fancyEgg: 90 * 60,
  smallSeedPatch: 10 * 60,
  gardenBed: 25 * 60,
  bigHarvest: 50 * 60
};

export const DEBUG_PROJECT_DURATION_SECONDS: Record<ProjectId, number> = {
  meadowEgg: 10,
  pondEgg: 15,
  fancyEgg: 30,
  smallSeedPatch: 5,
  gardenBed: 10,
  bigHarvest: 15
};

export function getProjectDurationSeconds(projectId: ProjectId): number {
  if (IS_DEBUG_BALANCE_ENABLED) {
    return DEBUG_PROJECT_DURATION_SECONDS[projectId];
  }

  return NORMAL_PROJECT_DURATION_SECONDS[projectId];
}

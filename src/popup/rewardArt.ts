import type { ProjectDefinitionResponse } from "../shared/types.js";

export interface FocusRewardArt {
  relativePath: string;
  altText: string;
}

const EGG_REWARD_ART_BY_PROJECT_ID = {
  meadowEgg: {
    relativePath: "src/assets/pixel/ui/egg-meadow.png",
    altText: "Meadow egg"
  },
  pondEgg: {
    relativePath: "src/assets/pixel/ui/egg-pond.png",
    altText: "Pond egg"
  },
  fancyEgg: {
    relativePath: "src/assets/pixel/ui/egg-fancy.png",
    altText: "Fancy egg"
  }
} as const satisfies Record<string, FocusRewardArt>;

const SEED_REWARD_ART: FocusRewardArt = {
  relativePath: "src/assets/pixel/ui/seed-bag.png",
  altText: "Seed pouch"
};

export function getFocusRewardArt(projectDefinition: ProjectDefinitionResponse | null): FocusRewardArt | null {
  if (projectDefinition === null) {
    return null;
  }

  if (projectDefinition.type === "seeds") {
    return SEED_REWARD_ART;
  }

  switch (projectDefinition.id) {
    case "meadowEgg":
    case "pondEgg":
    case "fancyEgg":
      return EGG_REWARD_ART_BY_PROJECT_ID[projectDefinition.id];
    default:
      return null;
  }
}

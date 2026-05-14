import { describe, expect, it } from "vitest";
import type { ProjectDefinitionResponse, ProjectId, ProjectType } from "../shared/types.js";
import { getFocusRewardArt } from "./rewardArt.js";

function createProjectDefinition(id: ProjectId, type: ProjectType): ProjectDefinitionResponse {
  return {
    id,
    type,
    displayName: "Project",
    requiredProgressSeconds: 60,
    rewardDescription: "Reward"
  };
}

describe("rewardArt", () => {
  it("maps egg projects to focused egg art", () => {
    expect(getFocusRewardArt(createProjectDefinition("meadowEgg", "egg"))?.relativePath).toBe(
      "src/assets/pixel/ui/egg-meadow.png"
    );
    expect(getFocusRewardArt(createProjectDefinition("pondEgg", "egg"))?.relativePath).toBe(
      "src/assets/pixel/ui/egg-pond.png"
    );
    expect(getFocusRewardArt(createProjectDefinition("fancyEgg", "egg"))?.relativePath).toBe(
      "src/assets/pixel/ui/egg-fancy.png"
    );
  });

  it("maps every seed project to the seed pouch", () => {
    expect(getFocusRewardArt(createProjectDefinition("smallSeedPatch", "seeds"))?.relativePath).toBe(
      "src/assets/pixel/ui/seed-bag.png"
    );
    expect(getFocusRewardArt(createProjectDefinition("gardenBed", "seeds"))?.relativePath).toBe(
      "src/assets/pixel/ui/seed-bag.png"
    );
    expect(getFocusRewardArt(createProjectDefinition("bigHarvest", "seeds"))?.relativePath).toBe(
      "src/assets/pixel/ui/seed-bag.png"
    );
  });

  it("returns no art for an empty project selection", () => {
    expect(getFocusRewardArt(null)).toBeNull();
  });
});

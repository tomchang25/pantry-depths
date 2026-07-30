import { getEnemyArchetype } from "@/content/combat/enemies";
import { SKELETON_ACTIONS, SKELETON_ATLAS_MANIFEST } from "@/content/enemies/skeleton-action-definitions";
import {
  skeletonAtlasDimensions,
  SKELETON_CELL,
  SKELETON_DEATH_ANIMATIONS,
  SKELETON_DIRECTIONS,
} from "@/content/enemies/skeleton-death-definitions";
import { SKELETON_PICKUP_ASSETS, SKELETON_PICKUP_URLS } from "@/content/enemies/skeleton-pickup-definitions";
import { describe, expect, it } from "vitest";

describe("skeleton content", () => {
  it("gives every type its own action set beside one shared death set", () => {
    expect(SKELETON_DIRECTIONS).toBe(8);
    expect(SKELETON_CELL).toBe(256);
    expect(Object.keys(SKELETON_ACTIONS)).toEqual(["swordsman", "hammerman", "javelineer", "crossbowman"]);
    // No `blasted`: a body a bomb reached leaves no corpse, so that death owns no clip to name.
    expect(Object.keys(SKELETON_DEATH_ANIMATIONS)).toEqual(["collapse", "drowning", "cleaved", "slammed", "impaled"]);

    for (const actions of Object.values(SKELETON_ACTIONS)) {
      expect(Object.keys(actions)).toEqual(["idle", "walk", "hurt", "stunned", "windup", "strike", "recovery"]);
    }

    // Four private sets of seven, plus five deaths owned by none of them.
    expect(Object.keys(SKELETON_ATLAS_MANIFEST)).toHaveLength(33);

    for (const definition of [
      ...Object.values(SKELETON_ACTIONS).flatMap((actions) => Object.values(actions)),
      ...Object.values(SKELETON_DEATH_ANIMATIONS),
    ]) {
      const entry = SKELETON_ATLAS_MANIFEST[definition.assetId];
      expect(entry?.url).toBe(definition.url);
      expect(entry?.dimensions).toEqual({
        width: definition.frames * SKELETON_CELL,
        height: definition.directions * SKELETON_CELL,
      });
      expect(skeletonAtlasDimensions(definition)).toEqual(entry?.dimensions);
    }
  });

  it("exposes one consistent world and left-hand asset for each detachable pickup", () => {
    expect(Object.keys(SKELETON_PICKUP_ASSETS)).toEqual([
      "skeletonSword",
      "skeletonSkull",
      "skeletonFemur",
      "skeletonFemurCracked",
    ]);

    for (const definition of Object.values(SKELETON_PICKUP_ASSETS)) {
      expect(SKELETON_PICKUP_URLS[definition.assetId]).toBe(definition.url);
    }
  });

  it("replaces the retained skeleton placeholder with the authored swordsman", () => {
    expect(getEnemyArchetype("skeleton").appearanceId).toBe("skeletonSwordsman");
  });
});

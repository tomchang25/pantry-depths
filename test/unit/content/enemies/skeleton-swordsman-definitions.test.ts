import { getEnemyArchetype } from "@/content/combat/enemies";
import {
  SKELETON_PICKUP_ASSETS,
  SKELETON_PICKUP_URLS,
  skeletonAtlasDimensions,
  SKELETON_SWORDSMAN_ANIMATIONS,
  SKELETON_SWORDSMAN_ATLAS_MANIFEST,
  SKELETON_SWORDSMAN_CELL,
  SKELETON_SWORDSMAN_DIRECTIONS,
} from "@/content/enemies/skeleton-swordsman-definitions";
import { describe, expect, it } from "vitest";

describe("skeleton swordsman content", () => {
  it("owns a complete eight-way authored animation set", () => {
    expect(SKELETON_SWORDSMAN_DIRECTIONS).toBe(8);
    expect(SKELETON_SWORDSMAN_CELL).toBe(256);
    expect(Object.keys(SKELETON_SWORDSMAN_ANIMATIONS)).toEqual([
      "idle",
      "walk",
      "attack",
      "hurt",
      "block",
      "death",
      "deathSeverRight",
      "deathBlasted",
      "deathImpaled",
      "deathDrowned",
    ]);
    expect(Object.keys(SKELETON_SWORDSMAN_ATLAS_MANIFEST)).toHaveLength(10);

    for (const definition of Object.values(SKELETON_SWORDSMAN_ANIMATIONS)) {
      const entry = SKELETON_SWORDSMAN_ATLAS_MANIFEST[definition.assetId];
      expect(entry?.url).toBe(definition.url);
      expect(entry?.dimensions).toEqual({
        width: definition.frames * SKELETON_SWORDSMAN_CELL,
        height: definition.directions * SKELETON_SWORDSMAN_CELL,
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

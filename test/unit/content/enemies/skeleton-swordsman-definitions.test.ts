import { getEnemyArchetype } from "@/content/combat/enemies";
import {
  SKELETON_PICKUP_ASSETS,
  SKELETON_PICKUP_URLS,
  SKELETON_SWORDSMAN_ANIMATIONS,
  SKELETON_SWORDSMAN_ATLAS_SIZE,
  SKELETON_SWORDSMAN_ATLAS_URLS,
  SKELETON_SWORDSMAN_DIRECTIONS,
  SKELETON_SWORDSMAN_FRAMES,
} from "@/content/enemies/skeleton-swordsman-definitions";
import { describe, expect, it } from "vitest";

describe("skeleton swordsman content", () => {
  it("owns a complete eight-way authored animation set", () => {
    expect(SKELETON_SWORDSMAN_DIRECTIONS).toBe(8);
    expect(SKELETON_SWORDSMAN_FRAMES).toBe(8);
    expect(SKELETON_SWORDSMAN_ATLAS_SIZE).toBe(2048);
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
    expect(Object.keys(SKELETON_SWORDSMAN_ATLAS_URLS)).toHaveLength(10);

    for (const definition of Object.values(SKELETON_SWORDSMAN_ANIMATIONS)) {
      expect(definition.frames).toBe(8);
      expect(SKELETON_SWORDSMAN_ATLAS_URLS[definition.assetId]).toBe(definition.url);
    }
  });

  it("exposes one consistent world and left-hand asset for each detachable pickup", () => {
    expect(Object.keys(SKELETON_PICKUP_ASSETS)).toEqual(["skeletonSword", "skeletonSkull", "skeletonFemur"]);

    for (const definition of Object.values(SKELETON_PICKUP_ASSETS)) {
      expect(SKELETON_PICKUP_URLS[definition.assetId]).toBe(definition.url);
    }
  });

  it("replaces the retained skeleton placeholder with the authored swordsman", () => {
    expect(getEnemyArchetype("skeleton").appearanceId).toBe("skeletonSwordsman");
  });
});

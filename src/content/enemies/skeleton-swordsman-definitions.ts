import skeletonAttackAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-attack.png";
import skeletonBlockAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-block.png";
import skeletonDeathBlastedAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-death-blasted.png";
import skeletonDeathDrownedAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-death-drowned.png";
import skeletonDeathImpaledAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-death-impaled.png";
import skeletonDeathSeverRightAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-death-sever-right.png";
import skeletonDeathAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-death.png";
import skeletonHurtAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-hurt.png";
import skeletonIdleAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-idle.png";
import skeletonWalkAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-walk.png";
import skeletonFemur from "@/content/enemies/assets/skeleton-swordsman/skeleton-femur.png";
import skeletonSkull from "@/content/enemies/assets/skeleton-swordsman/skeleton-skull.png";
import skeletonSword from "@/content/enemies/assets/skeleton-swordsman/skeleton-sword.png";

export type SkeletonSwordsmanAnimationId =
  | "idle"
  | "walk"
  | "attack"
  | "hurt"
  | "block"
  | "death"
  | "deathSeverRight"
  | "deathBlasted"
  | "deathImpaled"
  | "deathDrowned";

export type SkeletonSwordsmanAnimationDefinition = Readonly<{
  assetId: string;
  url: string;
  frames: number;
  framesPerSecond: number;
  loop: boolean;
}>;

export const SKELETON_SWORDSMAN_DIRECTIONS = 8;
export const SKELETON_SWORDSMAN_FRAMES = 8;
/**
 * Eight by eight cells of 256, which is the size the renderer's sprite cache holds a body at.
 *
 * These numbers are the runtime half of `dev/tools/generate-skeleton-swordsman.py`; changing one
 * without re-running that tool fails at load, because the image loader checks the sheet it is given
 * against this exact size rather than trusting it.
 */
export const SKELETON_SWORDSMAN_ATLAS_SIZE = 2048;

export const SKELETON_SWORDSMAN_ANIMATIONS = {
  idle: {
    assetId: "enemy.skeletonSwordsman.atlas.idle",
    url: skeletonIdleAtlas,
    frames: 8,
    framesPerSecond: 7,
    loop: true,
  },
  walk: {
    assetId: "enemy.skeletonSwordsman.atlas.walk",
    url: skeletonWalkAtlas,
    frames: 8,
    framesPerSecond: 10,
    loop: true,
  },
  attack: {
    assetId: "enemy.skeletonSwordsman.atlas.attack",
    url: skeletonAttackAtlas,
    frames: 8,
    framesPerSecond: 12,
    loop: false,
  },
  hurt: {
    assetId: "enemy.skeletonSwordsman.atlas.hurt",
    url: skeletonHurtAtlas,
    frames: 8,
    framesPerSecond: 14,
    loop: false,
  },
  block: {
    assetId: "enemy.skeletonSwordsman.atlas.block",
    url: skeletonBlockAtlas,
    frames: 8,
    framesPerSecond: 10,
    loop: false,
  },
  death: {
    assetId: "enemy.skeletonSwordsman.atlas.death",
    url: skeletonDeathAtlas,
    frames: 8,
    framesPerSecond: 10,
    loop: false,
  },
  deathSeverRight: {
    assetId: "enemy.skeletonSwordsman.atlas.deathSeverRight",
    url: skeletonDeathSeverRightAtlas,
    frames: 8,
    framesPerSecond: 10,
    loop: false,
  },
  deathBlasted: {
    assetId: "enemy.skeletonSwordsman.atlas.deathBlasted",
    url: skeletonDeathBlastedAtlas,
    frames: 8,
    framesPerSecond: 10,
    loop: false,
  },
  deathImpaled: {
    assetId: "enemy.skeletonSwordsman.atlas.deathImpaled",
    url: skeletonDeathImpaledAtlas,
    frames: 8,
    framesPerSecond: 10,
    loop: false,
  },
  deathDrowned: {
    assetId: "enemy.skeletonSwordsman.atlas.deathDrowned",
    url: skeletonDeathDrownedAtlas,
    frames: 8,
    framesPerSecond: 10,
    loop: false,
  },
} as const satisfies Readonly<Record<SkeletonSwordsmanAnimationId, SkeletonSwordsmanAnimationDefinition>>;

export const SKELETON_SWORDSMAN_ATLAS_URLS = Object.fromEntries(
  Object.values(SKELETON_SWORDSMAN_ANIMATIONS).map((definition) => [definition.assetId, definition.url]),
) as Readonly<Record<string, string>>;

export const SKELETON_PICKUP_ASSETS = {
  skeletonSword: { assetId: "demo.skeletonSword", url: skeletonSword },
  skeletonSkull: { assetId: "demo.skeletonSkull", url: skeletonSkull },
  skeletonFemur: { assetId: "demo.skeletonFemur", url: skeletonFemur },
} as const;

export const SKELETON_PICKUP_URLS = Object.fromEntries(
  Object.values(SKELETON_PICKUP_ASSETS).map((definition) => [definition.assetId, definition.url]),
) as Readonly<Record<string, string>>;

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
import skeletonFemurCracked from "@/content/enemies/assets/skeleton-swordsman/skeleton-femur-cracked.png";
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
  /**
   * How many frames this clip holds, and how many directions and how large a cell it was baked at.
   *
   * A frame count per clip rather than one for the set, because most clips do not need eight of
   * them: a body driven into masonry holds a single pose and a walk cycle reads in four. Paying the
   * longest clip's price for every clip is what made a second authored body cost what the first did.
   */
  frames: number;
  directions: number;
  cell: number;
  framesPerSecond: number;
  loop: boolean;
}>;

export const SKELETON_SWORDSMAN_DIRECTIONS = 8;
/** The size the renderer's sprite cache holds a body at. */
export const SKELETON_SWORDSMAN_CELL = 256;

/**
 * The sheet this clip must arrive as, derived rather than stored.
 *
 * A row that carried its own width alongside its frame count could contradict itself, and the one
 * that noticed would be the image loader at startup, in a message about pixels. There is nothing to
 * keep in step here: an atlas is as wide as its frames and as tall as its directions.
 *
 * This is the runtime half of `dev/tools/generate-skeleton-swordsman.py`. Changing a frame count
 * without re-running that tool fails at load, because the loader checks the sheet it is given
 * against this size rather than trusting it.
 */
export function skeletonAtlasDimensions(
  definition: SkeletonSwordsmanAnimationDefinition,
): Readonly<{ width: number; height: number }> {
  return { width: definition.frames * definition.cell, height: definition.directions * definition.cell };
}

export const SKELETON_SWORDSMAN_ANIMATIONS = {
  idle: {
    assetId: "enemy.skeletonSwordsman.atlas.idle",
    url: skeletonIdleAtlas,
    frames: 8,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 7,
    loop: true,
  },
  walk: {
    assetId: "enemy.skeletonSwordsman.atlas.walk",
    url: skeletonWalkAtlas,
    frames: 8,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 10,
    loop: true,
  },
  attack: {
    assetId: "enemy.skeletonSwordsman.atlas.attack",
    url: skeletonAttackAtlas,
    frames: 8,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 12,
    loop: false,
  },
  hurt: {
    assetId: "enemy.skeletonSwordsman.atlas.hurt",
    url: skeletonHurtAtlas,
    frames: 8,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 14,
    loop: false,
  },
  block: {
    assetId: "enemy.skeletonSwordsman.atlas.block",
    url: skeletonBlockAtlas,
    frames: 8,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 10,
    loop: false,
  },
  death: {
    assetId: "enemy.skeletonSwordsman.atlas.death",
    url: skeletonDeathAtlas,
    frames: 8,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 10,
    loop: false,
  },
  deathSeverRight: {
    assetId: "enemy.skeletonSwordsman.atlas.deathSeverRight",
    url: skeletonDeathSeverRightAtlas,
    frames: 8,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 10,
    loop: false,
  },
  deathBlasted: {
    assetId: "enemy.skeletonSwordsman.atlas.deathBlasted",
    url: skeletonDeathBlastedAtlas,
    frames: 8,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 10,
    loop: false,
  },
  deathImpaled: {
    assetId: "enemy.skeletonSwordsman.atlas.deathImpaled",
    url: skeletonDeathImpaledAtlas,
    frames: 8,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 10,
    loop: false,
  },
  deathDrowned: {
    assetId: "enemy.skeletonSwordsman.atlas.deathDrowned",
    url: skeletonDeathDrownedAtlas,
    frames: 8,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 10,
    loop: false,
  },
} as const satisfies Readonly<Record<SkeletonSwordsmanAnimationId, SkeletonSwordsmanAnimationDefinition>>;

/**
 * Every clip as the loader wants it: a url and the exact sheet that url has to be.
 *
 * One entry carrying both, rather than a url table paired with a single size for the whole batch.
 * That pairing was only correct while every clip was the same shape, and it had no way of being
 * wrong out loud once they were not.
 */
export const SKELETON_SWORDSMAN_ATLAS_MANIFEST = Object.fromEntries(
  Object.values(SKELETON_SWORDSMAN_ANIMATIONS).map((definition) => [
    definition.assetId,
    { url: definition.url, dimensions: skeletonAtlasDimensions(definition) },
  ]),
) as Readonly<Record<string, Readonly<{ url: string; dimensions: Readonly<{ width: number; height: number }> }>>>;

export const SKELETON_PICKUP_ASSETS = {
  skeletonSword: { assetId: "demo.skeletonSword", url: skeletonSword },
  skeletonSkull: { assetId: "demo.skeletonSkull", url: skeletonSkull },
  skeletonFemur: { assetId: "demo.skeletonFemur", url: skeletonFemur },
  skeletonFemurCracked: { assetId: "demo.skeletonFemurCracked", url: skeletonFemurCracked },
} as const;

export const SKELETON_PICKUP_URLS = Object.fromEntries(
  Object.values(SKELETON_PICKUP_ASSETS).map((definition) => [definition.assetId, definition.url]),
) as Readonly<Record<string, string>>;

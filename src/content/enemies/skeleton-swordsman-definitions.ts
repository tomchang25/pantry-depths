import skeletonAttackAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-attack.png";
import skeletonBlockAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-block.png";
import skeletonDeathCleavedAtlas from "@/content/enemies/assets/skeleton-common/skeleton-death-cleaved.png";
import skeletonDeathCollapseAtlas from "@/content/enemies/assets/skeleton-common/skeleton-death-collapse.png";
import skeletonDeathDrowningAtlas from "@/content/enemies/assets/skeleton-common/skeleton-death-drowning.png";
import skeletonDeathImpaledAtlas from "@/content/enemies/assets/skeleton-common/skeleton-death-impaled.png";
import skeletonDeathSlammedAtlas from "@/content/enemies/assets/skeleton-common/skeleton-death-slammed.png";
import skeletonHurtAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-hurt.png";
import skeletonIdleAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-idle.png";
import skeletonWalkAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-walk.png";
import skeletonFemurCracked from "@/content/enemies/assets/skeleton-swordsman/skeleton-femur-cracked.png";
import skeletonFemur from "@/content/enemies/assets/skeleton-swordsman/skeleton-femur.png";
import skeletonSkull from "@/content/enemies/assets/skeleton-swordsman/skeleton-skull.png";
import skeletonSword from "@/content/enemies/assets/skeleton-swordsman/skeleton-sword.png";

export type SkeletonSwordsmanAnimationId = "idle" | "walk" | "attack" | "hurt" | "block";

/**
 * How a body ended, named for the situation that killed it rather than for the injury it depicts.
 *
 * The old set was named for injuries, which is how one clip called "severed right arm" ended up
 * playing for two unrelated deaths: an injury is a guess about what a blow did, and a situation is
 * something the simulation actually knows. One copy of this set serves every skeleton, because how a
 * body falls is the same performance whatever it was carrying.
 *
 * `blasted` is deliberately not a member. A body a bomb reached does not fall over, it stops
 * existing, so that death is entirely a burst of bones and there is no clip for it to name.
 */
export type SkeletonDeathId = "collapse" | "drowning" | "cleaved" | "slammed" | "impaled";

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
} as const satisfies Readonly<Record<SkeletonSwordsmanAnimationId, SkeletonSwordsmanAnimationDefinition>>;

/**
 * The death set, owned by no type and carried by all of them.
 *
 * Collapse and drowning keep all eight frames because they are the two deaths the player watches
 * from beginning to end. Cleaved gets four so the body can start whole and come apart; slammed and
 * impaled are single held poses, because a body driven into masonry or riding a shaft does not move
 * again and the scatter of bones does the rest of the work.
 */
export const SKELETON_DEATH_ANIMATIONS = {
  collapse: {
    assetId: "enemy.skeleton.death.collapse",
    url: skeletonDeathCollapseAtlas,
    frames: 8,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 10,
    loop: false,
  },
  drowning: {
    assetId: "enemy.skeleton.death.drowning",
    url: skeletonDeathDrowningAtlas,
    frames: 8,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 10,
    loop: false,
  },
  cleaved: {
    assetId: "enemy.skeleton.death.cleaved",
    url: skeletonDeathCleavedAtlas,
    frames: 4,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 8,
    loop: false,
  },
  slammed: {
    assetId: "enemy.skeleton.death.slammed",
    url: skeletonDeathSlammedAtlas,
    frames: 1,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 1,
    loop: false,
  },
  impaled: {
    assetId: "enemy.skeleton.death.impaled",
    url: skeletonDeathImpaledAtlas,
    frames: 1,
    directions: SKELETON_SWORDSMAN_DIRECTIONS,
    cell: SKELETON_SWORDSMAN_CELL,
    framesPerSecond: 1,
    loop: false,
  },
} as const satisfies Readonly<Record<SkeletonDeathId, SkeletonSwordsmanAnimationDefinition>>;

export const SKELETON_SWORDSMAN_ATLAS_MANIFEST = Object.fromEntries(
  [...Object.values(SKELETON_SWORDSMAN_ANIMATIONS), ...Object.values(SKELETON_DEATH_ANIMATIONS)].map((definition) => [
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

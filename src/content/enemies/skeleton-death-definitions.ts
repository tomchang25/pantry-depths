import skeletonDeathCleavedAtlas from "@/content/enemies/assets/skeleton-common/skeleton-death-cleaved.png";
import skeletonDeathCollapseAtlas from "@/content/enemies/assets/skeleton-common/skeleton-death-collapse.png";
import skeletonDeathDrowningAtlas from "@/content/enemies/assets/skeleton-common/skeleton-death-drowning.png";
import skeletonDeathImpaledAtlas from "@/content/enemies/assets/skeleton-common/skeleton-death-impaled.png";
import skeletonDeathSlammedAtlas from "@/content/enemies/assets/skeleton-common/skeleton-death-slammed.png";

export type SkeletonClipDefinition = Readonly<{
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

export const SKELETON_DIRECTIONS = 8;
/** The size the renderer's sprite cache holds a body at. */
export const SKELETON_CELL = 256;

/**
 * The sheet this clip must arrive as, derived rather than stored.
 *
 * A row that carried its own width alongside its frame count could contradict itself, and the one
 * that noticed would be the image loader at startup, in a message about pixels. There is nothing to
 * keep in step here: an atlas is as wide as its frames and as tall as its directions.
 *
 * This is the runtime half of `dev/tools/generate-skeletons.py`. Changing a frame count without
 * re-running that tool fails at load, because the loader checks the sheet it is given against this
 * size rather than trusting it.
 */
export function skeletonAtlasDimensions(
  definition: SkeletonClipDefinition,
): Readonly<{ width: number; height: number }> {
  return { width: definition.frames * definition.cell, height: definition.directions * definition.cell };
}

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
    directions: SKELETON_DIRECTIONS,
    cell: SKELETON_CELL,
    framesPerSecond: 10,
    loop: false,
  },
  drowning: {
    assetId: "enemy.skeleton.death.drowning",
    url: skeletonDeathDrowningAtlas,
    frames: 8,
    directions: SKELETON_DIRECTIONS,
    cell: SKELETON_CELL,
    framesPerSecond: 10,
    loop: false,
  },
  cleaved: {
    assetId: "enemy.skeleton.death.cleaved",
    url: skeletonDeathCleavedAtlas,
    frames: 4,
    directions: SKELETON_DIRECTIONS,
    cell: SKELETON_CELL,
    framesPerSecond: 8,
    loop: false,
  },
  slammed: {
    assetId: "enemy.skeleton.death.slammed",
    url: skeletonDeathSlammedAtlas,
    frames: 1,
    directions: SKELETON_DIRECTIONS,
    cell: SKELETON_CELL,
    framesPerSecond: 1,
    loop: false,
  },
  impaled: {
    assetId: "enemy.skeleton.death.impaled",
    url: skeletonDeathImpaledAtlas,
    frames: 1,
    directions: SKELETON_DIRECTIONS,
    cell: SKELETON_CELL,
    framesPerSecond: 1,
    loop: false,
  },
} as const satisfies Readonly<Record<SkeletonDeathId, SkeletonClipDefinition>>;

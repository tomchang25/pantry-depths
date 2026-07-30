import crossbowmanHurtAtlas from "@/content/enemies/assets/skeleton-crossbowman/skeleton-crossbowman-atlas-hurt.png";
import crossbowmanIdleAtlas from "@/content/enemies/assets/skeleton-crossbowman/skeleton-crossbowman-atlas-idle.png";
import crossbowmanRecoveryAtlas from "@/content/enemies/assets/skeleton-crossbowman/skeleton-crossbowman-atlas-recovery.png";
import crossbowmanStrikeAtlas from "@/content/enemies/assets/skeleton-crossbowman/skeleton-crossbowman-atlas-strike.png";
import crossbowmanStunnedAtlas from "@/content/enemies/assets/skeleton-crossbowman/skeleton-crossbowman-atlas-stunned.png";
import crossbowmanWalkAtlas from "@/content/enemies/assets/skeleton-crossbowman/skeleton-crossbowman-atlas-walk.png";
import crossbowmanWindupAtlas from "@/content/enemies/assets/skeleton-crossbowman/skeleton-crossbowman-atlas-windup.png";
import hammermanHurtAtlas from "@/content/enemies/assets/skeleton-hammerman/skeleton-hammerman-atlas-hurt.png";
import hammermanIdleAtlas from "@/content/enemies/assets/skeleton-hammerman/skeleton-hammerman-atlas-idle.png";
import hammermanRecoveryAtlas from "@/content/enemies/assets/skeleton-hammerman/skeleton-hammerman-atlas-recovery.png";
import hammermanStrikeAtlas from "@/content/enemies/assets/skeleton-hammerman/skeleton-hammerman-atlas-strike.png";
import hammermanStunnedAtlas from "@/content/enemies/assets/skeleton-hammerman/skeleton-hammerman-atlas-stunned.png";
import hammermanWalkAtlas from "@/content/enemies/assets/skeleton-hammerman/skeleton-hammerman-atlas-walk.png";
import hammermanWindupAtlas from "@/content/enemies/assets/skeleton-hammerman/skeleton-hammerman-atlas-windup.png";
import javelineerHurtAtlas from "@/content/enemies/assets/skeleton-javelineer/skeleton-javelineer-atlas-hurt.png";
import javelineerIdleAtlas from "@/content/enemies/assets/skeleton-javelineer/skeleton-javelineer-atlas-idle.png";
import javelineerRecoveryAtlas from "@/content/enemies/assets/skeleton-javelineer/skeleton-javelineer-atlas-recovery.png";
import javelineerStrikeAtlas from "@/content/enemies/assets/skeleton-javelineer/skeleton-javelineer-atlas-strike.png";
import javelineerStunnedAtlas from "@/content/enemies/assets/skeleton-javelineer/skeleton-javelineer-atlas-stunned.png";
import javelineerWalkAtlas from "@/content/enemies/assets/skeleton-javelineer/skeleton-javelineer-atlas-walk.png";
import javelineerWindupAtlas from "@/content/enemies/assets/skeleton-javelineer/skeleton-javelineer-atlas-windup.png";
import swordsmanHurtAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-hurt.png";
import swordsmanIdleAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-idle.png";
import swordsmanRecoveryAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-recovery.png";
import swordsmanStrikeAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-strike.png";
import swordsmanStunnedAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-stunned.png";
import swordsmanWalkAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-walk.png";
import swordsmanWindupAtlas from "@/content/enemies/assets/skeleton-swordsman/skeleton-swordsman-atlas-windup.png";
import {
  SKELETON_CELL,
  SKELETON_DEATH_ANIMATIONS,
  SKELETON_DIRECTIONS,
  skeletonAtlasDimensions,
  type SkeletonClipDefinition,
} from "@/content/enemies/skeleton-death-definitions";

/**
 * The four authored bodies, as the only thing that distinguishes their artwork: the weapon.
 *
 * A type rather than an appearance, because what decides which sheet to draw is which weapon is in
 * the hand and not what colour the body is. The two are mapped to each other where an entity's
 * appearance is resolved, which keeps a body free to change how it looks without changing what it
 * is holding.
 */
export type SkeletonTypeId = "swordsman" | "hammerman" | "javelineer" | "crossbowman";

/**
 * The clips a type privately owns: every one where its own weapon is in motion.
 *
 * Nothing here is shared, and that is not an oversight. The weapon is modelled as part of the body
 * rather than composited over it, so a shared walk would put a swordsman's blade in a hammer-bearer's
 * hands. What is shared is how a body dies, which is the same performance whatever it was carrying.
 *
 * Three attack clips, because there are three states and the player has to tell them apart: winding
 * up says get out of the way, striking says too late, and recovering says free hits now. Recovery is
 * the one that did not exist — a body on cooldown already stood still, but it stood still in its idle
 * pose, so the most punishable window in a fight was invisible.
 */
export type SkeletonActionId = "idle" | "walk" | "hurt" | "stunned" | "windup" | "strike" | "recovery";

export const SKELETON_ACTIONS = {
  swordsman: {
    idle: {
      assetId: "enemy.skeleton.swordsman.idle",
      url: swordsmanIdleAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 7,
      loop: true,
    },
    walk: {
      assetId: "enemy.skeleton.swordsman.walk",
      url: swordsmanWalkAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 10,
      loop: true,
    },
    hurt: {
      assetId: "enemy.skeleton.swordsman.hurt",
      url: swordsmanHurtAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 14,
      loop: false,
    },
    stunned: {
      assetId: "enemy.skeleton.swordsman.stunned",
      url: swordsmanStunnedAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 8,
      loop: true,
    },
    windup: {
      assetId: "enemy.skeleton.swordsman.windup",
      url: swordsmanWindupAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 9,
      loop: false,
    },
    strike: {
      assetId: "enemy.skeleton.swordsman.strike",
      url: swordsmanStrikeAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 12,
      loop: false,
    },
    recovery: {
      assetId: "enemy.skeleton.swordsman.recovery",
      url: swordsmanRecoveryAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 8,
      loop: false,
    },
  },
  hammerman: {
    idle: {
      assetId: "enemy.skeleton.hammerman.idle",
      url: hammermanIdleAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 7,
      loop: true,
    },
    walk: {
      assetId: "enemy.skeleton.hammerman.walk",
      url: hammermanWalkAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 10,
      loop: true,
    },
    hurt: {
      assetId: "enemy.skeleton.hammerman.hurt",
      url: hammermanHurtAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 14,
      loop: false,
    },
    stunned: {
      assetId: "enemy.skeleton.hammerman.stunned",
      url: hammermanStunnedAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 8,
      loop: true,
    },
    windup: {
      assetId: "enemy.skeleton.hammerman.windup",
      url: hammermanWindupAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 9,
      loop: false,
    },
    strike: {
      assetId: "enemy.skeleton.hammerman.strike",
      url: hammermanStrikeAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 12,
      loop: false,
    },
    recovery: {
      assetId: "enemy.skeleton.hammerman.recovery",
      url: hammermanRecoveryAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 8,
      loop: false,
    },
  },
  javelineer: {
    idle: {
      assetId: "enemy.skeleton.javelineer.idle",
      url: javelineerIdleAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 7,
      loop: true,
    },
    walk: {
      assetId: "enemy.skeleton.javelineer.walk",
      url: javelineerWalkAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 10,
      loop: true,
    },
    hurt: {
      assetId: "enemy.skeleton.javelineer.hurt",
      url: javelineerHurtAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 14,
      loop: false,
    },
    stunned: {
      assetId: "enemy.skeleton.javelineer.stunned",
      url: javelineerStunnedAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 8,
      loop: true,
    },
    windup: {
      assetId: "enemy.skeleton.javelineer.windup",
      url: javelineerWindupAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 9,
      loop: false,
    },
    strike: {
      assetId: "enemy.skeleton.javelineer.strike",
      url: javelineerStrikeAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 12,
      loop: false,
    },
    recovery: {
      assetId: "enemy.skeleton.javelineer.recovery",
      url: javelineerRecoveryAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 8,
      loop: false,
    },
  },
  crossbowman: {
    idle: {
      assetId: "enemy.skeleton.crossbowman.idle",
      url: crossbowmanIdleAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 7,
      loop: true,
    },
    walk: {
      assetId: "enemy.skeleton.crossbowman.walk",
      url: crossbowmanWalkAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 10,
      loop: true,
    },
    hurt: {
      assetId: "enemy.skeleton.crossbowman.hurt",
      url: crossbowmanHurtAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 14,
      loop: false,
    },
    stunned: {
      assetId: "enemy.skeleton.crossbowman.stunned",
      url: crossbowmanStunnedAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 8,
      loop: true,
    },
    windup: {
      assetId: "enemy.skeleton.crossbowman.windup",
      url: crossbowmanWindupAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 9,
      loop: false,
    },
    strike: {
      assetId: "enemy.skeleton.crossbowman.strike",
      url: crossbowmanStrikeAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 12,
      loop: false,
    },
    recovery: {
      assetId: "enemy.skeleton.crossbowman.recovery",
      url: crossbowmanRecoveryAtlas,
      frames: 4,
      directions: SKELETON_DIRECTIONS,
      cell: SKELETON_CELL,
      framesPerSecond: 8,
      loop: false,
    },
  },
} as const satisfies Readonly<Record<SkeletonTypeId, Readonly<Record<SkeletonActionId, SkeletonClipDefinition>>>>;

/**
 * Every clip in the game as the loader wants it: a url and the exact sheet that url has to be.
 *
 * One entry carrying both, rather than a url table paired with a single size for the whole batch.
 * That pairing was only correct while every clip was the same shape, and it had no way of being
 * wrong out loud once they were not.
 */
export const SKELETON_ATLAS_MANIFEST = Object.fromEntries(
  [
    ...Object.values(SKELETON_ACTIONS).flatMap((set) => Object.values(set)),
    ...Object.values(SKELETON_DEATH_ANIMATIONS),
  ].map((definition) => [definition.assetId, { url: definition.url, dimensions: skeletonAtlasDimensions(definition) }]),
) as Readonly<Record<string, Readonly<{ url: string; dimensions: Readonly<{ width: number; height: number }> }>>>;

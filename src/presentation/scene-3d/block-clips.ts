/**
 * The blocky armature's own vocabulary: which weapons it carries, which clips it plays, and which of
 * those hold rather than loop.
 *
 * These strings are a contract with `dev/tools/generate-blocky-skeleton.py`, which names the NLA
 * tracks and the weapon meshes this module selects by. A rename on either side has to be a rename on
 * both, and the failure mode if it is not is a clip that silently does not exist rather than an
 * error anybody sees.
 *
 * One owner, deliberately. This started as a copy taken when the renderer and the block viewer were
 * a presentation module and a sandbox experiment that were forbidden to import each other; the
 * viewer has since graduated into the debug layer, so the copy became a second owner for one set of
 * names and was folded back into this one.
 */

export const BLOCK_WEAPONS = ["sword", "hammer", "javelin", "crossbow"] as const;
export type BlockWeapon = (typeof BLOCK_WEAPONS)[number];

export const BLOCK_CLIPS = ["idle", "walk", "windup", "strike", "recovery", "crossbowAim", "crossbowReload"] as const;
export type BlockClip = (typeof BLOCK_CLIPS)[number];

/**
 * Which clips each weapon plays.
 *
 * Sword, hammer and javelin share one set: a javelin throw is the same overhead arc as a chop,
 * because what leaves the hand is the simulation's projectile and not something the animation has to
 * draw. The crossbow is the exception, and its reload is a pose the game wants a visible window for.
 */
export const WEAPON_CLIPS: Readonly<Record<BlockWeapon, readonly BlockClip[]>> = {
  sword: ["idle", "walk", "windup", "strike", "recovery"],
  hammer: ["idle", "walk", "windup", "strike", "recovery"],
  javelin: ["idle", "walk", "windup", "strike", "recovery"],
  crossbow: ["idle", "walk", "crossbowAim", "crossbowReload"],
};

/** Clips that hold their last frame rather than looping, because the simulation owns their length. */
export const HOLDING_CLIPS: ReadonlySet<BlockClip> = new Set<BlockClip>([
  "windup",
  "strike",
  "recovery",
  "crossbowAim",
  "crossbowReload",
]);

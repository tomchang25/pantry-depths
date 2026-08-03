/**
 * The clip and weapon names the blocky armature ships with, copied into this experiment.
 *
 * A copy for the same reason the textures are: one experiment never imports another, and the block
 * viewer these names came from is a separate folder with a separate life. They are a contract with
 * the Blender build script rather than with that folder — a rename there is a rename here, and the
 * failure mode is a clip that silently does not exist rather than an error anybody sees.
 */

export type BlockWeapon = "sword" | "hammer" | "javelin" | "crossbow";

export type BlockClip = "idle" | "walk" | "windup" | "strike" | "recovery" | "crossbowAim" | "crossbowReload";

/** Clips that hold their last frame rather than looping, because the simulation owns their length. */
export const HOLDING_CLIPS: ReadonlySet<BlockClip> = new Set<BlockClip>([
  "windup",
  "strike",
  "recovery",
  "crossbowAim",
  "crossbowReload",
]);

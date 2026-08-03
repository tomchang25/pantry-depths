/**
 * The semantic sound vocabulary: every moment the game may mark with a cue.
 *
 * The rules report these ids as events on the world; the content table beside the recordings gives
 * each one a recipe or a sample and validates that no id is missing a row — a cue somebody raises
 * cannot quietly play silence. The list is deliberately short: a moment not on it is meant to be
 * silent.
 */

export const SFX_CUE_IDS = [
  "uiSelect",
  "meleeSwing",
  "meleeHitFlesh",
  "meleeHitBone",
  "meleeHitWallStone",
  "meleeHitWallWood",
  "meleeHitAltar",
  "wallBreakStone",
  "wallBreakWood",
  "throw",
  "pinLand",
  "strikeLand",
  "rockLand",
  "bodyBarge",
  "bodyLand",
  "waterEntry",
  "detonation",
  "shellLand",
  "rewardGain",
  "playerHurt",
  "playerDeath",
] as const;

export type SfxCueId = (typeof SFX_CUE_IDS)[number];

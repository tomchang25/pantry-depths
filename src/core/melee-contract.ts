/**
 * The melee vocabulary the rules resolve against: which cuts exist, and when a swing acts.
 *
 * The drawn poses, arcs, and the authored definition table live with the viewmodel in content; what
 * the rules need is narrower — an id to commit to, and the three timing facts that decide when a
 * swing's damage lands. Those live here so the tick imports nothing outside core.
 */

export const MELEE_ATTACK_IDS = [
  "horizontal-left-high",
  "horizontal-left",
  "horizontal-left-low",
  "horizontal-right",
  "diagonal-right",
  "overhead",
  "diagonal-left",
  "thrust",
] as const;

export type MeleeAttackId = (typeof MELEE_ATTACK_IDS)[number];

/**
 * How long a swing takes, in seconds, from the press to the follow-through's end.
 *
 * The poses were authored at 0.767 and that is still where they are clearest, but clarity was never
 * the only thing being paid for — a swing is also how fast the floor empties. This is the trade taken
 * deliberately: about a fifth off the authored pace, which the eye still resolves as three distinct
 * poses. Below roughly 0.4 it stops being a cut and becomes a flicker — that is the floor, not a
 * suggestion.
 */
export const MELEE_SWING_SECONDS = 0.6;

/**
 * The slice of the swing during which the cut is live, as fractions of the whole.
 *
 * The whoosh starts at the press; the damage lands only inside this window, which is what makes the
 * swing an animation with a moment in it rather than a hitbox with a picture on top.
 */
export const MELEE_CUT_START = 0.24;
export const MELEE_CUT_END = 0.49;

/**
 * The next cut, never the one just played.
 *
 * Eight attacks with no chain between them, so the only thing standing between this and a visible
 * pattern is that consecutive swings differ. Two in a row is the one repetition the eye catches.
 * Returns the id alone: which cut was chosen is the rules' business, and how it is drawn is not.
 */
export function chooseMeleeAttackId(previous: MeleeAttackId | undefined): MeleeAttackId {
  const candidates = previous ? MELEE_ATTACK_IDS.filter((id) => id !== previous) : MELEE_ATTACK_IDS;
  const selected = candidates[Math.floor(Math.random() * candidates.length)];

  if (!selected) {
    throw new Error("melee: no attack candidate is available");
  }

  return selected;
}

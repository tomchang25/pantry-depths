/**
 * What kinds of loose object exist.
 *
 * The one list every layer speaks: the room contract's scatter says which of these a floor holds, the
 * content layer's display and behaviour tables each cover all of them, and the rules resolve what a
 * thrown one does. It lives in core because it is vocabulary rather than data — a kind added here
 * fails to compile everywhere a table is missing a row, which is the mechanism that keeps the three
 * tables honest.
 */

export const PROP_KINDS = [
  "stick",
  "rock",
  "bomb",
  "hammer",
  "skeletonSword",
  "skeletonSkull",
  "skeletonFemur",
  "skeletonFemurCracked",
  "skeletonJavelin",
  "skeletonJavelinCracked",
  "crossbow",
  "crossbowSpent",
  "crossbowBolt",
] as const;

export type PropKind = (typeof PROP_KINDS)[number];

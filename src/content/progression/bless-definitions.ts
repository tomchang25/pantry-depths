/**
 * Blessings: the run's only permanent progression, as the two authored tiers behind
 * `@/core/progression-contract`.
 *
 * The distinct tier rewrites a rule rather than nudging a number, holds one of each, and runs out;
 * the stacking tier moves a single number and repeats without limit. Both reach the award through
 * the game catalog.
 */

import type { BlessDefinition, StackingBlessDefinition } from "@/core/progression/progression-contract";

export const BLESS_CATALOG: readonly BlessDefinition[] = [
  {
    id: "heavyStrike",
    name: "Heavy Strike",
    detail: "Far more melee reach and damage, and every hit knocks back",
    color: "#e8a24c",
  },
  {
    id: "explosiveBody",
    name: "Explosive Body",
    detail: "A thrown enemy detonates on impact: double damage, wider reach, and knockback",
    color: "#e2585f",
  },
  {
    id: "stormStone",
    name: "Storm Stone",
    detail: "A landed rock arcs lightning, which may keep chaining outward",
    color: "#8fd4f0",
  },
  {
    id: "lifesteal",
    name: "Bloodthirst",
    detail: "Every kill heals you",
    color: "#7fd8a2",
  },
  {
    id: "hostageGuard",
    name: "Hostage Guard",
    detail:
      "While you hold an enemy it takes the damage coming at your front; when it dies you are left holding ammunition",
    color: "#c79ae8",
  },
] as const;

/**
 * The tier that never empties.
 *
 * Breadth here is what keeps a late run from feeling like one reward wearing four labels, so a new
 * kind of number belongs in this table rather than in a special case at the point of award.
 */
export const BLESS_STACKING_CATALOG: readonly StackingBlessDefinition[] = [
  {
    id: "vigour",
    axis: "maxHp",
    name: "Vigour",
    detail: "More maximum health, and the difference healed on the spot",
    color: "#f0e0a0",
  },
  {
    id: "brutality",
    axis: "meleeDamage",
    name: "Brutality",
    detail: "Every swing lands harder, and so does everything you throw",
    color: "#e8875c",
  },
  {
    id: "swiftness",
    axis: "moveSpeed",
    name: "Swiftness",
    detail: "You cross a floor faster",
    color: "#9fe0d0",
  },
  {
    id: "longReach",
    axis: "meleeReach",
    name: "Long Reach",
    detail: "You strike from further out",
    color: "#c0c8e8",
  },
] as const;

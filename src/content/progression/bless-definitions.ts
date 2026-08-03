/**
 * Blessings: the run's only permanent progression.
 *
 * Two tiers, and an award never falls between them. The distinct tier rewrites a rule rather than
 * nudging a number, so the answer to "what does this run play like" is the list you are holding; it
 * holds one of each and runs out. Behind it the stacking tier moves a single number, repeats without
 * limit, and is therefore what the run keeps paying from once the distinct tier is spent.
 *
 * They are granted one at a time — from an altar, or from taking the stairs down — and never chosen
 * from a hand of three, because the point here is that the run shapes itself and you adapt.
 *
 * The catalogues live here; the run's blessing state, and the award that mutates it, live with the
 * rest of the run state in the demo half.
 */

import type { ModifierAxis } from "@/content/progression/modifier-definitions";

export type BlessId = "heavyStrike" | "explosiveBody" | "stormStone" | "lifesteal" | "hostageGuard";

export type BlessDefinition = Readonly<{
  id: BlessId;
  name: string;
  detail: string;
  color: string;
}>;

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

export type StackingBlessId = "vigour" | "brutality" | "swiftness" | "longReach";

/**
 * The four numbers the stacking tier moves.
 *
 * The same axes a core rolls on, because they are one layer: the modifier catalogue owns the list and
 * the magnitudes, and an entry here only says which axis it moves and how it reads.
 */
export type StackingBlessAxis = ModifierAxis;

export type StackingBlessDefinition = Readonly<{
  id: StackingBlessId;
  axis: StackingBlessAxis;
  name: string;
  detail: string;
  color: string;
}>;

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

export function findBless(id: BlessId | StackingBlessId): BlessDefinition | StackingBlessDefinition | undefined {
  return (
    BLESS_CATALOG.find((candidate) => candidate.id === id) ??
    BLESS_STACKING_CATALOG.find((candidate) => candidate.id === id)
  );
}

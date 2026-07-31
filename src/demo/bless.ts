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
 */

import { blessingStep, type ModifierAxis } from "@/demo/modifiers";

export type BlessId = "heavyStrike" | "explosiveBody" | "stormStone" | "lifesteal" | "hostageGuard";

export type BlessDefinition = Readonly<{
  id: BlessId;
  name: string;
  detail: string;
  /** Two characters at most; drawn into the bless bar and onto the award card. */
  glyph: string;
  color: string;
}>;

export const BLESS_CATALOG: readonly BlessDefinition[] = [
  {
    id: "heavyStrike",
    name: "Heavy Strike",
    detail: "Far more melee reach and damage, and every hit knocks back",
    glyph: "⚔",
    color: "#e8a24c",
  },
  {
    id: "explosiveBody",
    name: "Explosive Body",
    detail: "A thrown enemy detonates on impact: double damage, wider reach, and knockback",
    glyph: "☄",
    color: "#e2585f",
  },
  {
    id: "stormStone",
    name: "Storm Stone",
    detail: "A landed rock arcs lightning, which may keep chaining outward",
    glyph: "⚡",
    color: "#8fd4f0",
  },
  {
    id: "lifesteal",
    name: "Bloodthirst",
    detail: "Every kill heals you",
    glyph: "✚",
    color: "#7fd8a2",
  },
  {
    id: "hostageGuard",
    name: "Hostage Guard",
    detail:
      "While you hold an enemy it takes the damage coming at your front; when it dies you are left holding ammunition",
    glyph: "✋",
    color: "#c79ae8",
  },
] as const;

export type StackingBlessId = "vigour" | "brutality" | "swiftness" | "longReach";

/**
 * The four numbers the stacking tier moves.
 *
 * The same axes a core rolls on, because they are one layer: `@/demo/modifiers` owns the list and the
 * magnitudes, and an entry here only says which axis it moves and how it reads.
 */
export type StackingBlessAxis = ModifierAxis;

export type StackingBlessDefinition = Readonly<{
  id: StackingBlessId;
  axis: StackingBlessAxis;
  name: string;
  detail: string;
  /** Two characters at most; drawn into the bless bar and onto the award card. */
  glyph: string;
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
    glyph: "✜",
    color: "#f0e0a0",
  },
  {
    id: "brutality",
    axis: "meleeDamage",
    name: "Brutality",
    detail: "Every swing lands harder, and so does everything you throw",
    glyph: "⁂",
    color: "#e8875c",
  },
  {
    id: "swiftness",
    axis: "moveSpeed",
    name: "Swiftness",
    detail: "You cross a floor faster",
    glyph: "»",
    color: "#9fe0d0",
  },
  {
    id: "longReach",
    axis: "meleeReach",
    name: "Long Reach",
    detail: "You strike from further out",
    glyph: "⟶",
    color: "#c0c8e8",
  },
] as const;

export type BlessState = {
  owned: BlessId[];
  /**
   * Running total per stacking axis. A total rather than a count, because an award compounds and
   * nothing downstream cares how many awards it took to get here.
   */
  stacking: Record<StackingBlessAxis, number>;
  /**
   * Extra maximum health won from the stacking tier, mirrored out of `stacking` for the display.
   */
  overflowMaxHp: number;
};

export function createBlessState(): BlessState {
  return {
    owned: [],
    stacking: { maxHp: 0, meleeDamage: 0, moveSpeed: 0, meleeReach: 0 },
    overflowMaxHp: 0,
  };
}

/** Answers for the distinct tier only; a stacking blessing is held by amount, not by presence. */
export function hasBless(state: BlessState, id: BlessId): boolean {
  return state.owned.includes(id);
}

export function findBless(id: BlessId | StackingBlessId): BlessDefinition | StackingBlessDefinition | undefined {
  return (
    BLESS_CATALOG.find((candidate) => candidate.id === id) ??
    BLESS_STACKING_CATALOG.find((candidate) => candidate.id === id)
  );
}

/** What the stacking tier has added to one axis so far. One accessor, because there is one layer. */
export function blessBonus(state: BlessState, axis: ModifierAxis): number {
  return state.stacking[axis];
}

/**
 * How many awards a running total represents.
 *
 * Derived rather than stored: the tier pays the same amount under the same name every time, so the
 * total already answers this exactly. Keeping a tally beside it would put a second owner on a number
 * that has one, and the two would disagree the first time either was written without the other.
 */
export function blessStackCount(state: BlessState, axis: ModifierAxis): number {
  const step = blessingStep(axis);
  return step > 0 ? Math.round(state.stacking[axis] / step) : 0;
}

/**
 * Maximum health the caller still owes the player for an award.
 *
 * Health is stored on the player rather than derived, so this axis is the one the award site has to
 * apply itself; the other three are totals the readers consult.
 */
export function blessMaxHpGain(granted: BlessDefinition | StackingBlessDefinition): number {
  return "axis" in granted && granted.axis === "maxHp" ? blessingStep(granted.axis) : 0;
}

/**
 * Grants one blessing, always.
 *
 * The distinct tier is drawn from first and never repeats. Once it is spent the draw falls to the
 * stacking tier, which has no uniqueness rule, so there is no third case and no award that is
 * really the absence of one.
 */
export function grantBless(state: BlessState): BlessDefinition | StackingBlessDefinition {
  const available = BLESS_CATALOG.filter((candidate) => !state.owned.includes(candidate.id));
  const distinct = available[Math.floor(Math.random() * available.length)];

  if (distinct) {
    state.owned.push(distinct.id);
    return distinct;
  }

  const stacking = BLESS_STACKING_CATALOG[Math.floor(Math.random() * BLESS_STACKING_CATALOG.length)];

  if (!stacking) {
    throw new Error("the stacking blessing catalogue is empty");
  }

  state.stacking[stacking.axis] += blessingStep(stacking.axis);
  state.overflowMaxHp = state.stacking.maxHp;
  return stacking;
}

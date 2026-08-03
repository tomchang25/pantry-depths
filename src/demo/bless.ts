/**
 * The run's blessing state, and the award that mutates it.
 *
 * The catalogues — both tiers, their types, and the lookup — live in
 * `@/content/progression/bless-definitions`; the magnitudes live on the modifier catalogue beside
 * them. What stays here is the state a run holds and everything that reads or writes it, which is
 * run-half by nature and moves into core with the rules.
 */

import {
  BLESS_CATALOG,
  BLESS_STACKING_CATALOG,
  type BlessDefinition,
  type BlessId,
  type StackingBlessAxis,
  type StackingBlessDefinition,
} from "@/content/progression/bless-definitions";
import { blessingStep, type ModifierAxis } from "@/content/progression/modifier-definitions";

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

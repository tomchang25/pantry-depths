/**
 * The run's blessing state, and the award that mutates it.
 *
 * The catalogues — both tiers and their magnitudes — are authored content and arrive through the
 * game catalog; what lives here is the state a run holds and everything that reads or writes it.
 */

import type { GameCatalog } from "@/core/catalog";
import {
  blessingStep,
  type BlessDefinition,
  type BlessId,
  type ModifierAxis,
  type StackingBlessAxis,
  type StackingBlessDefinition,
} from "@/core/progression-contract";

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
export function blessStackCount(catalog: GameCatalog, state: BlessState, axis: ModifierAxis): number {
  const step = blessingStep(catalog, axis);
  return step > 0 ? Math.round(state.stacking[axis] / step) : 0;
}

/**
 * Maximum health the caller still owes the player for an award.
 *
 * Health is stored on the player rather than derived, so this axis is the one the award site has to
 * apply itself; the other three are totals the readers consult.
 */
export function blessMaxHpGain(catalog: GameCatalog, granted: BlessDefinition | StackingBlessDefinition): number {
  return "axis" in granted && granted.axis === "maxHp" ? blessingStep(catalog, granted.axis) : 0;
}

/**
 * Grants one blessing, always.
 *
 * The distinct tier is drawn from first and never repeats. Once it is spent the draw falls to the
 * stacking tier, which has no uniqueness rule, so there is no third case and no award that is
 * really the absence of one.
 */
export function grantBless(catalog: GameCatalog, state: BlessState): BlessDefinition | StackingBlessDefinition {
  const available = catalog.blessCatalog.filter((candidate) => !state.owned.includes(candidate.id));
  const distinct = available[Math.floor(Math.random() * available.length)];

  if (distinct) {
    state.owned.push(distinct.id);
    return distinct;
  }

  const stacking = catalog.blessStackingCatalog[Math.floor(Math.random() * catalog.blessStackingCatalog.length)];

  if (!stacking) {
    throw new Error("the stacking blessing catalogue is empty");
  }

  state.stacking[stacking.axis] += blessingStep(catalog, stacking.axis);
  state.overflowMaxHp = state.stacking.maxHp;
  return stacking;
}

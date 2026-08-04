/**
 * What the progression layer is made of: the modifier axes, the melee cores, and the two blessing
 * tiers, as contracts.
 *
 * The catalogues themselves — which axes exist with what bounds, which cores, which blessings — are
 * authored content and arrive through the game catalog; the finders here take that catalog. Core
 * rolls and blessing awards resolve against these shapes without importing a table.
 */

import type { GameCatalog } from "@/core/catalog";

export type ModifierAxis = "meleeDamage" | "maxHp" | "moveSpeed" | "meleeReach";

export type ModifierRange = Readonly<{ low: number; high: number }>;

export type ModifierDefinition = Readonly<{
  axis: ModifierAxis;
  name: string;
  /** What one stacking blessing on this axis adds, every time it is awarded. */
  blessing: number;
  /** What a clean core rolls. Never negative. */
  clean: ModifierRange;
  /** What a cursed core rolls: wider than clean in both directions. */
  cursed: ModifierRange;
  /** Decimal places worth showing, so a speed roll does not print as an integer. */
  precision: number;
}>;

export type ModifierRolls = Readonly<Partial<Record<ModifierAxis, number>>>;

/**
 * The axes a core rolls on.
 *
 * Melee damage and maximum health only. Movement speed and melee reach belong to blessings for now,
 * which narrows what a core can be rather than what the catalogue can hold — a scope decision, not a
 * design one, and the catalogue is already wide enough for the day it changes.
 */
export const CORE_ROLL_AXES: readonly ModifierAxis[] = ["meleeDamage", "maxHp"];

export type CoreCurse = "clean" | "cursed";

export type CoreId = "cleaver" | "mallet" | "skewer" | "ladle";

/**
 * The four melee bases a core can be.
 *
 * Named for what they are in a cellar rather than for a skeleton's weapon, because the weapons the
 * bodies drop are being renamed by concurrent work and a core is a different thing from a prop: one is
 * chosen before a run and the other is picked up off the floor during one.
 */
export type CoreDefinition = Readonly<{
  id: CoreId;
  name: string;
  detail: string;
  /** What the base swing does before any roll. */
  meleeDamage: number;
  /** How far the base swing reaches before any roll. */
  meleeReach: number;
  color: string;
}>;

export type BlessId = "heavyStrike" | "explosiveBody" | "stormStone" | "lifesteal" | "hostageGuard";

export type BlessDefinition = Readonly<{
  id: BlessId;
  name: string;
  detail: string;
  color: string;
}>;

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

export function findModifier(catalog: GameCatalog, axis: ModifierAxis): ModifierDefinition | undefined {
  return catalog.modifierCatalog.find((candidate) => candidate.axis === axis);
}

/** What one stacking blessing on an axis is worth. The blessing award reads this and nothing else. */
export function blessingStep(catalog: GameCatalog, axis: ModifierAxis): number {
  return findModifier(catalog, axis)?.blessing ?? 0;
}

export function findCore(catalog: GameCatalog, id: CoreId): CoreDefinition | undefined {
  return catalog.coreCatalog.find((candidate) => candidate.id === id);
}

export function findBless(
  catalog: GameCatalog,
  id: BlessId | StackingBlessId,
): BlessDefinition | StackingBlessDefinition | undefined {
  return (
    catalog.blessCatalog.find((candidate) => candidate.id === id) ??
    catalog.blessStackingCatalog.find((candidate) => candidate.id === id)
  );
}

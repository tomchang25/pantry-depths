/**
 * The core rolls: the one random half of the modifier catalogue.
 *
 * The axes, bounds, and core catalogue arrive through the game catalog; what lives here is the draw
 * against them, which is run randomness.
 */

import type { GameCatalog } from "@/core/catalog";
import {
  CORE_ROLL_AXES,
  findModifier,
  type CoreCurse,
  type ModifierAxis,
  type ModifierRange,
  type ModifierRolls,
} from "@/core/progression-contract";

function roll(range: ModifierRange, precision: number): number {
  const raw = range.low + Math.random() * (range.high - range.low);
  const scale = 10 ** precision;
  return Math.round(raw * scale) / scale;
}

/** Rolls one core's modifiers. Called at resolution rather than at pickup, so a sealed reward is sealed. */
export function rollCoreModifiers(catalog: GameCatalog, curse: CoreCurse): ModifierRolls {
  const rolled: Partial<Record<ModifierAxis, number>> = {};

  for (const axis of CORE_ROLL_AXES) {
    const definition = findModifier(catalog, axis);

    if (definition) {
      rolled[axis] = roll(curse === "cursed" ? definition.cursed : definition.clean, definition.precision);
    }
  }

  return rolled;
}

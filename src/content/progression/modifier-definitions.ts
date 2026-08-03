/**
 * The one catalogue of numeric axes, and the four melee cores: authored rows behind
 * `@/core/progression-contract`.
 *
 * A clean range only ever improves the axis; a cursed range is the same axis widened at both ends —
 * better than clean at the top and worse than nothing at the bottom, which is what makes a curse a
 * curse. One catalogue is what stops a number existing as a blessing and not as a core roll, or
 * carrying different bounds in the two places. Both tables reach the rules through the game catalog.
 */

import type { CoreDefinition, ModifierDefinition } from "@/core/progression-contract";

export const MODIFIER_CATALOG: readonly ModifierDefinition[] = [
  {
    axis: "meleeDamage",
    name: "Melee damage",
    blessing: 6,
    clean: { low: 4, high: 14 },
    cursed: { low: -8, high: 22 },
    precision: 0,
  },
  {
    axis: "maxHp",
    name: "Maximum health",
    blessing: 25,
    clean: { low: 15, high: 50 },
    cursed: { low: -30, high: 85 },
    precision: 0,
  },
  {
    axis: "moveSpeed",
    name: "Movement speed",
    blessing: 0.3,
    clean: { low: 0.15, high: 0.6 },
    cursed: { low: -0.35, high: 1 },
    precision: 2,
  },
  {
    axis: "meleeReach",
    name: "Melee reach",
    blessing: 0.15,
    clean: { low: 0.08, high: 0.3 },
    cursed: { low: -0.18, high: 0.5 },
    precision: 2,
  },
] as const;

export const CORE_CATALOG: readonly CoreDefinition[] = [
  {
    id: "cleaver",
    name: "Cleaver",
    detail: "Even weight and even reach, and nothing to learn",
    meleeDamage: 25,
    meleeReach: 1.45,
    color: "#d8c69a",
  },
  {
    id: "mallet",
    name: "Mallet",
    detail: "Hits far harder and asks you to be closer",
    meleeDamage: 40,
    meleeReach: 1.15,
    color: "#c08a52",
  },
  {
    id: "skewer",
    name: "Skewer",
    detail: "Reaches across a doorway and barely dents anything",
    meleeDamage: 16,
    meleeReach: 2.2,
    color: "#cfd8e2",
  },
  {
    id: "ladle",
    name: "Ladle",
    detail: "An insult with a handle, and the widest rolls of the four",
    meleeDamage: 12,
    meleeReach: 1.6,
    color: "#e8a24c",
  },
] as const;

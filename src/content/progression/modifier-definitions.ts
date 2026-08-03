/**
 * The one catalogue of numeric axes, and its three consumers.
 *
 * A stacking blessing, a clean core's rolls, and a cursed core's rolls all draw from the table below.
 * One catalogue is what stops a number existing as a blessing and not as a core roll, or carrying
 * different bounds in the two places — and those two are the same mechanism wearing different clothes,
 * so a second definition of either would be a second definition of both.
 *
 * A clean range only ever improves the axis. A cursed range is the same axis widened at **both** ends:
 * better than clean at the top and worse than nothing at the bottom. A curse that can only improve an
 * item is not a curse, and once the range itself carries the risk there is no need for a separate
 * table of drawbacks.
 *
 * Thrown damage is deliberately not an axis. It is currently defined as melee damage rather than as a
 * value of its own, so it inherits every melee modifier for free — which is the behaviour wanted — and
 * separating it would collide head-on with a concurrent rewrite of the whole projectile path.
 *
 * The rolls themselves live with the run's other randomness in the demo half; this module owns the
 * axes, the bounds, and the core catalogue, and answers pure lookups against them.
 */

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

export function findModifier(axis: ModifierAxis): ModifierDefinition | undefined {
  return MODIFIER_CATALOG.find((candidate) => candidate.axis === axis);
}

/** What one stacking blessing on an axis is worth. The blessing catalogue reads this and nothing else. */
export function blessingStep(axis: ModifierAxis): number {
  return findModifier(axis)?.blessing ?? 0;
}

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

export function findCore(id: CoreId): CoreDefinition | undefined {
  return CORE_CATALOG.find((candidate) => candidate.id === id);
}

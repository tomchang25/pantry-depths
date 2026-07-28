/**
 * Blessings: the run's only permanent progression.
 *
 * Each one rewrites a rule rather than nudging a number, so the answer to "what does this run play
 * like" is the list you are holding. They are granted one at a time — from an altar, or from taking
 * the stairs down — and never chosen from a hand of three, because the point here is that the run
 * shapes itself and you adapt.
 */

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

/** Awarded in place of a sixth blessing once the catalogue runs out. */
export const OVERFLOW_MAX_HP = 25;

export type BlessState = {
  owned: BlessId[];
  /** Extra maximum health from blessings awarded after the catalogue was exhausted. */
  overflowMaxHp: number;
};

export function createBlessState(): BlessState {
  return { owned: [], overflowMaxHp: 0 };
}

export function hasBless(state: BlessState, id: BlessId): boolean {
  return state.owned.includes(id);
}

export function findBless(id: BlessId): BlessDefinition | undefined {
  return BLESS_CATALOG.find((candidate) => candidate.id === id);
}

/**
 * Grants one blessing not already held, or signals the overflow when every one is.
 *
 * Returns the definition awarded, or `undefined` when the caller should apply `OVERFLOW_MAX_HP`.
 */
export function grantBless(state: BlessState): BlessDefinition | undefined {
  const available = BLESS_CATALOG.filter((candidate) => !state.owned.includes(candidate.id));
  const granted = available[Math.floor(Math.random() * available.length)];

  if (!granted) {
    state.overflowMaxHp += OVERFLOW_MAX_HP;
    return undefined;
  }

  state.owned.push(granted.id);
  return granted;
}

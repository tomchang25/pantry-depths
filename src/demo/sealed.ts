/**
 * Sealed rewards: what a floor pays that the player cannot look at.
 *
 * A sealed reward knows only where it came from. What it *is* — a fragment or a weapon core, and what
 * that core rolled — is decided at extraction and nowhere earlier, so a run inspected halfway through
 * genuinely does not know what it is carrying. That is the entire mechanism: what the player walks out
 * with is a gamble whose stake rises with every floor they survive, and dying loses all of it.
 *
 * Two sources, told apart by risk rather than by rate; the rates themselves are authored content in
 * `@/content/progression/sealed-reward-definitions`. What stays here is the sealing, the resolution
 * rolls, and the bank — run state and run randomness.
 *
 * The bank at the bottom is the only thing in the demo that outlives a run. Extraction is what puts
 * something in it, which is what makes the extraction room worth finding on the first floor rather
 * than on the last.
 */

import {
  BLESS_CATALOG,
  BLESS_STACKING_CATALOG,
  type BlessId,
  type StackingBlessId,
} from "@/content/progression/bless-definitions";
import {
  CORE_CATALOG,
  findCore,
  type CoreCurse,
  type CoreDefinition,
  type ModifierAxis,
  type ModifierRolls,
} from "@/content/progression/modifier-definitions";
import { CORE_SHARE, FRAGMENT_EFFECTS } from "@/content/progression/sealed-reward-definitions";
import { rollCoreModifiers } from "@/demo/modifiers";

export type SealedReward = Readonly<{ source: CoreCurse }>;

export type ResolvedFragment = Readonly<{
  kind: "fragment";
  source: CoreCurse;
  effects: readonly (BlessId | StackingBlessId)[];
}>;

export type ResolvedCore = Readonly<{
  kind: "core";
  source: CoreCurse;
  core: CoreDefinition;
  rolls: ModifierRolls;
}>;

export type ResolvedReward = ResolvedFragment | ResolvedCore;

export function sealReward(source: CoreCurse): SealedReward {
  return { source };
}

function pick<T>(values: readonly T[]): T | undefined {
  return values[Math.floor(Math.random() * values.length)];
}

function rollFragment(source: CoreCurse): ResolvedFragment {
  const pool = [...BLESS_CATALOG.map((entry) => entry.id), ...BLESS_STACKING_CATALOG.map((entry) => entry.id)];
  const effects: (BlessId | StackingBlessId)[] = [];

  for (let index = 0; index < FRAGMENT_EFFECTS[source]; index += 1) {
    const drawn = pick(pool);

    if (drawn) {
      effects.push(drawn);
    }
  }

  return { kind: "fragment", source, effects };
}

function rollCore(source: CoreCurse): ResolvedCore {
  const core = pick(CORE_CATALOG) ?? CORE_CATALOG[0];

  if (!core) {
    throw new Error("the core catalogue is empty");
  }

  return { kind: "core", source, core, rolls: rollCoreModifiers(source) };
}

/** Opens one sealed reward. Called at extraction and never before it. */
export function resolveReward(reward: SealedReward): ResolvedReward {
  return Math.random() < CORE_SHARE[reward.source] ? rollCore(reward.source) : rollFragment(reward.source);
}

/**
 * Everything extracted so far, across every run this page has seen.
 *
 * Deliberately outside the world: a run is destroyed by death and rebuilt by restart, and the whole
 * point of extracting is that what came out survives both. Nothing persists it further — reloading is
 * a fresh cellar, which is honest about the demo not having a save.
 */
const bank: ResolvedReward[] = [];

export function bankReward(reward: ResolvedReward): void {
  bank.push(reward);
}

export function bankedRewards(): readonly ResolvedReward[] {
  return bank;
}

/**
 * The core a new run swings with: the last one extracted.
 *
 * No preparation screen exists to choose from the bank, so the most recent extraction is the choice.
 * That keeps a core a decision made before a run rather than during one, which is what a core is, and
 * it makes the rolls a run walked out with the rolls the next run has to live with.
 */
export function equippedCore(): ResolvedCore | undefined {
  for (let index = bank.length - 1; index >= 0; index -= 1) {
    const entry = bank[index];

    if (entry?.kind === "core") {
      return entry;
    }
  }

  return undefined;
}

/** What the equipped core adds to one axis, or nothing when no core has ever been carried out. */
export function coreBonus(axis: ModifierAxis): number {
  return equippedCore()?.rolls[axis] ?? 0;
}

/** The melee base the equipped core is, if there is one. */
export function coreBase(): CoreDefinition | undefined {
  const equipped = equippedCore();
  return equipped ? findCore(equipped.core.id) : undefined;
}

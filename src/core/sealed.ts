/**
 * Sealed rewards: what a floor pays that the player cannot look at.
 *
 * A sealed reward knows only where it came from. What it *is* — a fragment or a weapon core, and what
 * that core rolled — is decided at extraction and nowhere earlier, so a run inspected halfway through
 * genuinely does not know what it is carrying. That is the entire mechanism: what the player walks out
 * with is a gamble whose stake rises with every floor they survive, and dying loses all of it.
 *
 * Two sources, told apart by risk rather than by rate; the rates and catalogues arrive through the
 * game catalog. What lives here is the sealing, the resolution rolls, and the bank — run state and
 * run randomness.
 *
 * The bank at the bottom is the only thing in the demo that outlives a run. Extraction is what puts
 * something in it, which is what makes the extraction room worth finding on the first floor rather
 * than on the last.
 */

import type { GameCatalog } from "@/core/catalog";
import { rollCoreModifiers } from "@/core/modifiers";
import {
  findCore,
  type BlessId,
  type CoreCurse,
  type CoreDefinition,
  type ModifierAxis,
  type ModifierRolls,
  type StackingBlessId,
} from "@/core/progression-contract";

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

function rollFragment(catalog: GameCatalog, source: CoreCurse): ResolvedFragment {
  const pool = [
    ...catalog.blessCatalog.map((entry) => entry.id),
    ...catalog.blessStackingCatalog.map((entry) => entry.id),
  ];
  const effects: (BlessId | StackingBlessId)[] = [];

  for (let index = 0; index < catalog.fragmentEffects[source]; index += 1) {
    const drawn = pick(pool);

    if (drawn) {
      effects.push(drawn);
    }
  }

  return { kind: "fragment", source, effects };
}

function rollCore(catalog: GameCatalog, source: CoreCurse): ResolvedCore {
  const core = pick(catalog.coreCatalog) ?? catalog.coreCatalog[0];

  if (!core) {
    throw new Error("the core catalogue is empty");
  }

  return { kind: "core", source, core, rolls: rollCoreModifiers(catalog, source) };
}

/** Opens one sealed reward. Called at extraction and never before it. */
export function resolveReward(catalog: GameCatalog, reward: SealedReward): ResolvedReward {
  return Math.random() < catalog.coreShare[reward.source]
    ? rollCore(catalog, reward.source)
    : rollFragment(catalog, reward.source);
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
export function coreBase(catalog: GameCatalog): CoreDefinition | undefined {
  const equipped = equippedCore();
  return equipped ? findCore(catalog, equipped.core.id) : undefined;
}

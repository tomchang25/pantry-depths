/**
 * Sealed rewards: what a floor pays that the player cannot look at.
 *
 * A sealed reward knows only where it came from. What it *is* — a fragment or a weapon core, and what
 * that core rolled — is decided at extraction and nowhere earlier, so a run inspected halfway through
 * genuinely does not know what it is carrying. That is the entire mechanism: what the player walks out
 * with is a gamble whose stake rises with every floor they survive, and dying loses all of it.
 *
 * Two sources, told apart by risk rather than by rate. A clean reward comes from finishing a floor's
 * main task and leans towards fragments. A cursed one comes from smashing the altar, leans towards
 * cores, and rolls those cores over a range widened at both ends — better than clean at the top and
 * worse than nothing at the bottom.
 *
 * The bank at the bottom is the only thing in the demo that outlives a run. Extraction is what puts
 * something in it, which is what makes the extraction room worth finding on the first floor rather
 * than on the last.
 */

import { BLESS_CATALOG, BLESS_STACKING_CATALOG, type BlessId, type StackingBlessId } from "@/demo/bless";
import {
  CORE_CATALOG,
  findCore,
  findModifier,
  rollCoreModifiers,
  type CoreCurse,
  type CoreDefinition,
  type ModifierAxis,
  type ModifierRolls,
} from "@/demo/modifiers";

export type SealedReward = Readonly<{ source: CoreCurse }>;

/**
 * How often a sealed reward turns out to be a core rather than a fragment.
 *
 * The two sources differ here and in the width of what a core rolls, and in nothing else. Paying the
 * cursed altar at a higher *rate* would make it strictly better, which is not a curse.
 */
const CORE_SHARE: Readonly<Record<CoreCurse, number>> = { clean: 0.2, cursed: 0.6 };

/** Blessing effects one fragment carries. A cursed fragment carries more than a clean one. */
const FRAGMENT_EFFECTS: Readonly<Record<CoreCurse, number>> = { clean: 1, cursed: 2 };

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

/** How a resolved reward reads on the run-end screen, where its rolls are seen for the first time. */
export function describeReward(reward: ResolvedReward): string {
  if (reward.kind === "fragment") {
    return `${reward.source === "cursed" ? "Cursed" : "Clean"} fragment (${reward.effects.join(", ")})`;
  }

  const rolls = Object.entries(reward.rolls)
    .map(([axis, amount]) => {
      const definition = findModifier(axis as ModifierAxis);
      const sign = (amount ?? 0) >= 0 ? "+" : "";
      return `${definition?.name ?? axis} ${sign}${amount}`;
    })
    .join(", ");
  return `${reward.source === "cursed" ? "Cursed" : "Clean"} ${reward.core.name} core (${rolls})`;
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

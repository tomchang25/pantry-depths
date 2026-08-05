/**
 * What has been carried out, across every run this page has seen.
 *
 * The one piece of state in the rules layer that lives outside the run record, and it is deliberate: a
 * run is destroyed by death and rebuilt by restart, and the whole point of extracting is that what came
 * out survives both. Its lifetime is the page rather than the run, which is exactly why it cannot be a
 * field on the run.
 *
 * Nothing persists it further. Reloading is a fresh cellar, which is honest about there being no save.
 */

import type { ResolvedCore, ResolvedReward } from "@/core/progression/progression-contract";

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
 * That keeps a core a decision made before a run rather than during one, and it makes the rolls a run
 * walked out with the rolls the next run has to live with.
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

/**
 * What the last extraction opened, kept so the run-end screen can show it after the run is frozen.
 *
 * Its own slot rather than the tail of the bank, because the screen shows what this run carried out
 * and the bank holds everything every run did.
 */
let lastResolved: readonly ResolvedReward[] = [];

export function recordExtraction(rewards: readonly ResolvedReward[]): void {
  lastResolved = rewards;
}

export function lastExtractedRewards(): readonly ResolvedReward[] {
  return lastResolved;
}

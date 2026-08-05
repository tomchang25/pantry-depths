/**
 * Leaving, and what leaving is worth.
 *
 * The extraction room is open from the first second of every floor and marked on nothing, so leaving is
 * a continuous choice rather than a gate at the end, and knowing where to leave from is something the
 * floor charges time for. There is no lock on it and never will be — the lock is on the descent.
 *
 * Standing on its pad for five unbroken seconds ends the run and opens everything the run was carrying.
 * That is the only way anything reaches the bank; dying loses the lot, which is what makes the room
 * worth finding on the first floor rather than on the last.
 *
 * Five seconds rather than a step across a line, because walking out was the one irreversible thing on
 * the floor that could happen by accident. Damage does not interrupt it — at depth nothing that can be
 * interrupted can be finished — so the hold is broken by stepping off the pad and by nothing else.
 */

import { padRoomAt } from "@/core/floor/maze";

import { bankReward, resolveReward, type ResolvedReward } from "@/core/progression/sealed";
import { announce, raiseSfx } from "@/core/feedback/run-feedback";
import { endRun, type World } from "@/core/world/world";

/** Unbroken seconds on the pad that end the run. The same five the blessing altar asks for. */
export const EXTRACTION_HOLD_SECONDS = 5;

/**
 * How a sealed reward reaches the card on screen.
 *
 * Taking one used to be a line on the message line and nothing else — the same channel a reinforcement
 * crawling out uses — so the single thing a run is *for* arrived quieter than a slime did. A blessing
 * pops a card; the thing you are risking the run to carry out has more claim to one than that.
 */
export const SEALED_CARD_PREFIX = "sealed:";

/** What the last extraction opened, kept so the run-end screen can show it after the world is frozen. */
let lastResolved: readonly ResolvedReward[] = [];

export function takeSealed(world: World, source: "clean" | "cursed"): void {
  world.carried.push({ source });
  world.pendingCard = `${SEALED_CARD_PREFIX}${source}`;
  raiseSfx(world, "rewardGain");
  announce(world, `Sealed and ${source === "cursed" ? "cursed" : "clean"} - carry it out or lose it`, 3);
}

/** Whether the player is standing on the extraction pad this step. */
export function onExtractionPad(world: World): boolean {
  const room = padRoomAt(world.maze, Math.floor(world.player.x), Math.floor(world.player.y));
  return room?.role === "extraction";
}

function extract(world: World): void {
  const resolved = world.carried.map((reward) => resolveReward(world.catalog, reward));

  for (const reward of resolved) {
    bankReward(reward);
  }

  lastResolved = resolved;
  world.carried = [];
  endRun(world, "extracted");
  announce(world, "Out, with everything you were carrying", 6);
}

export function stepExtraction(world: World, seconds: number): void {
  const progress = world.maze.progress;

  if (!onExtractionPad(world)) {
    if (progress.extractionSeconds > 0) {
      announce(world, "You stepped off - the extraction canister settles", 2);
    }

    progress.extractionSeconds = 0;
    return;
  }

  progress.extractionSeconds += seconds;

  if (progress.extractionSeconds >= EXTRACTION_HOLD_SECONDS) {
    extract(world);
  }
}

/**
 * How much of the hold is done, from nothing to all of it. Read by the scene and by the HUD, so the
 * light, the ground, and the countdown are three views of one number rather than three timers.
 */
export function extractionShare(world: World): number {
  return Math.min(1, world.maze.progress.extractionSeconds / EXTRACTION_HOLD_SECONDS);
}

/**
 * What the last extraction opened, for the run-end screen to show after the world is frozen.
 *
 * An accessor rather than an export of the variable, because the display half that builds the
 * overlay lives outside core and reads this after the run has ended.
 */
export function lastExtractedRewards(): readonly ResolvedReward[] {
  return lastResolved;
}

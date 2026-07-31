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

import type { DemoHudOverlay, DemoHudOverlayReward } from "@/demo/demo-hud";
import { findBless } from "@/demo/bless";
import { padRoomAt } from "@/demo/maze";
import { bankReward, bankedRewards, resolveReward, type ResolvedReward } from "@/demo/sealed";
import { announce, endRun, runClockSeconds, type DemoWorld } from "@/demo/world";

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

export function takeSealed(world: DemoWorld, source: "clean" | "cursed"): void {
  world.carried.push({ source });
  world.pendingCard = `${SEALED_CARD_PREFIX}${source}`;
  announce(world, `Sealed and ${source === "cursed" ? "cursed" : "clean"} - carry it out or lose it`, 3);
}

/** Whether the player is standing on the extraction pad this step. */
export function onExtractionPad(world: DemoWorld): boolean {
  const room = padRoomAt(world.maze, Math.floor(world.player.x), Math.floor(world.player.y));
  return room?.role === "extraction";
}

function extract(world: DemoWorld): void {
  const resolved = world.carried.map((reward) => resolveReward(reward));

  for (const reward of resolved) {
    bankReward(reward);
  }

  lastResolved = resolved;
  world.carried = [];
  endRun(world, "extracted");
  announce(world, "Out, with everything you were carrying", 6);
}

export function stepExtraction(world: DemoWorld, seconds: number): void {
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
export function extractionShare(world: DemoWorld): number {
  return Math.min(1, world.maze.progress.extractionSeconds / EXTRACTION_HOLD_SECONDS);
}

/** One opened reward, as a row on the run-end screen. */
function rewardRow(reward: ResolvedReward): DemoHudOverlayReward {
  const cursed = reward.source === "cursed";

  if (reward.kind === "core") {
    const rolls = Object.entries(reward.rolls)
      .map(([axis, amount]) => `${axis === "maxHp" ? "HP" : "DMG"} ${(amount ?? 0) >= 0 ? "+" : ""}${amount}`)
      .join(" · ");
    return {
      color: reward.core.color,
      icon: reward.core.id,
      name: `${cursed ? "Cursed" : "Clean"} ${reward.core.name} core`,
      detail: rolls,
    };
  }

  const effects = reward.effects.map((id) => findBless(id)?.name ?? id);
  return {
    color: cursed ? "#e2585f" : "#9fe0d0",
    icon: "seal",
    name: `${cursed ? "Cursed" : "Clean"} fragment`,
    detail: effects.join(" · "),
  };
}

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * The screen a run ends on, either way it ended.
 *
 * Both endings live here rather than beside the frame loop, because what separates them is what the run
 * kept: extraction lists everything it opened, one row per thing with what it rolled, and death lists
 * only how much went down with you — a run that died never learns what it was carrying, which is the
 * whole of why walking out early is a decision.
 */
export function runEndOverlay(world: DemoWorld): DemoHudOverlay {
  const stats = [
    { label: "Floor", value: `B${world.depth}` },
    { label: "Time", value: clock(runClockSeconds(world)) },
    { label: "Killed", value: String(world.kills) },
    { label: "Blessings", value: String(world.bless.owned.length) },
  ];

  if (world.status === "extracted") {
    return {
      kind: "ended",
      title: "Out",
      tone: "out",
      stats,
      rewardsTitle: lastResolved.length > 0 ? "Opened on the way out" : "You walked out with nothing sealed",
      rewards: lastResolved.map((reward) => rewardRow(reward)),
      footer: `${bankedRewards().length} in the bank · press R to run again`,
    };
  }

  const lost = world.carried.length;
  return {
    kind: "ended",
    title: "Eaten",
    tone: "lost",
    stats,
    rewardsTitle:
      lost > 0
        ? `${lost} sealed ${lost === 1 ? "reward" : "rewards"} went down with you, unopened`
        : "You were carrying nothing sealed",
    rewards: [],
    footer: `${bankedRewards().length} in the bank · press R to run again`,
  };
}

/**
 * Leaving, and what leaving is worth.
 *
 * The extraction room is open from the first second of every floor and marked on nothing, so leaving is
 * a continuous choice rather than a gate at the end, and knowing where to leave from is something the
 * floor charges time for. There is no lock on it and never will be — the lock is on the descent.
 *
 * Walking into it ends the run and opens everything the run was carrying. That is the only way anything
 * reaches the bank; dying loses the lot, which is what makes the room worth finding on the first floor
 * rather than on the last.
 */

import type { DemoHudModel } from "@/demo/demo-hud";
import { bankReward, describeReward, resolveReward, type ResolvedReward } from "@/demo/sealed";
import { announce, type DemoWorld } from "@/demo/world";

/** The same shape as the descent's, so the two ways off a floor feel like the same verb. */
const EXTRACTION_RADIUS = 0.55;

/** What the last extraction opened, kept so the run-end screen can show it after the world is frozen. */
let lastResolved: readonly ResolvedReward[] = [];

export function takeSealed(world: DemoWorld, source: "clean" | "cursed"): void {
  world.carried.push({ source });
  announce(
    world,
    `Something sealed, and ${source === "cursed" ? "cursed" : "clean"} - you will not know what until you are out`,
    3,
  );
}

function extract(world: DemoWorld): void {
  const resolved = world.carried.map((reward) => resolveReward(reward));

  for (const reward of resolved) {
    bankReward(reward);
  }

  lastResolved = resolved;
  world.carried = [];
  world.status = "extracted";
  announce(world, "Out, with everything you were carrying", 6);
}

export function stepExtraction(world: DemoWorld): void {
  const away = Math.hypot(
    world.player.x - (world.maze.extraction.x + 0.5),
    world.player.y - (world.maze.extraction.y + 0.5),
  );

  if (away < EXTRACTION_RADIUS) {
    extract(world);
  }
}

/**
 * The screen a run ends on, either way it ended.
 *
 * Both endings live here rather than beside the frame loop, because what separates them is what the run
 * kept: extraction lists everything it opened, and death lists what it lost without saying what it was.
 */
export function runEndOverlay(world: DemoWorld): DemoHudModel["overlay"] {
  const reached = `Reached floor B${world.depth}, killed ${world.kills}, carried ${world.bless.owned.length} blessings.`;

  if (world.status === "extracted") {
    const opened =
      lastResolved.length > 0 ? lastResolved.map((reward) => describeReward(reward)).join(" · ") : "nothing";
    return { title: "Out", body: `${reached} Opened: ${opened}. Press R to run again.` };
  }

  const lost = world.carried.length;
  return {
    title: "Eaten",
    body: `${reached} ${lost > 0 ? `${lost} sealed rewards went down with you.` : "You were carrying nothing sealed."} Press R to run again.`,
  };
}

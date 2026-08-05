/**
 * How a run ends, and how long it lasted.
 *
 * One door out of `playing`, so the clock and any pad cannot be released by only one exit.
 */

import { raiseSfx } from "@/core/feedback/run-feedback";
import type { World } from "@/core/world/world";
/** Ends the run. One door out of `playing`, so the clock and any pad cannot be released by only one exit. */
export function endRun(world: World, status: "dead" | "extracted"): void {
  if (status === "dead") {
    raiseSfx(world, "playerDeath");
  }

  world.status = status;
  world.finishedSeconds = world.elapsedSeconds;
  world.soakSeconds = 0;
}

/** How long the run has been going, which stops counting when the run does. */
export function runClockSeconds(world: World): number {
  return world.finishedSeconds ?? world.elapsedSeconds;
}

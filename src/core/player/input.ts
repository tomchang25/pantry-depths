/**
 * The two buttons, and what each press commits to.
 *
 * The whole of the input model lives here: which verb a press resolves to, how long the arm is held,
 * and the gate that ignores a press during a swing. What each verb then does belongs to its own module.
 */

import { chooseMeleeAttackId } from "@/core/combat/melee-contract";
import { raiseSfx } from "@/core/feedback/run-feedback";
import { executeMelee } from "@/core/player/melee/execute-melee";
import { shootHeld, throwHeld } from "@/core/player/throw";
import { propBehaviour } from "@/core/prop-contract";
import { SWING_SECONDS, THROW_SWING_SECONDS, type World } from "@/core/world/world";
/**
 * Left button: one of the eight cuts, or a throw of whatever is in the hand.
 *
 * A press during a swing is ignored outright — not queued, not buffered. That is the prototype's own
 * rule and it is the whole of the input model: there is no chain to be early for, so a dropped press
 * costs the player nothing but the swing they were already watching. What it buys is that a swing is
 * one hit. Mashing used to be a whole extra hit per click, which made the animation decoration over
 * damage that had already been dealt.
 */
export function primaryAction(world: World): void {
  if (world.status !== "playing" || world.swing > 0) {
    return;
  }

  world.swingTarget = undefined;

  if (world.held) {
    world.swingKind = "throw";
    world.swing = THROW_SWING_SECONDS;
    world.swingTotal = THROW_SWING_SECONDS;
    // A throw is over the moment the hand opens; there is no blade travelling anywhere to wait for.
    world.swingResolved = true;

    // A shooter keeps what it is holding and sends something else. Everything else opens the hand.
    if (world.held.kind === "prop" && propBehaviour(world.catalog, world.held.prop).use === "shoot") {
      shootHeld(world);
      return;
    }

    throwHeld(world);
    return;
  }

  // Never the cut just played, so consecutive swings always differ — the one repetition the eye
  // catches when there is no chain to give the sequence a shape.
  world.swingKind = chooseMeleeAttackId(world.swingKind === "throw" ? undefined : world.swingKind);
  // On the press rather than on the hit, because the whoosh is the arm moving and that starts now.
  raiseSfx(world, "meleeSwing");
  world.swing = SWING_SECONDS;
  world.swingTotal = SWING_SECONDS;
  world.swingResolved = false;
}

/** The blade arrives. What it lands on is decided by the attack slice; this is only the gate. */
export function resolveSwing(world: World): void {
  if (world.status !== "playing") {
    return;
  }

  executeMelee(world);
}

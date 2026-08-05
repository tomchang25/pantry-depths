/**
 * The single writer for player health, and the one door out of a run that a hit can open.
 *
 * It lived inside enemy behaviour, which made the module that decides what one enemy does also the
 * module that owned the hit flash, the carried-enemy rule, the cheat gate and the end of the run.
 * Every route that hurts the player — a cut, a shot, a charge, a shell — arrives here instead.
 *
 * A hit the carried enemy absorbs is enemy damage, so that half is composed from the enemy owner
 * through a returned outcome. What stays here is the hand: this module puts the salvage in it.
 */

import { endRun } from "@/core/world/run-transition";
import { damageHeldHostage } from "@/core/damage/enemy-damage";
import { announce, markDamageFrom, raiseSfx } from "@/core/feedback/run-feedback";
import { hasBless } from "@/core/progression/bless";
import { type World } from "@/core/world/world";

/**
 * Applies damage to the player, letting the carried enemy take a frontal hit when that blessing is
 * held. The direction is optional because not every source has one; a flat hit still marks and flashes.
 */
export function hurtPlayer(world: World, amount: number, fromX?: number, fromY?: number): void {
  world.hitFlash = 1;
  // Flat rather than positional: this happened to the player, not somewhere across the room.
  raiseSfx(world, "playerHurt");

  // Above the two exits below, so a hit the carried enemy takes and one god mode absorbs both leave a mark.
  if (fromX !== undefined && fromY !== undefined) {
    markDamageFrom(world, amount, fromX, fromY);
  }

  const hostage = world.held?.kind === "enemy" ? world.held.enemy : undefined;
  const frontal =
    fromX === undefined || fromY === undefined
      ? true
      : (fromX - world.player.x) * Math.cos(world.player.angle) +
          (fromY - world.player.y) * Math.sin(world.player.angle) >
        0;

  if (hostage && frontal && hasBless(world.bless, "hostageGuard")) {
    const outcome = damageHeldHostage(world, hostage, amount);

    if (outcome.kind === "killed") {
      const salvage = outcome.salvage;
      world.held = { kind: "prop", prop: salvage, count: 1 };
      announce(
        world,
        `The hostage burst — left holding ${salvage === "stick" ? "a stake" : salvage === "rock" ? "a rock" : "a bomb"}`,
      );
    }

    return;
  }

  // The only place the player loses points, so one gate is the whole cheat and the hit still reads.
  if (world.godMode) {
    return;
  }

  world.player.hp -= amount;

  if (world.player.hp <= 0) {
    world.player.hp = 0;
    endRun(world, "dead");
  }
}

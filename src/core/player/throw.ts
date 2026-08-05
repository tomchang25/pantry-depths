/**
 * Throwing and shooting: what leaves the hand, and what is left in it.
 */

import { burst } from "@/core/combat/particles";
import { announce } from "@/core/feedback/run-feedback";
import { spawnProjectile } from "@/core/projectile/spawn";
import { propBehaviour } from "@/core/prop-contract";
import type { PropKind } from "@/core/prop-kinds";
import type { World } from "@/core/world/world";

const THROW_CALLS: Readonly<Record<PropKind, string>> = {
  stick: "Stake away!",
  rock: "Rock away!",
  bomb: "Bomb away!",
  hammer: "Hammer away!",
  skeletonSword: "Sword away!",
  skeletonSkull: "Skull away!",
  skeletonFemur: "Bone away!",
  skeletonFemurCracked: "Last of the bone!",
  skeletonJavelin: "Javelin away!",
  skeletonJavelinCracked: "Last of the shaft!",
  crossbow: "Bolt away!",
  crossbowSpent: "Threw the stock!",
  crossbowBolt: "Bolt away!",
};
export function throwHeld(world: World): void {
  const held = world.held;

  if (!held) {
    return;
  }

  if (held.kind === "enemy") {
    world.held = undefined;
    spawnProjectile(world, "enemy", held.enemy);
    announce(world, "Threw the enemy!");
    return;
  }

  // One use off the stack, not the whole hand. The hand only empties on the last one.
  const left = held.count - 1;
  world.held = left > 0 ? { kind: "prop", prop: held.prop, count: left } : undefined;
  spawnProjectile(world, held.prop, undefined);
  announce(world, left > 0 ? `${THROW_CALLS[held.prop]} (${left} left)` : THROW_CALLS[held.prop]);
}

/**
 * Pulling a trigger rather than opening a hand.
 *
 * What leaves is a bolt; what stays is the crossbow, one use lighter. When the last use goes the stock
 * remains in the hand as its own throwable, so the weapon ends by being flung at somebody rather than
 * by quietly disappearing — the same "spend the last of it" shape the femur has, arrived at from the
 * other direction.
 *
 * A shot is not a throw and must not read as one: it keeps the arm's dip so the press has weight, but
 * the object stays put, so nothing is handed to the viewmodel to animate leaving.
 */
export function shootHeld(world: World): void {
  const held = world.held;

  if (!held || held.kind !== "prop") {
    return;
  }

  const behaviour = propBehaviour(world.catalog, held.prop);
  const left = held.count - 1;
  world.held =
    left > 0
      ? { kind: "prop", prop: held.prop, count: left }
      : behaviour.spends
        ? { kind: "prop", prop: behaviour.spends, count: 1 }
        : undefined;
  spawnProjectile(world, "crossbowBolt", undefined);
  burst(world.particles, "ember", world.player.x, world.player.y, 0.5, 4, {
    speed: 2.2,
    spreadZ: 1.2,
    size: 0.035,
    life: 0.22,
  });
  announce(world, left > 0 ? `Bolt away! (${left} left)` : "Last bolt — only the stock now");
}

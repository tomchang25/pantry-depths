/**
 * What the side rooms do.
 *
 * Three of a floor's four rooms carry its optional business, and they are told apart by what they ask
 * of the player rather than by a label. The cursed altar asks to be smashed, and needs nothing here —
 * it is the plinth the floor has always had, now standing in a room of its own. The blessing altar
 * asks to be held: five unbroken seconds on its dais, which damage does not interrupt and only
 * leaving cancels, so it is a fight won by clearing the room rather than by not being hit. The hot
 * spring asks for nothing and pays while you stand in it.
 *
 * Held rather than channelled-and-cancelled on damage, because at depth bodies arrive faster than a
 * five-second channel runs, and a claim that cannot be completed at depth is not a reward.
 *
 * Both work off the room's pad rather than its floor — the three cells around the fixture, which is
 * what the fixture is now built across. A room five cells wide whose business ran to the walls made
 * the thing in the middle of it scenery: the blessing could be claimed from a doorway and the spring
 * healed you anywhere inside. `padRoomAt` owns that extent and the scene draws the same one.
 *
 * The two rooms this file adds are announced and thrown off in embers and steam rather than built,
 * because what stands on a floor is drawn by a module a concurrent rewrite owns.
 */

import { padRoomAt, type DemoRoom } from "@/demo/maze";
import { burst } from "@/demo/particles";
import { announce, awardBless, type DemoWorld } from "@/demo/world";

/** Unbroken seconds on the dais that claim the blessing. */
export const BLESSING_HOLD_SECONDS = 5;

/** Health the spring gives back per second to whoever is standing on it. */
export const HOT_SPRING_HEAL_PER_SECOND = 10;

/** Roughly per second, so a room throws off a steady trickle instead of a plume per frame. */
function trickle(seconds: number, rate: number): boolean {
  return Math.random() < seconds * rate;
}

function soakInSpring(world: DemoWorld, room: DemoRoom, seconds: number): void {
  world.soakSeconds += seconds;

  if (trickle(seconds, 16)) {
    burst(world.particles, "dust", room.center.x + 0.5, room.center.y + 0.5, 0.2, 2, {
      speed: 0.5,
      spreadZ: 1.5,
      gravity: -0.4,
      size: 0.14,
      life: 1.6,
    });
  }

  if (world.player.hp >= world.player.maxHp) {
    return;
  }

  world.player.hp = Math.min(world.player.maxHp, world.player.hp + HOT_SPRING_HEAL_PER_SECOND * seconds);
}

function holdBlessingAltar(world: DemoWorld, room: DemoRoom | undefined, seconds: number): void {
  const progress = world.maze.progress;

  if (progress.blessingTaken || room?.role !== "blessingAltar") {
    // A claim that landed leaves the counter full, and clearing it is not a cancellation — so the
    // spent altar zeroes silently and only an interrupted hold says anything.
    if (progress.heldSeconds > 0 && !progress.blessingTaken) {
      announce(world, "You stepped off the dais - the light goes out", 2);
    }

    progress.heldSeconds = 0;
    return;
  }

  progress.heldSeconds += seconds;

  if (trickle(seconds, 22)) {
    burst(world.particles, "ember", room.center.x + 0.5, room.center.y + 0.5, 0.35, 2, {
      speed: 1.1,
      spreadZ: 2.4,
      gravity: -0.9,
      size: 0.07,
      life: 1.1,
    });
  }

  // How far along the hold is belongs to the countdown bar the pad puts on screen, not to the message
  // line: told there it overwrote everything else the floor had to say, twice a second, for five
  // seconds. What stays here is the moment it lands.
  if (progress.heldSeconds < BLESSING_HOLD_SECONDS) {
    return;
  }

  progress.blessingTaken = true;
  burst(world.particles, "ember", room.center.x + 0.5, room.center.y + 0.5, 0.5, 30, {
    speed: 3.2,
    spreadZ: 3.4,
    gravity: -1.4,
    size: 0.09,
    life: 1.4,
  });
  awardBless(world);
}

/**
 * One pass over whichever pad the player is standing on.
 *
 * Cheap enough to run every frame and deliberately stateless apart from the floor's own progress, so
 * a room's business cannot be half-finished across a descent.
 */
export function stepRooms(world: DemoWorld, seconds: number): void {
  const room = padRoomAt(world.maze, Math.floor(world.player.x), Math.floor(world.player.y));

  if (room?.role === "hotSpring") {
    soakInSpring(world, room, seconds);
  } else {
    world.soakSeconds = 0;
  }

  holdBlessingAltar(world, room, seconds);
}

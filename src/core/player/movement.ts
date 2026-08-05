/**
 * The player moving, and what slows them down.
 *
 * Two costs that multiply: what they are carrying, and what they are wading through. Both are pace
 * penalties rather than shoves — two forces arguing every frame produce twitching in place rather than
 * a crowd in the way, and the player still goes exactly where they pointed.
 */

import { heldWeight, playerSpeed } from "@/core/player/stats";
import { slideMove, unstick, WALKING } from "@/core/floor/movement";
import { bodyFootprint, PLAYER_RADIUS, type World } from "@/core/world/world";

/**
 * The slowest a crowd may leave the player. A crowd costs time, never control. Set below the hardest
 * single enemy rather than at it, so an authored value is never silently clipped to this one.
 */
const MIN_CROWD_PACE = 0.25;

export type PlayerInput = Readonly<{
  forward: boolean;
  backward: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
}>;
/**
 * What wading through enemies costs the player, as a fraction of pace. A slowdown rather than a
 * shove: two forces arguing every frame produce twitching in place rather than a crowd in the way.
 * It bites only inside the drawn footprint, and enemies hold station short of that, so standing among
 * a crowd is free and pushing into one is not.
 */
export function crowdPace(world: World): number {
  let drag = 0;

  for (const enemy of world.enemies) {
    const bodyDrag = enemy.archetype.drag;

    if (bodyDrag === undefined || enemy.drowningSeconds > 0) {
      continue;
    }

    const distance = Math.hypot(world.player.x - enemy.x, world.player.y - enemy.y);
    const contact = PLAYER_RADIUS + bodyFootprint(enemy.archetype);

    if (distance >= contact) {
      continue;
    }

    drag += bodyDrag * (1 - distance / contact);
  }

  return Math.max(MIN_CROWD_PACE, 1 - drag);
}

export function stepPlayer(world: World, input: PlayerInput, deltaSeconds: number): void {
  const forwardX = Math.cos(world.player.angle);
  const forwardY = Math.sin(world.player.angle);
  let moveX = 0;
  let moveY = 0;

  if (input.forward) {
    moveX += forwardX;
    moveY += forwardY;
  }

  if (input.backward) {
    moveX -= forwardX;
    moveY -= forwardY;
  }

  if (input.strafeRight) {
    moveX += -forwardY;
    moveY += forwardX;
  }

  if (input.strafeLeft) {
    moveX -= -forwardY;
    moveY -= forwardX;
  }

  const length = Math.hypot(moveX, moveY);

  if (length > 0.0001) {
    // Carrying and wading both cost pace, and the two multiply.
    const carried = heldWeight(world, world.held)?.carrySlow ?? 1;
    const step = (playerSpeed(world) * carried * crowdPace(world) * deltaSeconds) / length;
    const moved = slideMove(world.maze, world.player, moveX * step, moveY * step, PLAYER_RADIUS, WALKING);
    world.player.x = moved.x;
    world.player.y = moved.y;
    world.walkBob = Math.min(1, world.walkBob + deltaSeconds * 5);
  } else {
    world.walkBob = Math.max(0, world.walkBob - deltaSeconds * 4);
  }

  if (world.player.pushX !== 0 || world.player.pushY !== 0) {
    const shoved = slideMove(
      world.maze,
      world.player,
      world.player.pushX * deltaSeconds,
      world.player.pushY * deltaSeconds,
      PLAYER_RADIUS,
      WALKING,
    );
    world.player.x = shoved.x;
    world.player.y = shoved.y;
    const decay = Math.exp(-7 * deltaSeconds);
    world.player.pushX *= decay;
    world.player.pushY *= decay;

    if (Math.hypot(world.player.pushX, world.player.pushY) < 0.05) {
      world.player.pushX = 0;
      world.player.pushY = 0;
    }
  }

  const settled = unstick(world.maze, world.player, PLAYER_RADIUS, WALKING);
  world.player.x = settled.x;
  world.player.y = settled.y;
}

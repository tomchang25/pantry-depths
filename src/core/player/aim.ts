/**
 * Where the player is pointed, and what that puts in front of them.
 *
 * Shared by the verbs that need a direction — throwing, which departs along it, and grabbing, which
 * reaches along it. The attack slice keeps its own copies inside its fence, because a resolver may not
 * import a module that names the run state.
 */

import type { World } from "@/core/world/world";

export function facing(world: World): Readonly<{ x: number; y: number }> {
  return { x: Math.cos(world.player.angle), y: Math.sin(world.player.angle) };
}

/** Whether a point is inside the given reach and roughly ahead of the player, and how far off it is. */
export function inFront(world: World, x: number, y: number, reach: number, arc: number): number | undefined {
  const toX = x - world.player.x;
  const toY = y - world.player.y;
  const distance = Math.hypot(toX, toY);

  if (distance > reach || distance < 0.0001) {
    return undefined;
  }

  const direction = facing(world);

  return (toX / distance) * direction.x + (toY / distance) * direction.y >= arc ? distance : undefined;
}

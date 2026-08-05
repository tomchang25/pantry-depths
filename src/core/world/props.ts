/**
 * Putting a loose pickup on the floor.
 *
 * Under the world tree rather than beside the floor: the floor tree stays queries and geometry so the
 * fenced decision modules may keep importing it, and this writes.
 */

import { blocksWalk } from "@/core/floor/maze";
import type { PropKind } from "@/core/prop-kinds";
import { nextId } from "@/core/world/ids";
import type { World } from "@/core/world/world";
/**
 * Puts one loose prop on the floor, at the point asked for or the nearest side that is not masonry.
 * A throw ends inside the cell it struck, so a surviving prop is nudged back out to stay retrievable.
 */
export function dropProp(world: World, kind: PropKind, x: number, y: number, count = 1): void {
  let placedX = x;
  let placedY = y;

  if (blocksWalk(world.maze, Math.floor(x), Math.floor(y))) {
    for (const offset of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const candidateX = x + Math.cos(offset) * 0.55;
      const candidateY = y + Math.sin(offset) * 0.55;

      if (!blocksWalk(world.maze, Math.floor(candidateX), Math.floor(candidateY))) {
        placedX = candidateX;
        placedY = candidateY;
        break;
      }
    }
  }

  world.props.push({ id: nextId(world, "prop"), kind, count, x: placedX, y: placedY });
}

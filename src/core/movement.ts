/**
 * Continuous movement against the grid.
 *
 * Axis-separated resolution, which is what gives the wall-slide: a diagonal that fails on one axis
 * still takes the other. Nothing here knows what a turn is.
 *
 * Every function takes the blocking predicate rather than assuming one, because the demo has two:
 * walking stops at water, being flung does not. That single distinction is what makes a pool a
 * hazard instead of scenery.
 */

import { blocksFlung, blocksWalk, type Maze } from "@/core/maze";

export type Point = Readonly<{ x: number; y: number }>;
export type Blocker = (maze: Maze, x: number, y: number) => boolean;

export const WALKING: Blocker = blocksWalk;
export const FLUNG: Blocker = blocksFlung;

function overlapsBlocked(maze: Maze, x: number, y: number, radius: number, blocked: Blocker): boolean {
  const minX = Math.floor(x - radius);
  const maxX = Math.floor(x + radius);
  const minY = Math.floor(y - radius);
  const maxY = Math.floor(y + radius);

  for (let cellY = minY; cellY <= maxY; cellY += 1) {
    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      if (!blocked(maze, cellX, cellY)) {
        continue;
      }

      const nearestX = Math.max(cellX, Math.min(x, cellX + 1));
      const nearestY = Math.max(cellY, Math.min(y, cellY + 1));

      if (Math.hypot(x - nearestX, y - nearestY) < radius) {
        return true;
      }
    }
  }

  return false;
}

export function slideMove(
  maze: Maze,
  from: Point,
  deltaX: number,
  deltaY: number,
  radius: number,
  blocked: Blocker = WALKING,
): Point {
  let { x, y } = from;

  if (deltaX !== 0 && !overlapsBlocked(maze, x + deltaX, y, radius, blocked)) {
    x += deltaX;
  }

  if (deltaY !== 0 && !overlapsBlocked(maze, x, y + deltaY, radius, blocked)) {
    y += deltaY;
  }

  return { x, y };
}

/** Nudges a body out of geometry it is already inside, which happens when a wall closes on it. */
export function unstick(maze: Maze, point: Point, radius: number, blocked: Blocker = WALKING): Point {
  if (!overlapsBlocked(maze, point.x, point.y, radius, blocked)) {
    return point;
  }

  const centreX = Math.floor(point.x) + 0.5;
  const centreY = Math.floor(point.y) + 0.5;

  if (!blocked(maze, Math.floor(point.x), Math.floor(point.y))) {
    return { x: centreX, y: centreY };
  }

  for (const step of [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]) {
    const cellX = Math.floor(point.x) + step.x;
    const cellY = Math.floor(point.y) + step.y;

    if (!blocked(maze, cellX, cellY)) {
      return { x: cellX + 0.5, y: cellY + 0.5 };
    }
  }

  return point;
}

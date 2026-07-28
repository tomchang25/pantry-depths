/**
 * Demo maze generation.
 *
 * Twenty-one cells square. The outer ring is indestructible brick; everything inside is carved by a
 * recursive backtracker and then perforated so the result reads as a dungeon rather than a puzzle.
 * Entrance and exit are drawn uniformly from the open cells with no reachability check at all — a
 * sealed exit is a legal maze here, on purpose.
 */

export const DEMO_GRID_SIZE = 21;

export type DemoTileKind = "open" | "border" | "stone" | "wood";

export type DemoCell = Readonly<{ x: number; y: number }>;

export type DemoTile = {
  kind: DemoTileKind;
  /** Remaining hits. Stone starts at 4, wood at 2, border is unbreakable and stays at Infinity. */
  hp: number;
  maxHp: number;
};

export type DemoMaze = Readonly<{
  size: number;
  tiles: DemoTile[];
  entrance: DemoCell;
  exit: DemoCell;
}>;

/**
 * Wall hit points, in the same unit every attack spends.
 *
 * One bare swing costs 1, so a stone wall is still four swings and a wood wall still two. A thrown
 * object costs 2, which breaks wood outright and stone in a pair; a thrown boulder costs 4, which
 * breaks either in one. The numbers are chosen so those three statements are all true at once.
 */
export const STONE_WALL_HP = 4;
export const WOOD_WALL_HP = 2;

/** Fraction of surviving interior walls knocked out after carving, to make loops and small rooms. */
const PERFORATION_CHANCE = 0.16;
const WOOD_SHARE = 0.42;

export function tileIndex(x: number, y: number): number {
  return y * DEMO_GRID_SIZE + x;
}

export function isInsideGrid(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < DEMO_GRID_SIZE && y < DEMO_GRID_SIZE;
}

function pick<T>(values: readonly T[]): T | undefined {
  return values[Math.floor(Math.random() * values.length)];
}

function shuffled<T>(values: readonly T[]): T[] {
  const copy = [...values];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const left = copy[index] as T;
    const right = copy[swap] as T;
    copy[index] = right;
    copy[swap] = left;
  }

  return copy;
}

function carve(solid: boolean[]): void {
  const start: DemoCell = { x: 1, y: 1 };
  const stack: DemoCell[] = [start];
  solid[tileIndex(start.x, start.y)] = false;

  while (stack.length > 0) {
    const current = stack[stack.length - 1] as DemoCell;
    const steps = shuffled([
      { x: 2, y: 0 },
      { x: -2, y: 0 },
      { x: 0, y: 2 },
      { x: 0, y: -2 },
    ]);
    let advanced = false;

    for (const step of steps) {
      const nextX = current.x + step.x;
      const nextY = current.y + step.y;

      if (nextX < 1 || nextY < 1 || nextX > DEMO_GRID_SIZE - 2 || nextY > DEMO_GRID_SIZE - 2) {
        continue;
      }

      if (!solid[tileIndex(nextX, nextY)]) {
        continue;
      }

      solid[tileIndex(nextX, nextY)] = false;
      solid[tileIndex(current.x + step.x / 2, current.y + step.y / 2)] = false;
      stack.push({ x: nextX, y: nextY });
      advanced = true;
      break;
    }

    if (!advanced) {
      stack.pop();
    }
  }
}

export function generateDemoMaze(): DemoMaze {
  const solid: boolean[] = Array.from({ length: DEMO_GRID_SIZE * DEMO_GRID_SIZE }, () => true);
  carve(solid);

  for (let y = 1; y < DEMO_GRID_SIZE - 1; y += 1) {
    for (let x = 1; x < DEMO_GRID_SIZE - 1; x += 1) {
      if (solid[tileIndex(x, y)] && Math.random() < PERFORATION_CHANCE) {
        solid[tileIndex(x, y)] = false;
      }
    }
  }

  const tiles: DemoTile[] = [];

  for (let y = 0; y < DEMO_GRID_SIZE; y += 1) {
    for (let x = 0; x < DEMO_GRID_SIZE; x += 1) {
      const onBorder = x === 0 || y === 0 || x === DEMO_GRID_SIZE - 1 || y === DEMO_GRID_SIZE - 1;

      if (onBorder) {
        tiles.push({ kind: "border", hp: Number.POSITIVE_INFINITY, maxHp: Number.POSITIVE_INFINITY });
        continue;
      }

      if (!solid[tileIndex(x, y)]) {
        tiles.push({ kind: "open", hp: 0, maxHp: 0 });
        continue;
      }

      const wood = Math.random() < WOOD_SHARE;
      tiles.push(
        wood
          ? { kind: "wood", hp: WOOD_WALL_HP, maxHp: WOOD_WALL_HP }
          : { kind: "stone", hp: STONE_WALL_HP, maxHp: STONE_WALL_HP },
      );
    }
  }

  const open: DemoCell[] = [];

  for (let y = 1; y < DEMO_GRID_SIZE - 1; y += 1) {
    for (let x = 1; x < DEMO_GRID_SIZE - 1; x += 1) {
      if (tiles[tileIndex(x, y)]?.kind === "open") {
        open.push({ x, y });
      }
    }
  }

  const entrance = pick(open) ?? { x: 1, y: 1 };
  const exit = pick(open.filter((cell) => cell.x !== entrance.x || cell.y !== entrance.y)) ?? { x: 19, y: 19 };
  return { size: DEMO_GRID_SIZE, tiles, entrance, exit };
}

export function tileAt(maze: DemoMaze, x: number, y: number): DemoTile | undefined {
  return isInsideGrid(x, y) ? maze.tiles[tileIndex(x, y)] : undefined;
}

/** Whether a grid cell blocks movement and sight. Rubble left behind by a broken wall does not. */
export function isSolidCell(maze: DemoMaze, x: number, y: number): boolean {
  const tile = tileAt(maze, x, y);
  return tile === undefined || tile.kind !== "open";
}

/** Open cells reachable from a start cell, ignoring destructibility. Used only by enemy pathing. */
export function breadthFirstStep(maze: DemoMaze, from: DemoCell, to: DemoCell): DemoCell | undefined {
  if (from.x === to.x && from.y === to.y) {
    return undefined;
  }

  const cameFrom = new Map<number, number>();
  const queue: number[] = [tileIndex(from.x, from.y)];
  const goal = tileIndex(to.x, to.y);
  const seen = new Set<number>(queue);
  let found = false;

  while (queue.length > 0 && !found) {
    const current = queue.shift() as number;
    const currentX = current % DEMO_GRID_SIZE;
    const currentY = Math.floor(current / DEMO_GRID_SIZE);

    for (const step of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const nextX = currentX + step.x;
      const nextY = currentY + step.y;

      if (!isInsideGrid(nextX, nextY) || isSolidCell(maze, nextX, nextY)) {
        continue;
      }

      const next = tileIndex(nextX, nextY);

      if (seen.has(next)) {
        continue;
      }

      seen.add(next);
      cameFrom.set(next, current);

      if (next === goal) {
        found = true;
        break;
      }

      queue.push(next);
    }
  }

  if (!found) {
    return undefined;
  }

  let cursor = goal;

  while (cameFrom.get(cursor) !== undefined && cameFrom.get(cursor) !== tileIndex(from.x, from.y)) {
    cursor = cameFrom.get(cursor) as number;
  }

  return { x: cursor % DEMO_GRID_SIZE, y: Math.floor(cursor / DEMO_GRID_SIZE) };
}

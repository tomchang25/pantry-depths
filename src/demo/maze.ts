/**
 * Demo maze generation.
 *
 * Twenty-one cells square. The outer ring is indestructible brick; everything inside is carved by a
 * recursive backtracker and then perforated so the result reads as a dungeon rather than a puzzle.
 * Entrance and exit are drawn uniformly from the open cells with no reachability check at all — a
 * sealed exit is a legal maze here, on purpose.
 */

export const DEMO_GRID_SIZE = 21;

export type DemoTileKind = "open" | "border" | "stone" | "wood" | "water";

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
  altar: DemoCell;
}>;

/**
 * Wall hit points, in the same unit every attack spends.
 *
 * One bare swing costs 1, so a stone wall is still four swings and a wood wall still two. A thrown
 * stick costs 2, which breaks wood outright and stone in a pair; a thrown rock costs 4, which breaks
 * either in one. The numbers are chosen so those statements are all true at once.
 */
export const STONE_WALL_HP = 4;
export const WOOD_WALL_HP = 2;

/** Fraction of surviving interior walls knocked out after carving, to make loops and small rooms. */
const PERFORATION_CHANCE = 0.16;
const WOOD_SHARE = 0.42;
const POOL_COUNT = { minimum: 3, maximum: 6 };
const POOL_SIZE = { minimum: 1, maximum: 4 };

export function tileIndex(x: number, y: number): number {
  return y * DEMO_GRID_SIZE + x;
}

export function isInsideGrid(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < DEMO_GRID_SIZE && y < DEMO_GRID_SIZE;
}

function between(minimum: number, maximum: number): number {
  return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
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

/** Floods a few small pools into already-open floor. Pools grow by random adjacency, so none is a
 * neat rectangle and most end up hugging a corridor edge where something can be knocked into them. */
function floodPools(tiles: DemoTile[], open: DemoCell[]): void {
  const pools = between(POOL_COUNT.minimum, POOL_COUNT.maximum);

  for (let pool = 0; pool < pools; pool += 1) {
    const seed = pick(open);

    if (!seed || tiles[tileIndex(seed.x, seed.y)]?.kind !== "open") {
      continue;
    }

    const frontier: DemoCell[] = [seed];
    const size = between(POOL_SIZE.minimum, POOL_SIZE.maximum);

    for (let filled = 0; filled < size && frontier.length > 0; filled += 1) {
      const cell = frontier.splice(Math.floor(Math.random() * frontier.length), 1)[0] as DemoCell;
      const tile = tiles[tileIndex(cell.x, cell.y)];

      if (!tile || tile.kind !== "open") {
        continue;
      }

      tile.kind = "water";

      for (const step of shuffled([
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ])) {
        const nextX = cell.x + step.x;
        const nextY = cell.y + step.y;

        if (nextX > 0 && nextY > 0 && nextX < DEMO_GRID_SIZE - 1 && nextY < DEMO_GRID_SIZE - 1) {
          frontier.push({ x: nextX, y: nextY });
        }
      }
    }
  }
}

function walkableCells(tiles: readonly DemoTile[]): DemoCell[] {
  const cells: DemoCell[] = [];

  for (let y = 1; y < DEMO_GRID_SIZE - 1; y += 1) {
    for (let x = 1; x < DEMO_GRID_SIZE - 1; x += 1) {
      if (tiles[tileIndex(x, y)]?.kind === "open") {
        cells.push({ x, y });
      }
    }
  }

  return cells;
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

  floodPools(tiles, walkableCells(tiles));
  const open = walkableCells(tiles);
  const entrance = pick(open) ?? { x: 1, y: 1 };
  const away = open.filter((cell) => cell.x !== entrance.x || cell.y !== entrance.y);
  const exit = pick(away) ?? { x: 19, y: 19 };
  const altar = pick(away.filter((cell) => cell.x !== exit.x || cell.y !== exit.y)) ?? entrance;
  return { size: DEMO_GRID_SIZE, tiles, entrance, exit, altar };
}

export function tileAt(maze: DemoMaze, x: number, y: number): DemoTile | undefined {
  return isInsideGrid(x, y) ? maze.tiles[tileIndex(x, y)] : undefined;
}

/**
 * Whether a cell stops a ray: walls do, water does not.
 *
 * This is the predicate the raycaster and every projectile use. Water has to be seen across and
 * thrown across, which is the whole reason it is a separate question from whether a body can enter.
 */
export function blocksSight(maze: DemoMaze, x: number, y: number): boolean {
  const tile = tileAt(maze, x, y);
  return tile === undefined || (tile.kind !== "open" && tile.kind !== "water");
}

/** Whether a cell stops a body under its own power. Water does: nothing walks into a pool. */
export function blocksWalk(maze: DemoMaze, x: number, y: number): boolean {
  const tile = tileAt(maze, x, y);
  return tile === undefined || tile.kind !== "open";
}

/**
 * Whether a cell stops a body that is not in control of itself — knocked back, or thrown.
 *
 * Only walls do. A body flung over a pool lands in it, which is exactly what makes knockback lethal
 * next to water and is the reason this predicate exists apart from the walking one.
 */
export function blocksBody(maze: DemoMaze, x: number, y: number): boolean {
  return blocksSight(maze, x, y);
}

export function isWaterCell(maze: DemoMaze, x: number, y: number): boolean {
  return tileAt(maze, x, y)?.kind === "water";
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

      if (!isInsideGrid(nextX, nextY) || blocksWalk(maze, nextX, nextY)) {
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

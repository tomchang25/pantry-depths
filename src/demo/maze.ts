/**
 * Demo maze generation.
 *
 * Twenty-one cells square. The outer ring is indestructible brick; everything inside is carved by a
 * recursive backtracker and then perforated so the result reads as a dungeon rather than a puzzle.
 * Entrance and exit are drawn uniformly from the open cells with no reachability check at all — a
 * sealed exit is a legal maze here, on purpose.
 */

export const DEMO_GRID_SIZE = 21;

export type DemoTileKind = "open" | "border" | "stone" | "wood" | "water" | "barricade" | "filled" | "mortar";

export type DemoCell = Readonly<{ x: number; y: number }>;

export type DemoTile = {
  kind: DemoTileKind;
  /** Remaining hits. Stone starts at 4, wood at 2, border is unbreakable and stays at Infinity. */
  hp: number;
  maxHp: number;
  /**
   * Bodies that have gone under in this cell. Water only, and the reason a pool is spendable: three
   * of them close it over into `filled`, which is ground again.
   */
  bodies: number;
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
/**
 * Iron caltrops: slow to clear, which is the point.
 *
 * Eight bare swings is deliberately more than any wall, because a barricade is not in your way —
 * you can walk around it — and destroying one is giving up the free kills it would have handed you.
 */
export const BARRICADE_HP = 8;
const BARRICADE_COUNT = { minimum: 4, maximum: 7 };

/**
 * The floor's own artillery: a squat mortar on a carriage that shells whatever is standing in the open.
 *
 * As tough as a barricade, and worth the trip for the same reason one is worth avoiding. Its two-tile
 * dead zone means it can never fire at anything standing next to it, so walking up and breaking it
 * down is always available and always safe — which is the counter, and the reason it can afford to
 * range across the whole floor.
 */
export const MORTAR_HP = 8;
const MORTAR_COUNT = { minimum: 2, maximum: 3 };
/** How high a thrown thing has to be flying to sail over a mortar rather than into it. */
const MORTAR_CLEAR_HEIGHT = 0.85;

/** Fraction of surviving interior walls knocked out after carving, to make loops and small rooms. */
const PERFORATION_CHANCE = 0.16;
const WOOD_SHARE = 0.42;
const POOL_COUNT = { minimum: 3, maximum: 6 };
const POOL_SIZE = { minimum: 1, maximum: 4 };
/**
 * Bodies one water cell swallows before it is ground again.
 *
 * Per cell rather than per pool, which is what makes a wide pool a decision: three bodies buy one
 * square of crossing, and where you put that square is the whole of it.
 */
export const POOL_FILL_BODIES = 3;

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

/**
 * Drops iron barricades into open floor, spread out rather than clustered.
 *
 * Placed by the generator rather than left behind by a broken wall: a hazard you can shove things
 * onto is only interesting where the fighting happens, and where the fighting happens is not where
 * the walls were.
 */
function scatterBarricades(tiles: DemoTile[], open: DemoCell[]): void {
  const wanted = between(BARRICADE_COUNT.minimum, BARRICADE_COUNT.maximum);
  const placed: DemoCell[] = [];
  const pool = shuffled(open);

  for (const cell of pool) {
    if (placed.length >= wanted) {
      return;
    }

    // Never adjacent to another one: a wall of caltrops blocks a corridor, and these are meant to
    // be something you fight around rather than something that reroutes you.
    if (placed.some((other) => Math.abs(other.x - cell.x) <= 1 && Math.abs(other.y - cell.y) <= 1)) {
      continue;
    }

    const tile = tiles[tileIndex(cell.x, cell.y)];

    if (!tile || tile.kind !== "open") {
      continue;
    }

    tile.kind = "barricade";
    tile.hp = BARRICADE_HP;
    tile.maxHp = BARRICADE_HP;
    placed.push(cell);
  }
}

/**
 * Drops mortar emplacements into open floor, well apart from each other.
 *
 * Spread harder than the barricades are, because two adjacent mortars would put two circles on the
 * same patch of floor and turn a readable hazard into a coin flip. The floor is small enough that a
 * handful of them reach everywhere between them.
 */
function scatterMortars(tiles: DemoTile[], open: DemoCell[]): void {
  const wanted = between(MORTAR_COUNT.minimum, MORTAR_COUNT.maximum);
  const placed: DemoCell[] = [];

  for (const cell of shuffled(open)) {
    if (placed.length >= wanted) {
      return;
    }

    if (placed.some((other) => Math.abs(other.x - cell.x) <= 3 && Math.abs(other.y - cell.y) <= 3)) {
      continue;
    }

    const tile = tiles[tileIndex(cell.x, cell.y)];

    if (!tile || tile.kind !== "open") {
      continue;
    }

    tile.kind = "mortar";
    tile.hp = MORTAR_HP;
    tile.maxHp = MORTAR_HP;
    placed.push(cell);
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
        tiles.push({ kind: "border", hp: Number.POSITIVE_INFINITY, maxHp: Number.POSITIVE_INFINITY, bodies: 0 });
        continue;
      }

      if (!solid[tileIndex(x, y)]) {
        tiles.push({ kind: "open", hp: 0, maxHp: 0, bodies: 0 });
        continue;
      }

      const wood = Math.random() < WOOD_SHARE;
      tiles.push(
        wood
          ? { kind: "wood", hp: WOOD_WALL_HP, maxHp: WOOD_WALL_HP, bodies: 0 }
          : { kind: "stone", hp: STONE_WALL_HP, maxHp: STONE_WALL_HP, bodies: 0 },
      );
    }
  }

  floodPools(tiles, walkableCells(tiles));
  scatterBarricades(tiles, walkableCells(tiles));
  scatterMortars(tiles, walkableCells(tiles));
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
 * The four questions a cell can be asked, and why they are four rather than one.
 *
 * Water and barricades each answer differently to different ones, and that is exactly what makes
 * them interesting: a pool can be seen and thrown across but not walked into, and a barricade can be
 * seen over and walked around but stops anything thrown — while still letting a knocked-back body
 * land on top of it, which is what kills.
 */

/**
 * Ground you can stand on: bare floor, and a pool the bodies have closed over.
 *
 * A filled pool answers every one of the four questions below exactly as open floor does, so it is
 * named once here rather than added to each of them — the whole point of filling one in is that it
 * stops being a hazard and becomes somewhere to walk.
 */
function isFloorKind(kind: DemoTileKind): boolean {
  return kind === "open" || kind === "filled";
}

/** Line of sight only. You can see over both a pool and a barricade. */
export function blocksVision(maze: DemoMaze, x: number, y: number): boolean {
  const tile = tileAt(maze, x, y);
  return tile === undefined || (!isFloorKind(tile.kind) && tile.kind !== "water" && tile.kind !== "barricade");
}

/**
 * What stops something thrown, shot, or knocked loose as debris.
 *
 * Barricades count and pools do not, which is what makes a barricade cover: you and whatever is
 * behind it can see each other perfectly well, and neither of you can put anything through it.
 */
export function blocksProjectile(maze: DemoMaze, x: number, y: number): boolean {
  const tile = tileAt(maze, x, y);
  return tile === undefined || (!isFloorKind(tile.kind) && tile.kind !== "water");
}

/** What stops a body moving under its own power. Nothing walks into a pool or onto the spikes. */
export function blocksWalk(maze: DemoMaze, x: number, y: number): boolean {
  const tile = tileAt(maze, x, y);
  return tile === undefined || !isFloorKind(tile.kind);
}

/**
 * How high a thrown thing has to be flying to clear a barricade.
 *
 * This amends the flat cover contract: a barricade still stops every flat throw — which is what
 * makes it cover — but a deliberate lob arcs over the timbers. Ground-level tactics keep their
 * meaning and aiming upward buys a way past them.
 */
const BARRICADE_CLEAR_HEIGHT = 0.7;

/**
 * How tall an interior wall stands, in cells.
 *
 * One storey, everywhere, on every floor. It used to be rolled per floor — one storey or two, with
 * the tall kind growing likelier as you descended — and the roll decided in silence whether a lob
 * could clear an interior wall at all: the same upward throw crossed a wall on one floor and buried
 * itself in it on the next, with nothing on screen to say why. Height also stopped being the thing
 * that gave the place any scale once the roof came off; the open sky and a boundary standing well
 * above everything inside it do that now.
 *
 * Whole storeys only, whatever the number: the wall texture tiles once per cell of height, so a
 * fractional room stretches its last course and reads as low-resolution masonry rather than as tall.
 */
export const DEMO_WALL_HEIGHT = 1;

/**
 * Whether a projectile flying at this height is stopped by the cell.
 *
 * The height-aware form of `blocksProjectile`, for flights that really have a height: walls stop
 * what flies below their top, the boundary stops everything so the arena stays sealed however hard
 * the throw, and pools stop nothing.
 */
export function blocksProjectileAt(maze: DemoMaze, x: number, y: number, z: number): boolean {
  const tile = tileAt(maze, x, y);

  if (tile === undefined || tile.kind === "border") {
    return true;
  }

  if (tile.kind === "stone" || tile.kind === "wood") {
    return z < DEMO_WALL_HEIGHT;
  }

  if (tile.kind === "barricade") {
    return z < BARRICADE_CLEAR_HEIGHT;
  }

  // Stands taller than the caltrops and shorter than a wall, so a flat throw buries itself in the
  // carriage and a lob still clears the muzzle. Without this branch it would inherit the fallthrough
  // below and stop nothing at all, which no solid object should.
  if (tile.kind === "mortar") {
    return z < MORTAR_CLEAR_HEIGHT;
  }

  return false;
}

/**
 * What stops a body that is not in control of itself — knocked back, or thrown.
 *
 * Only walls. A barricade must *not* be in here: if it stopped flung bodies they would pile against
 * it and never land on it, and landing on it is the entire point of the thing.
 */
export function blocksFlung(maze: DemoMaze, x: number, y: number): boolean {
  return blocksVision(maze, x, y);
}

export function isWaterCell(maze: DemoMaze, x: number, y: number): boolean {
  return tileAt(maze, x, y)?.kind === "water";
}

/**
 * Whether spilled blood settles on a cell.
 *
 * Open water washes it away, and a filled pool is already made of what would have spilled — a stain
 * laid over the heap reads as red mud rather than as carnage. Asked at both ends, where a stain is
 * recorded and where it is drawn, so the two can never disagree about a cell.
 */
export function holdsStains(maze: DemoMaze, x: number, y: number): boolean {
  const kind = tileAt(maze, x, y)?.kind;
  return kind !== "water" && kind !== "filled" && kind !== "mortar";
}

/**
 * A body going under in a pool cell, and the count that closes it.
 *
 * Returns true only for the body that fills the cell, so the caller can say so once rather than
 * every time something drowns. Anything that dies somewhere that is not open water — dry land, a
 * pool already filled in — is not a body the pool swallows and changes nothing.
 */
export function sinkBody(maze: DemoMaze, x: number, y: number): boolean {
  const tile = tileAt(maze, x, y);

  if (tile?.kind !== "water") {
    return false;
  }

  tile.bodies += 1;

  if (tile.bodies < POOL_FILL_BODIES) {
    return false;
  }

  tile.kind = "filled";
  return true;
}

/**
 * A barricade: the timbers a broken wood wall leaves standing.
 *
 * Exactly the water contract — walk around it, see and throw over it, and be flung onto it. That
 * last one is the whole point: it turns every knockback next to one into a kill.
 */
export function isBarricadeCell(maze: DemoMaze, x: number, y: number): boolean {
  return tileAt(maze, x, y)?.kind === "barricade";
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
  // Read position instead of `shift()`: shifting re-indexes the whole remaining queue, which made
  // an exhaustive no-path search quadratic in the open area it swept.
  let head = 0;

  while (head < queue.length && !found) {
    const current = queue[head] as number;
    head += 1;
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

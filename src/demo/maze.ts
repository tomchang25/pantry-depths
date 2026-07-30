/**
 * Demo maze generation.
 *
 * Thirty-five cells square, assembled from five blocks: a twenty-one-square main region in the middle
 * with a seven-square room attached to each of its four sides. The main region is carved by a
 * recursive backtracker and then perforated so it reads as a dungeon rather than a puzzle; a room is
 * open floor throughout, because each one exists to hold exactly one piece of business.
 *
 * **Square is load-bearing, not aesthetic.** Modules outside this one read the floor's dimension, and
 * every one of those reads is a loop bound or a flat index that keeps working while there is one
 * number and breaks the moment there are two. The corners the assembly leaves over are filled with
 * boundary brick, which costs a slightly emptier map and buys the whole shape staying inside this file.
 *
 * Block rings are boundary brick rather than masonry, so the five blocks keep their shape however hard
 * the player swings; the only ways between them are the doorways punched below. Entrance and descent
 * are drawn uniformly from the main region's open cells with no reachability check at all — a sealed
 * descent is a legal floor here, on purpose — but the doorways are never drawn and never blocked, so a
 * room is always reachable.
 */

export const DEMO_GRID_SIZE = 35;

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

/** The four sides a room can hang off. */
export type DemoRoomSide = "north" | "south" | "west" | "east";

/**
 * What a side room is for.
 *
 * The set is fixed rather than drawn: three kinds of business for three slots means a draw of three
 * from three is not a draw. Which side each one lands on *is* drawn, because the extraction room is
 * never marked and a room that is always north would be learned once and then known forever.
 */
export type DemoRoomRole = "cursedAltar" | "blessingAltar" | "hotSpring" | "extraction";

export type DemoRoom = Readonly<{
  role: DemoRoomRole;
  side: DemoRoomSide;
  /** Inclusive bounds of the open interior, wall ring excluded. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Middle of the interior, which is where the room's business stands. */
  center: DemoCell;
  /** The interior cell the doorway opens through, on the side facing the main region. */
  doorway: DemoCell;
}>;

/**
 * What a floor owes, in one of the units it already counts.
 *
 * Every kind is a running total against a target, because the simulation already keeps all four and a
 * task that needs a new signal is a task the floor cannot actually observe.
 */
export type DemoTaskKind = "kills" | "wallsBroken" | "roomsVisited" | "poolsFilled";

export type DemoTask = {
  kind: DemoTaskKind;
  /** What this floor is asking for, in the kind's own unit. */
  target: number;
  /** How much of it this floor has seen. */
  done: number;
  met: boolean;
};

/**
 * What this floor has taken and what it still owes.
 *
 * Mutable, and hung off the floor for the same reason a pool counts the bodies it has swallowed: it
 * has exactly the floor's lifetime, and descending is meant to wipe it.
 */
export type DemoFloorProgress = {
  /** Unbroken seconds the player has stood in the blessing altar's room. */
  heldSeconds: number;
  blessingTaken: boolean;
  /** Pools this floor has closed over with bodies. */
  poolsFilled: number;
  /** Which side rooms the player has set foot in. */
  roomsVisited: DemoRoomSide[];
  /**
   * The run counters as they read when this floor began, so a task counts this floor rather than the
   * run. Unset until the first step on the floor, because the floor is built before anyone reads it.
   */
  killsAtArrival: number | undefined;
  wallsBrokenAtArrival: number | undefined;
  /** Met to open the descent, and to reveal where it is. Pays nothing by itself. */
  main: DemoTask;
  /** Each pays a blessing the moment it is met. */
  secondary: DemoTask[];
};

/**
 * What a floor asks for.
 *
 * One main task and three secondaries, the same four every floor. The run's difficulty is a clock,
 * not a rising target list, so a floor asking more at depth would be pricing the same work twice.
 */
function createFloorProgress(): DemoFloorProgress {
  return {
    heldSeconds: 0,
    blessingTaken: false,
    poolsFilled: 0,
    roomsVisited: [],
    killsAtArrival: undefined,
    wallsBrokenAtArrival: undefined,
    main: { kind: "kills", target: 20, done: 0, met: false },
    secondary: [
      { kind: "wallsBroken", target: 12, done: 0, met: false },
      { kind: "roomsVisited", target: 4, done: 0, met: false },
      { kind: "poolsFilled", target: 1, done: 0, met: false },
    ],
  };
}

export type DemoMaze = Readonly<{
  size: number;
  tiles: DemoTile[];
  entrance: DemoCell;
  exit: DemoCell;
  altar: DemoCell;
  progress: DemoFloorProgress;
  /**
   * Where a run is left with everything it is carrying.
   *
   * Open from the first second and marked by nothing, which is the whole of it: leaving stays a
   * continuous choice, and knowing where to leave from is something a floor charges time for.
   */
  extraction: DemoCell;
  rooms: readonly DemoRoom[];
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

/**
 * One of the five blocks the floor is assembled from: a square, wall ring included.
 *
 * Square here for the same reason the floor is. A block with two dimensions would put a width and a
 * height into every loop below and buy nothing a bigger square does not.
 */
type DemoBlock = Readonly<{ x: number; y: number; size: number }>;

const ROOM_BLOCK_SIZE = 7;
const MAIN_BLOCK: DemoBlock = {
  x: ROOM_BLOCK_SIZE,
  y: ROOM_BLOCK_SIZE,
  size: DEMO_GRID_SIZE - ROOM_BLOCK_SIZE * 2,
};

/** Rooms sit centred on the side they hang off, so the assembly is symmetric on both axes. */
const ROOM_INSET = (DEMO_GRID_SIZE - ROOM_BLOCK_SIZE) / 2;
const ROOM_FAR_EDGE = DEMO_GRID_SIZE - ROOM_BLOCK_SIZE;

const ROOM_SIDES: Readonly<Record<DemoRoomSide, Readonly<{ block: DemoBlock; inward: DemoCell }>>> = {
  north: { block: { x: ROOM_INSET, y: 0, size: ROOM_BLOCK_SIZE }, inward: { x: 0, y: 1 } },
  south: { block: { x: ROOM_INSET, y: ROOM_FAR_EDGE, size: ROOM_BLOCK_SIZE }, inward: { x: 0, y: -1 } },
  west: { block: { x: 0, y: ROOM_INSET, size: ROOM_BLOCK_SIZE }, inward: { x: 1, y: 0 } },
  east: { block: { x: ROOM_FAR_EDGE, y: ROOM_INSET, size: ROOM_BLOCK_SIZE }, inward: { x: -1, y: 0 } },
};

const ROOM_SIDE_ORDER: readonly DemoRoomSide[] = ["north", "south", "west", "east"];
const ROOM_ROLES: readonly DemoRoomRole[] = ["cursedAltar", "blessingAltar", "hotSpring", "extraction"];

function blockCenter(block: DemoBlock): DemoCell {
  const half = (block.size - 1) / 2;
  return { x: block.x + half, y: block.y + half };
}

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

function carve(solid: boolean[], block: DemoBlock): void {
  const start: DemoCell = { x: block.x + 1, y: block.y + 1 };
  const last: DemoCell = { x: block.x + block.size - 2, y: block.y + block.size - 2 };
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

      if (nextX < start.x || nextY < start.y || nextX > last.x || nextY > last.y) {
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
function floodPools(tiles: DemoTile[], open: DemoCell[], block: DemoBlock, keepClear: ReadonlySet<number>): void {
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

      if (!tile || tile.kind !== "open" || keepClear.has(tileIndex(cell.x, cell.y))) {
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

        // Bounded to the block that seeded it, so a pool can never grow out through a doorway and
        // close the only way into a room.
        if (
          nextX > block.x &&
          nextY > block.y &&
          nextX < block.x + block.size - 1 &&
          nextY < block.y + block.size - 1
        ) {
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

function isBlockInterior(block: DemoBlock, x: number, y: number): boolean {
  return x > block.x && y > block.y && x < block.x + block.size - 1 && y < block.y + block.size - 1;
}

function walkableCells(tiles: readonly DemoTile[], block: DemoBlock): DemoCell[] {
  const cells: DemoCell[] = [];

  for (let y = block.y + 1; y < block.y + block.size - 1; y += 1) {
    for (let x = block.x + 1; x < block.x + block.size - 1; x += 1) {
      if (tiles[tileIndex(x, y)]?.kind === "open") {
        cells.push({ x, y });
      }
    }
  }

  return cells;
}

function openTile(): DemoTile {
  return { kind: "open", hp: 0, maxHp: 0, bodies: 0 };
}

/**
 * Turns the carve into tiles.
 *
 * Everything outside every block's interior is boundary brick in one branch: the grid's outer ring,
 * the corners the five-block assembly leaves over, and each block's own wall ring. That is what keeps
 * the five blocks five blocks — the doorways punched afterwards are the only ways between them.
 */
function assembleTiles(solid: readonly boolean[], blocks: readonly DemoBlock[]): DemoTile[] {
  const tiles: DemoTile[] = [];

  for (let y = 0; y < DEMO_GRID_SIZE; y += 1) {
    for (let x = 0; x < DEMO_GRID_SIZE; x += 1) {
      if (!blocks.some((block) => isBlockInterior(block, x, y))) {
        tiles.push({ kind: "border", hp: Number.POSITIVE_INFINITY, maxHp: Number.POSITIVE_INFINITY, bodies: 0 });
        continue;
      }

      if (!solid[tileIndex(x, y)]) {
        tiles.push(openTile());
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

  return tiles;
}

/**
 * Opens one room's doorway and reports the room.
 *
 * Five cells in a line: two of the room's own interior, the two rings the doorway goes through, and
 * the main region's interior on the far side. All five are forced open and recorded as clear, so
 * neither the carve nor anything scattered afterwards can seal a room the player is promised.
 */
function attachRoom(tiles: DemoTile[], keepClear: Set<number>, side: DemoRoomSide, role: DemoRoomRole): DemoRoom {
  const { block, inward } = ROOM_SIDES[side];
  const center = blockCenter(block);
  const half = (block.size - 1) / 2;
  const doorway: DemoCell = { x: center.x + inward.x * (half - 1), y: center.y + inward.y * (half - 1) };

  for (let step = -1; step <= 3; step += 1) {
    const x = doorway.x + inward.x * step;
    const y = doorway.y + inward.y * step;
    tiles[tileIndex(x, y)] = openTile();
    keepClear.add(tileIndex(x, y));
  }

  return {
    role,
    side,
    minX: block.x + 1,
    minY: block.y + 1,
    maxX: block.x + block.size - 2,
    maxY: block.y + block.size - 2,
    center,
    doorway,
  };
}

/** Neither masonry nor boundary: something in the way that a walk cannot pass and a floor still owns. */
function isHazardKind(kind: DemoTileKind): boolean {
  return kind === "water" || kind === "barricade" || kind === "mortar";
}

/**
 * Clears whatever a scatter dropped across the only walk into a room.
 *
 * A one-cell corridor is severed by one pool, and a room hangs off exactly one doorway, so without
 * this a floor arrives with a room — sometimes the extraction room — that cannot be walked to at all.
 * Masonry is left alone on purpose: a wall in the way is the player's business and they have four
 * ways to open one. A pool is not, because filling one costs bodies the floor may not have yet.
 *
 * Searches over floor and hazards together, which always succeeds: the carve leaves every open cell
 * in the main region on one tree, and every doorway was forced open onto it.
 */
function clearWalkToRooms(tiles: DemoTile[], from: DemoCell, rooms: readonly DemoRoom[]): void {
  const cameFrom = new Map<number, number>();
  const queue: number[] = [tileIndex(from.x, from.y)];
  const seen = new Set<number>(queue);
  let head = 0;

  while (head < queue.length) {
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

      if (!isInsideGrid(nextX, nextY)) {
        continue;
      }

      const next = tileIndex(nextX, nextY);
      const kind = tiles[next]?.kind;

      if (kind === undefined || seen.has(next) || !(isFloorKind(kind) || isHazardKind(kind))) {
        continue;
      }

      seen.add(next);
      cameFrom.set(next, current);
      queue.push(next);
    }
  }

  for (const room of rooms) {
    let cursor = tileIndex(room.doorway.x, room.doorway.y);

    while (cursor !== tileIndex(from.x, from.y)) {
      const tile = tiles[cursor];

      if (tile && isHazardKind(tile.kind)) {
        tiles[cursor] = openTile();
      }

      const previous = cameFrom.get(cursor);

      if (previous === undefined) {
        break;
      }

      cursor = previous;
    }
  }
}

export function generateDemoMaze(): DemoMaze {
  const solid: boolean[] = Array.from({ length: DEMO_GRID_SIZE * DEMO_GRID_SIZE }, () => true);
  carve(solid, MAIN_BLOCK);

  for (let y = MAIN_BLOCK.y + 1; y < MAIN_BLOCK.y + MAIN_BLOCK.size - 1; y += 1) {
    for (let x = MAIN_BLOCK.x + 1; x < MAIN_BLOCK.x + MAIN_BLOCK.size - 1; x += 1) {
      if (solid[tileIndex(x, y)] && Math.random() < PERFORATION_CHANCE) {
        solid[tileIndex(x, y)] = false;
      }
    }
  }

  const roomBlocks = ROOM_SIDE_ORDER.map((side) => ROOM_SIDES[side].block);

  // A room is floor throughout. It holds one piece of business, and a maze inside it would only be
  // somewhere for that business to hide.
  for (const block of roomBlocks) {
    for (let y = block.y + 1; y < block.y + block.size - 1; y += 1) {
      for (let x = block.x + 1; x < block.x + block.size - 1; x += 1) {
        solid[tileIndex(x, y)] = false;
      }
    }
  }

  const tiles = assembleTiles(solid, [MAIN_BLOCK, ...roomBlocks]);
  const keepClear = new Set<number>();
  const roles = shuffled(ROOM_ROLES);
  const rooms = ROOM_SIDE_ORDER.map((side, index) => attachRoom(tiles, keepClear, side, roles[index] as DemoRoomRole));
  const byRole = new Map(rooms.map((room) => [room.role, room]));

  // Hazards belong to the main region. A pool in the hot spring or caltrops around an altar is not a
  // decision, it is noise on top of the one thing that room is for.
  const scatterable = walkableCells(tiles, MAIN_BLOCK).filter((cell) => !keepClear.has(tileIndex(cell.x, cell.y)));
  floodPools(tiles, scatterable, MAIN_BLOCK, keepClear);
  const afterPools = walkableCells(tiles, MAIN_BLOCK).filter((cell) => !keepClear.has(tileIndex(cell.x, cell.y)));
  scatterBarricades(tiles, afterPools);
  const afterBarricades = walkableCells(tiles, MAIN_BLOCK).filter((cell) => !keepClear.has(tileIndex(cell.x, cell.y)));
  scatterMortars(tiles, afterBarricades);

  // Both the arrival and the descent stand in the main region, because descending is the main
  // region's business and a room only ever holds one thing.
  const open = walkableCells(tiles, MAIN_BLOCK);
  const entrance = pick(open) ?? blockCenter(MAIN_BLOCK);
  clearWalkToRooms(tiles, entrance, rooms);
  const away = open.filter((cell) => cell.x !== entrance.x || cell.y !== entrance.y);
  const exit = pick(away) ?? entrance;
  const altar = byRole.get("cursedAltar")?.center ?? entrance;
  const extraction = byRole.get("extraction")?.center ?? entrance;
  return {
    size: DEMO_GRID_SIZE,
    tiles,
    entrance,
    exit,
    altar,
    progress: createFloorProgress(),
    extraction,
    rooms,
  };
}

/** Which room a cell stands in, or nothing when it stands in the main region. */
export function roomAt(maze: DemoMaze, x: number, y: number): DemoRoom | undefined {
  return maze.rooms.find((room) => x >= room.minX && y >= room.minY && x <= room.maxX && y <= room.maxY);
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
  // Counted where it happens rather than by sweeping for filled cells, which is the only place that
  // can tell the body that closed a pool from the ones that went in after it.
  maze.progress.poolsFilled += 1;
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

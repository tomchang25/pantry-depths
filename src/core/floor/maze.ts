/**
 * Assembles one floor from one map: the grid starts as boundary tile and each room paints its own
 * interior onto it, with doorways punched afterwards.
 *
 * The four accessors below are the only code that converts between a coordinate and a flat index, so
 * a floor whose width and height differ fails loudly rather than silently. Entrance and descent are
 * drawn without a reachability check here; that refusal belongs to the map contract.
 */

import type { ResolvedMap } from "@/core/floor/map-contract";
import { strandedGround, validateDrawnFloor, validateDrawnWalk } from "@/core/floor/map-contract";
import type {
  MapCastMember,
  MapCrowd,
  MapQuantity,
  MapRoom,
  MapRoomRole,
  MapTileKind,
  MapWallMix,
} from "@/core/floor/room-contract";
import type { Cell } from "@/core/grid";

/** Grid size in cells. Every floor-shaped value satisfies this, so the accessors below take the floor. */
export type GridExtent = Readonly<{ width: number; height: number }>;

export type Tile = {
  kind: MapTileKind;
  /** Remaining hits. Stone starts at 4, wood at 2; the boundary is unbreakable at Infinity. */
  hp: number;
  maxHp: number;
  /** Drowned enemies in this cell. Water only: three of them turn it into `filled`, which is walkable. */
  bodies: number;
};

/** The four sides a room can hang off. */
export type RoomSide = "north" | "south" | "west" | "east";

/** How many enemies a room holds and how fast it replaces them; a floor-wide cap cannot say what a part holds. */
export type Crowd = MapCrowd;

/** A block of a floor. The main region and each side room are both this, differing by content rather than type. */
export type Room = Readonly<{
  /** Which room file this was built from; which of the pool landed in a slot is decided during assembly. */
  id: string;
  /** What fixture this room holds, when it holds any. */
  role?: MapRoomRole;
  /** Which side of the main region it hangs off. The main region hangs off nothing. */
  side?: RoomSide;
  /** Inclusive bounds of the open interior, wall ring excluded. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Middle of the interior, where the room's fixture stands. */
  center: Cell;
  /** The interior cell the doorway opens through, on the side facing the main region. */
  doorway?: Cell;
  crowd: Crowd;
  /** Enemies this room's file places at named cells, in room-local coordinates. Carried like the crowd. */
  cast: readonly MapCastMember[];
}>;

/** A floor objective's unit. Each is a running total the simulation already keeps. */
export type TaskKind = "kills" | "wallsBroken" | "roomsVisited" | "poolsFilled";

export type Task = {
  kind: TaskKind;
  /** What this floor is asking for, in the kind's own unit. */
  target: number;
  /** How much of it this floor has seen. */
  done: number;
  met: boolean;
};

/** Per-floor counters and objective state. Hung off the floor because descending wipes it. */
export type FloorProgress = {
  /** Unbroken seconds the player has stood on the blessing altar's pad. */
  heldSeconds: number;
  /** Unbroken seconds the player has stood on the extraction pad. Stepping off cancels it; damage does not. */
  extractionSeconds: number;
  blessingTaken: boolean;
  /** Pools this floor has closed over. */
  poolsFilled: number;
  /** Which side rooms the player has set foot in. */
  roomsVisited: RoomSide[];
  /** Run counters as this floor began, so a task counts this floor. Unset until the first step on it. */
  killsAtArrival: number | undefined;
  wallsBrokenAtArrival: number | undefined;
  /** Met to open the descent and reveal where it is. Grants nothing by itself. */
  main: Task;
  /** Each grants a blessing the moment it is met. */
  secondary: Task[];
};

/** One main task and three secondaries on every floor. Difficulty is a clock, not a rising target list. */
function createFloorProgress(): FloorProgress {
  return {
    heldSeconds: 0,
    extractionSeconds: 0,
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

export type Maze = Readonly<{
  width: number;
  height: number;
  tiles: Tile[];
  entrance: Cell;
  exit: Cell;
  altar: Cell;
  progress: FloorProgress;
  /** Where a run is left with everything it is carrying. Open from the first second and unmarked. */
  extraction: Cell;
  rooms: readonly Room[];
}>;

/** Wall hit points, in the unit every attack spends: a bare swing costs 1, a thrown stick 2, a rock 4. */
export const STONE_WALL_HP = 4;
export const WOOD_WALL_HP = 2;
/** Iron caltrops. Eight swings, more than any wall: a barricade can be walked around rather than opened. */
export const BARRICADE_HP = 8;

/** Mortar emplacement. It cannot fire inside a two-tile dead zone, which is the counter for its range. */
export const MORTAR_HP = 8;
/** How high a thrown thing has to be flying to sail over a mortar rather than into it. */
const MORTAR_CLEAR_HEIGHT = 0.85;

/** Drowned enemies one water cell swallows before it is walkable. Per cell, so a wide pool is a choice. */
export const POOL_FILL_BODIES = 3;

/** The patch of grid one room stands on, wall ring included. */
type Block = Readonly<{ x: number; y: number; width: number; height: number }>;

/** Which way a side room faces the region it hangs off. */
const SLOT_INWARD: Readonly<Record<RoomSide, Cell>> = {
  north: { x: 0, y: 1 },
  south: { x: 0, y: -1 },
  west: { x: 1, y: 0 },
  east: { x: -1, y: 0 },
};

/** The cells a room holds, wall ring excluded. Every share a room states is taken of this. */
function interiorArea(block: Block): number {
  return (block.width - 2) * (block.height - 2);
}

function blockCenter(block: Block): Cell {
  return { x: block.x + Math.floor((block.width - 1) / 2), y: block.y + Math.floor((block.height - 1) / 2) };
}

/** The only place a stride is spelled out. A flat index with the wrong extent is wrong only on an oblong floor. */
export function tileIndex(extent: GridExtent, x: number, y: number): number {
  return y * extent.width + x;
}

export function cellFromIndex(extent: GridExtent, index: number): Cell {
  return { x: index % extent.width, y: Math.floor(index / extent.width) };
}

export function isInsideGrid(extent: GridExtent, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < extent.width && y < extent.height;
}

export function gridArea(extent: GridExtent): number {
  return extent.width * extent.height;
}

/** A whole number between two ends, inclusive. Equal ends draw nothing, so a seeded run stays stable. */
function between(minimum: number, maximum: number): number {
  return minimum >= maximum ? minimum : minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

/** What a quantity a room stated comes to on this floor. A bare number costs no randomness. */
export function roll(quantity: MapQuantity): number {
  return typeof quantity === "number" ? quantity : between(quantity.minimum, quantity.maximum);
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

function carve(extent: GridExtent, solid: boolean[], block: Block): void {
  const start: Cell = { x: block.x + 1, y: block.y + 1 };
  const last: Cell = { x: block.x + block.width - 2, y: block.y + block.height - 2 };
  const stack: Cell[] = [start];
  solid[tileIndex(extent, start.x, start.y)] = false;

  while (stack.length > 0) {
    const current = stack[stack.length - 1] as Cell;
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

      if (!solid[tileIndex(extent, nextX, nextY)]) {
        continue;
      }

      solid[tileIndex(extent, nextX, nextY)] = false;
      solid[tileIndex(extent, current.x + step.x / 2, current.y + step.y / 2)] = false;
      stack.push({ x: nextX, y: nextY });
      advanced = true;
      break;
    }

    if (!advanced) {
      stack.pop();
    }
  }
}

/** Floods small pools into open floor. Pools grow by random adjacency, so none is a neat rectangle. */
function floodPools(
  extent: GridExtent,
  tiles: Tile[],
  open: Cell[],
  block: Block,
  keepClear: ReadonlySet<number>,
  wanted: Readonly<{ share: number; size: MapQuantity }>,
): void {
  // A share of the room rather than a count, so the same declaration reads the same in a room of any size.
  const target = Math.round(wanted.share * interiorArea(block));
  // Bounded on attempts rather than successes: a room whose open cells are nearly all on a route
  // between rooms can never reach its target, and the loop has to give up rather than spin.
  const attempts = target * 4 + 8;
  let wet = 0;

  for (let attempt = 0; attempt < attempts && wet < target; attempt += 1) {
    const seed = pick(open);

    if (!seed || tiles[tileIndex(extent, seed.x, seed.y)]?.kind !== "open") {
      continue;
    }

    const frontier: Cell[] = [seed];
    const size = Math.min(roll(wanted.size), target - wet);

    // A cell counts against the pool's size only once it is wet. The frontier can hold the same cell
    // twice, so counting attempts would deliver a smaller pool than the one asked for.
    let filled = 0;

    while (filled < size && frontier.length > 0) {
      const cell = frontier.splice(Math.floor(Math.random() * frontier.length), 1)[0] as Cell;
      const tile = tiles[tileIndex(extent, cell.x, cell.y)];

      if (!tile || tile.kind !== "open" || keepClear.has(tileIndex(extent, cell.x, cell.y))) {
        continue;
      }

      tile.kind = "water";
      wet += 1;
      filled += 1;

      for (const step of shuffled([
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ])) {
        const nextX = cell.x + step.x;
        const nextY = cell.y + step.y;

        // Bounded to the block that seeded it, so a pool cannot grow out through a doorway and seal a room.
        if (
          nextX > block.x &&
          nextY > block.y &&
          nextX < block.x + block.width - 1 &&
          nextY < block.y + block.height - 1
        ) {
          frontier.push({ x: nextX, y: nextY });
        }
      }
    }
  }
}

/** Drops iron barricades into open floor, spread out rather than clustered. */
function scatterBarricades(extent: GridExtent, tiles: Tile[], open: Cell[], quantity: MapQuantity): void {
  const wanted = roll(quantity);
  const placed: Cell[] = [];
  const pool = shuffled(open);

  for (const cell of pool) {
    if (placed.length >= wanted) {
      return;
    }

    // Never adjacent to another: a line of caltrops blocks a corridor, and these are meant to be
    // fought around rather than to reroute the player.
    if (placed.some((other) => Math.abs(other.x - cell.x) <= 1 && Math.abs(other.y - cell.y) <= 1)) {
      continue;
    }

    const tile = tiles[tileIndex(extent, cell.x, cell.y)];

    if (!tile || tile.kind !== "open") {
      continue;
    }

    tile.kind = "barricade";
    tile.hp = BARRICADE_HP;
    tile.maxHp = BARRICADE_HP;
    placed.push(cell);
  }
}

/** Drops mortars into open floor, spread further than the barricades: two would blanket one patch of floor. */
function scatterMortars(extent: GridExtent, tiles: Tile[], open: Cell[], quantity: MapQuantity): void {
  const wanted = roll(quantity);
  const placed: Cell[] = [];

  for (const cell of shuffled(open)) {
    if (placed.length >= wanted) {
      return;
    }

    if (placed.some((other) => Math.abs(other.x - cell.x) <= 3 && Math.abs(other.y - cell.y) <= 3)) {
      continue;
    }

    const tile = tiles[tileIndex(extent, cell.x, cell.y)];

    if (!tile || tile.kind !== "open") {
      continue;
    }

    tile.kind = "mortar";
    tile.hp = MORTAR_HP;
    tile.maxHp = MORTAR_HP;
    placed.push(cell);
  }
}

function walkableCells(extent: GridExtent, tiles: readonly Tile[], block: Block): Cell[] {
  const cells: Cell[] = [];

  for (let y = block.y + 1; y < block.y + block.height - 1; y += 1) {
    for (let x = block.x + 1; x < block.x + block.width - 1; x += 1) {
      if (tiles[tileIndex(extent, x, y)]?.kind === "open") {
        cells.push({ x, y });
      }
    }
  }

  return cells;
}

function openTile(): Tile {
  return { kind: "open", hp: 0, maxHp: 0, bodies: 0 };
}

function borderTile(): Tile {
  return { kind: "border", hp: Number.POSITIVE_INFINITY, maxHp: Number.POSITIVE_INFINITY, bodies: 0 };
}

/** One wall, drawn against the room's own ratio. Normalised, so the two numbers need not sum to one. */
function wallTile(walls: MapWallMix): Tile {
  return Math.random() * (walls.stone + walls.wood) < walls.wood
    ? { kind: "wood", hp: WOOD_WALL_HP, maxHp: WOOD_WALL_HP, bodies: 0 }
    : { kind: "stone", hp: STONE_WALL_HP, maxHp: STONE_WALL_HP, bodies: 0 };
}

function tileOfKind(kind: MapTileKind): Tile {
  if (kind === "stone") {
    return { kind, hp: STONE_WALL_HP, maxHp: STONE_WALL_HP, bodies: 0 };
  }

  if (kind === "wood") {
    return { kind, hp: WOOD_WALL_HP, maxHp: WOOD_WALL_HP, bodies: 0 };
  }

  if (kind === "barricade") {
    return { kind, hp: BARRICADE_HP, maxHp: BARRICADE_HP, bodies: 0 };
  }

  if (kind === "mortar") {
    return { kind, hp: MORTAR_HP, maxHp: MORTAR_HP, bodies: 0 };
  }

  if (kind === "border") {
    return borderTile();
  }

  return { kind, hp: 0, maxHp: 0, bodies: 0 };
}

/** Paints one room's interior as the room declares it. The wall ring is never written. */
function paintRoom(extent: GridExtent, tiles: Tile[], block: Block, room: MapRoom): void {
  if ("authored" in room.structure) {
    for (let y = block.y + 1; y < block.y + block.height - 1; y += 1) {
      for (let x = block.x + 1; x < block.x + block.width - 1; x += 1) {
        const kind = room.structure.authored[y - block.y]?.[x - block.x];
        tiles[tileIndex(extent, x, y)] = kind === undefined ? borderTile() : tileOfKind(kind);
      }
    }

    return;
  }

  if (room.structure.generated === "open") {
    for (let y = block.y + 1; y < block.y + block.height - 1; y += 1) {
      for (let x = block.x + 1; x < block.x + block.width - 1; x += 1) {
        tiles[tileIndex(extent, x, y)] = openTile();
      }
    }

    return;
  }

  const solid: boolean[] = Array.from({ length: gridArea(extent) }, () => true);
  carve(extent, solid, block);

  // Opened after the carve, not instead of it: a backtracker leaves one route between any two cells.
  // The share is a floor rather than a target — closing a corridor to meet a smaller one would sever the room.
  const walls: Cell[] = [];
  let openCells = 0;

  for (let y = block.y + 1; y < block.y + block.height - 1; y += 1) {
    for (let x = block.x + 1; x < block.x + block.width - 1; x += 1) {
      if (solid[tileIndex(extent, x, y)]) {
        walls.push({ x, y });
      } else {
        openCells += 1;
      }
    }
  }

  const wanted = Math.round(room.structure.openShare * interiorArea(block));

  for (const cell of shuffled(walls).slice(0, Math.max(0, wanted - openCells))) {
    solid[tileIndex(extent, cell.x, cell.y)] = false;
  }

  for (let y = block.y + 1; y < block.y + block.height - 1; y += 1) {
    for (let x = block.x + 1; x < block.x + block.width - 1; x += 1) {
      tiles[tileIndex(extent, x, y)] = solid[tileIndex(extent, x, y)] ? wallTile(room.structure.walls) : openTile();
    }
  }
}

/** What a room holding no enemies declares: nothing standing, no room for any, no reinforcement. */
const NO_CROWD: MapCrowd = { cap: 0, starting: 0 };

/** Where a room stands on the floor, in the terms everything that walks and draws asks in. */
function roomOn(block: Block, source: MapRoom): Room {
  return {
    id: source.id,
    ...(source.role === undefined ? {} : { role: source.role }),
    minX: block.x + 1,
    minY: block.y + 1,
    maxX: block.x + block.width - 2,
    maxY: block.y + block.height - 2,
    center: blockCenter(block),
    crowd: source.crowd ?? NO_CROWD,
    cast: source.cast ?? [],
  };
}

/**
 * Opens one side room's doorway and returns the assembled room. The line from the room's inward edge
 * to the main region is forced open and recorded as clear, so nothing scattered afterwards seals it.
 */
function attachRoom(
  extent: GridExtent,
  tiles: Tile[],
  keepClear: Set<number>,
  placed: Readonly<{ block: Block; side: RoomSide; main: Block; source: MapRoom }>,
): Room {
  const { block, side, main, source } = placed;
  const inward = SLOT_INWARD[side];
  const center = blockCenter(block);
  const vertical = inward.x === 0;
  const step2 = vertical ? inward.y : inward.x;
  // The room's last interior cell on the side facing the main region.
  const edge = Math.floor(((vertical ? block.height : block.width) - 1) / 2) - 1;
  const doorway: Cell = { x: center.x + inward.x * edge, y: center.y + inward.y * edge };
  // The main region's first interior cell on the same line, however much boundary lies between.
  const target = vertical
    ? inward.y > 0
      ? main.y + 1
      : main.y + main.height - 2
    : inward.x > 0
      ? main.x + 1
      : main.x + main.width - 2;
  const reach = (target - (vertical ? doorway.y : doorway.x)) * step2;

  for (let step = -1; step <= reach; step += 1) {
    const x = doorway.x + inward.x * step;
    const y = doorway.y + inward.y * step;
    tiles[tileIndex(extent, x, y)] = openTile();
    keepClear.add(tileIndex(extent, x, y));
  }

  return { ...roomOn(block, source), side, doorway };
}

/** Something in the way that a walk cannot pass and that is neither masonry nor boundary. */
function isHazardKind(kind: MapTileKind): boolean {
  return kind === "water" || kind === "barricade" || kind === "mortar";
}

/**
 * Clears whatever a scatter dropped across the only walk into a room: one doorway per room and one
 * pool severs it. Masonry is left alone, since the player has four ways to open a wall. A room
 * therefore keeps roughly two cells less of what it scattered per room attached.
 */
function clearWalkToRooms(extent: GridExtent, tiles: Tile[], from: Cell, rooms: readonly Room[]): void {
  const cameFrom = new Map<number, number>();
  const queue: number[] = [tileIndex(extent, from.x, from.y)];
  const seen = new Set<number>(queue);
  let head = 0;

  while (head < queue.length) {
    const current = queue[head] as number;
    head += 1;
    const { x: currentX, y: currentY } = cellFromIndex(extent, current);

    for (const step of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const nextX = currentX + step.x;
      const nextY = currentY + step.y;

      if (!isInsideGrid(extent, nextX, nextY)) {
        continue;
      }

      const next = tileIndex(extent, nextX, nextY);
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
    if (!room.doorway) {
      continue;
    }

    let cursor = tileIndex(extent, room.doorway.x, room.doorway.y);

    while (cursor !== tileIndex(extent, from.x, from.y)) {
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

/**
 * Opens whatever water has closed a ring around a piece of the floor. Repaired rather than refused,
 * because a refusal is a run that does not start over a roll of the dice; the walk back draws no
 * random number, so a seeded floor is unchanged unless it needed this.
 *
 * Both searches refuse to cross a trench, which nothing can open. The pass repeats because opening
 * one pool can expose ground shut in behind another, and its bound is a backstop for the refusal below.
 */
function openStrandedGround(extent: GridExtent, tiles: Tile[], from: Cell, authored: ReadonlySet<number>): void {
  const kinds = (): MapTileKind[] => tiles.map((tile) => tile.kind);
  const STEPS: readonly Cell[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  for (let pass = 0; pass < 16; pass += 1) {
    // Ground an author sealed off is left as painted: an island in a pool is a design, not a defect.
    const stranded = strandedGround({
      mapName: "",
      width: extent.width,
      height: extent.height,
      tiles: kinds(),
      entrance: from,
      exit: from,
      drawnRoomIds: [],
      authoredCells: [],
    }).filter((cell) => !authored.has(tileIndex(extent, cell.x, cell.y)));

    if (stranded.length === 0) {
      return;
    }

    // Reachable ignoring unfillable ground, which is exactly the set the walk back below rejoins.
    const dry = new Set<number>();
    const dryQueue: number[] = [tileIndex(extent, from.x, from.y)];
    dry.add(dryQueue[0] as number);

    for (let head = 0; head < dryQueue.length; head += 1) {
      const { x: currentX, y: currentY } = cellFromIndex(extent, dryQueue[head] as number);

      for (const step of STEPS) {
        const nextX = currentX + step.x;
        const nextY = currentY + step.y;

        if (!isInsideGrid(extent, nextX, nextY)) {
          continue;
        }

        const next = tileIndex(extent, nextX, nextY);
        const kind = tiles[next]?.kind;

        if (kind === undefined || kind === "border" || kind === "water" || kind === "trench" || dry.has(next)) {
          continue;
        }

        dry.add(next);
        dryQueue.push(next);
      }
    }

    // The same search again, allowed through water but never through a trench or an author's own
    // cells. Every stranded cell a generator's water shut in therefore has a route home.
    const cameFrom = new Map<number, number>();
    const wetQueue: number[] = [tileIndex(extent, from.x, from.y)];
    const wet = new Set<number>(wetQueue);

    for (let head = 0; head < wetQueue.length; head += 1) {
      const current = wetQueue[head] as number;
      const { x: currentX, y: currentY } = cellFromIndex(extent, current);

      for (const step of STEPS) {
        const nextX = currentX + step.x;
        const nextY = currentY + step.y;

        if (!isInsideGrid(extent, nextX, nextY)) {
          continue;
        }

        const next = tileIndex(extent, nextX, nextY);
        const kind = tiles[next]?.kind;

        if (kind === undefined || kind === "border" || kind === "trench" || wet.has(next) || authored.has(next)) {
          continue;
        }

        wet.add(next);
        cameFrom.set(next, current);
        wetQueue.push(next);
      }
    }

    for (const cell of stranded) {
      let cursor: number | undefined = tileIndex(extent, cell.x, cell.y);

      while (cursor !== undefined && !dry.has(cursor)) {
        const tile = tiles[cursor];

        if (tile && tile.kind === "water") {
          tiles[cursor] = openTile();
        }

        cursor = cameFrom.get(cursor);
      }
    }
  }
}

/**
 * Where a room stands, given the slot it landed in: the main region centred in the grid, a side room
 * flush against its grid edge. Whole-cell placement is guaranteed by the map contract, not re-derived.
 */
function blockForSlot(map: ResolvedMap, slot: RoomSide | "main", room: MapRoom, main: MapRoom): Block {
  const mainX = Math.floor((map.width - main.width) / 2);
  const mainY = Math.floor((map.height - main.height) / 2);

  if (slot === "main") {
    return { x: mainX, y: mainY, width: main.width, height: main.height };
  }

  if (slot === "north") {
    return { x: mainX + Math.floor((main.width - room.width) / 2), y: 0, width: room.width, height: room.height };
  }

  if (slot === "south") {
    return {
      x: mainX + Math.floor((main.width - room.width) / 2),
      y: map.height - room.height,
      width: room.width,
      height: room.height,
    };
  }

  if (slot === "west") {
    return { x: 0, y: mainY + Math.floor((main.height - room.height) / 2), width: room.width, height: room.height };
  }

  return {
    x: map.width - room.width,
    y: mainY + Math.floor((main.height - room.height) / 2),
    width: room.width,
    height: room.height,
  };
}

const SIDE_ORDER: readonly RoomSide[] = ["north", "south", "west", "east"];

/**
 * Assembles one floor from one map and refuses it if the draw left no way out. The draw happens after
 * the always-present rooms paint and before the drawn ones do: moving it shifts every later roll.
 */
export function buildFloor(map: ResolvedMap): Maze {
  const extent: GridExtent = { width: map.width, height: map.height };
  const mainPlacement = map.fixed.find((placement) => placement.slot === "main");

  if (!mainPlacement) {
    throw new TypeError(`Map "${map.name}" has no main region to hang a floor off.`);
  }

  const main = mainPlacement.room;
  const mainBlock = blockForSlot(map, "main", main, main);
  const tiles: Tile[] = Array.from({ length: gridArea(extent) }, () => borderTile());
  const fixedSides = map.fixed.filter((placement) => placement.slot !== "main");

  paintRoom(extent, tiles, mainBlock, main);

  for (const placement of fixedSides) {
    const side = placement.slot as RoomSide;
    paintRoom(extent, tiles, blockForSlot(map, side, placement.room, main), placement.room);
  }

  const takenSides = new Set(fixedSides.map((placement) => placement.slot as RoomSide));
  const freeSides = SIDE_ORDER.filter((side) => !takenSides.has(side));
  const drawn = shuffled(map.pool).slice(0, map.draw);
  const placedSides = drawn.map((room, index) => ({ side: freeSides[index] as RoomSide, room }));

  for (const placed of placedSides) {
    paintRoom(extent, tiles, blockForSlot(map, placed.side, placed.room, main), placed.room);
  }

  const keepClear = new Set<number>();
  const sideRooms = [
    ...fixedSides.map((placement) => ({ side: placement.slot as RoomSide, room: placement.room })),
    ...placedSides,
  ].map((placed) =>
    attachRoom(extent, tiles, keepClear, {
      block: blockForSlot(map, placed.side, placed.room, main),
      side: placed.side,
      main: mainBlock,
      source: placed.room,
    }),
  );
  // The main region comes first, so a cell is asked about the block it is in before those attached to it.
  const rooms: readonly Room[] = [roomOn(mainBlock, main), ...sideRooms];
  const byRole = new Map(sideRooms.map((room) => [room.role, room]));

  // A room that asked for nothing draws no random number. The main region comes first and each
  // placement recomputes the free cells, which is the order a seeded floor was drawn in.
  const furnished: readonly Readonly<{ block: Block; room: MapRoom }>[] = [
    { block: mainBlock, room: main },
    ...fixedSides.map((placement) => ({
      block: blockForSlot(map, placement.slot as RoomSide, placement.room, main),
      room: placement.room,
    })),
    ...placedSides.map((placed) => ({
      block: blockForSlot(map, placed.side, placed.room, main),
      room: placed.room,
    })),
  ];

  for (const { block, room } of furnished) {
    const scatter = room.scatter;

    if (!scatter) {
      continue;
    }

    const free = (): Cell[] =>
      walkableCells(extent, tiles, block).filter((cell) => !keepClear.has(tileIndex(extent, cell.x, cell.y)));

    if (scatter.pools) {
      floodPools(extent, tiles, free(), block, keepClear, scatter.pools);
    }

    if (scatter.barricades !== undefined) {
      scatterBarricades(extent, tiles, free(), scatter.barricades);
    }

    if (scatter.mortars !== undefined) {
      scatterMortars(extent, tiles, free(), scatter.mortars);
    }
  }

  // Which cells a person placed by hand, so the repair below can tell a design from a defect.
  const authoredCells = new Set<number>();

  for (const { block, room } of furnished) {
    if (!("authored" in room.structure)) {
      continue;
    }

    for (let y = block.y; y < block.y + block.height; y += 1) {
      for (let x = block.x; x < block.x + block.width; x += 1) {
        authoredCells.add(tileIndex(extent, x, y));
      }
    }
  }

  // Both the arrival and the descent stand in the main region, because a side room holds one thing.
  const open = walkableCells(extent, tiles, mainBlock);
  const entrance = pick(open) ?? blockCenter(mainBlock);
  clearWalkToRooms(extent, tiles, entrance, rooms);
  // After the walks to the rooms, which open hazards along them. The descent is drawn from cells
  // captured before both, which is safe: neither turns open ground into anything else.
  openStrandedGround(extent, tiles, entrance, authoredCells);
  const away = open.filter((cell) => cell.x !== entrance.x || cell.y !== entrance.y);
  const exit = pick(away) ?? entrance;
  const altar = byRole.get("cursedAltar")?.center ?? entrance;
  const extraction = byRole.get("extraction")?.center ?? entrance;

  // Asked of the finished floor, because whether one is legal is the map contract's question. Two
  // checks: the stairs reachable with masonry coming down, and no ground cut off by what does not.
  const drawnFloor = {
    mapName: map.name,
    width: extent.width,
    height: extent.height,
    tiles: tiles.map((tile) => tile.kind),
    entrance,
    exit,
    drawnRoomIds: drawn.map((room) => room.id),
    authoredCells: [...authoredCells],
  };
  validateDrawnFloor(drawnFloor);
  validateDrawnWalk(drawnFloor);

  return {
    width: extent.width,
    height: extent.height,
    tiles,
    entrance,
    exit,
    altar,
    progress: createFloorProgress(),
    extraction,
    rooms,
  };
}

/** Which room's interior a cell stands in, or nothing when it stands in a wall or a doorway. */
export function roomAt(maze: Maze, x: number, y: number): Room | undefined {
  return maze.rooms.find((room) => x >= room.minX && y >= room.minY && x <= room.maxX && y <= room.maxY);
}

/** The region a floor's rooms hang off. Every floor has exactly one, and it hangs off nothing. */
export function mainRoom(maze: Maze): Room {
  return (maze.rooms.find((room) => room.side === undefined) ?? maze.rooms[0]) as Room;
}

/** The room an entity here answers to, never nothing: the main region owns whatever lies between rooms. */
export function standingRoom(maze: Maze, x: number, y: number): Room {
  return roomAt(maze, x, y) ?? mainRoom(maze);
}

/**
 * Which room's pad a cell stands on: the three cells around the fixture. One definition, read by the
 * two systems that run a pad and by the scene that draws it, so drawn and working extent agree.
 */
export const ROOM_PAD_HALF = 1;

export function padRoomAt(maze: Maze, x: number, y: number): Room | undefined {
  return maze.rooms.find(
    (room) =>
      // A room holding no fixture has no pad; without this the main region would report one nothing could use.
      room.role !== undefined &&
      Math.abs(x - room.center.x) <= ROOM_PAD_HALF &&
      Math.abs(y - room.center.y) <= ROOM_PAD_HALF,
  );
}

export function tileAt(maze: Maze, x: number, y: number): Tile | undefined {
  return isInsideGrid(maze, x, y) ? maze.tiles[tileIndex(maze, x, y)] : undefined;
}

/** Ground that can be stood on. A filled pool answers all four questions below exactly as open floor does. */
function isFloorKind(kind: MapTileKind): boolean {
  return kind === "open" || kind === "filled";
}

/** Line of sight only. You can see over a pool, a trench and a barricade — none of them stands up. */
export function blocksVision(maze: Maze, x: number, y: number): boolean {
  const tile = tileAt(maze, x, y);
  return (
    tile === undefined ||
    (!isFloorKind(tile.kind) && tile.kind !== "water" && tile.kind !== "trench" && tile.kind !== "barricade")
  );
}

/** What stops something thrown, shot, or knocked loose. Barricades count and pools do not: that is cover. */
export function blocksProjectile(maze: Maze, x: number, y: number): boolean {
  const tile = tileAt(maze, x, y);
  return tile === undefined || (!isFloorKind(tile.kind) && tile.kind !== "water" && tile.kind !== "trench");
}

/** What stops an entity moving under its own power. Nothing walks into a pool or onto the spikes. */
export function blocksWalk(maze: Maze, x: number, y: number): boolean {
  const tile = tileAt(maze, x, y);
  return tile === undefined || !isFloorKind(tile.kind);
}

/** How high a thrown thing has to fly to clear a barricade. Flat throws are stopped; a lob arcs over. */
const BARRICADE_CLEAR_HEIGHT = 0.7;

/** Interior wall height in cells. Whole storeys only: the texture tiles once per cell of height. */
export const DEMO_WALL_HEIGHT = 1;

/** The height-aware form of `blocksProjectile`. The boundary stops everything; pools stop nothing. */
export function blocksProjectileAt(maze: Maze, x: number, y: number, z: number): boolean {
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

  // Taller than the caltrops, shorter than a wall. Without this branch it would stop nothing at all.
  if (tile.kind === "mortar") {
    return z < MORTAR_CLEAR_HEIGHT;
  }

  return false;
}

/** What stops an entity knocked back or thrown. Only walls: a barricade must be landed on, not hit. */
export function blocksFlung(maze: Maze, x: number, y: number): boolean {
  return blocksVision(maze, x, y);
}

export function isWaterCell(maze: Maze, x: number, y: number): boolean {
  return tileAt(maze, x, y)?.kind === "water";
}

export function isTrenchCell(maze: Maze, x: number, y: number): boolean {
  return tileAt(maze, x, y)?.kind === "trench";
}

/**
 * Whether spilled blood settles on a cell. Asked at both ends, where a stain is recorded and where it
 * is drawn, so the two cannot disagree.
 */
export function holdsStains(maze: Maze, x: number, y: number): boolean {
  const kind = tileAt(maze, x, y)?.kind;
  return kind !== "water" && kind !== "trench" && kind !== "filled" && kind !== "mortar";
}

/** Records a drowning and reports whether it closed the cell. True only for the one that fills it. */
export function sinkBody(maze: Maze, x: number, y: number): boolean {
  const tile = tileAt(maze, x, y);

  if (tile?.kind !== "water") {
    return false;
  }

  tile.bodies += 1;

  if (tile.bodies < POOL_FILL_BODIES) {
    return false;
  }

  tile.kind = "filled";
  // Counted here, the only place that can tell the drowning that closed a pool from the ones after it.
  maze.progress.poolsFilled += 1;
  return true;
}

/** A barricade: walk around it, see and throw over it, be flung onto it. The last turns knockback into a kill. */
export function isBarricadeCell(maze: Maze, x: number, y: number): boolean {
  return tileAt(maze, x, y)?.kind === "barricade";
}

/**
 * A random cell reachable on foot from where an entity stands. The flood covers the whole floor, so a
 * wander crosses the room rather than pacing, and it is paid once per target rather than per frame.
 * The start cell is never a candidate and need not be walkable.
 */
export function randomReachableCell(maze: Maze, from: Cell): Cell | undefined {
  const queue: number[] = [tileIndex(maze, from.x, from.y)];
  const reachable: number[] = [];
  const seen = new Set<number>(queue);
  let head = 0;

  while (head < queue.length) {
    const current = queue[head] as number;
    head += 1;
    const { x: currentX, y: currentY } = cellFromIndex(maze, current);

    for (const step of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const nextX = currentX + step.x;
      const nextY = currentY + step.y;

      if (!isInsideGrid(maze, nextX, nextY) || blocksWalk(maze, nextX, nextY)) {
        continue;
      }

      const next = tileIndex(maze, nextX, nextY);

      if (seen.has(next)) {
        continue;
      }

      seen.add(next);
      queue.push(next);
      reachable.push(next);
    }
  }

  const chosen = pick(reachable);

  if (chosen === undefined) {
    return undefined;
  }

  return cellFromIndex(maze, chosen);
}

/** The first step along the shortest walkable route between two cells. Used only by enemy pathing. */
export function breadthFirstStep(maze: Maze, from: Cell, to: Cell): Cell | undefined {
  if (from.x === to.x && from.y === to.y) {
    return undefined;
  }

  const cameFrom = new Map<number, number>();
  const queue: number[] = [tileIndex(maze, from.x, from.y)];
  const goal = tileIndex(maze, to.x, to.y);
  const seen = new Set<number>(queue);
  let found = false;
  // Read position instead of `shift()`: shifting re-indexes the queue, which made an exhaustive
  // no-path search quadratic in the open area it swept.
  let head = 0;

  while (head < queue.length && !found) {
    const current = queue[head] as number;
    head += 1;
    const { x: currentX, y: currentY } = cellFromIndex(maze, current);

    for (const step of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const nextX = currentX + step.x;
      const nextY = currentY + step.y;

      if (!isInsideGrid(maze, nextX, nextY) || blocksWalk(maze, nextX, nextY)) {
        continue;
      }

      const next = tileIndex(maze, nextX, nextY);

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

  while (cameFrom.get(cursor) !== undefined && cameFrom.get(cursor) !== tileIndex(maze, from.x, from.y)) {
    cursor = cameFrom.get(cursor) as number;
  }

  return cellFromIndex(maze, cursor);
}

/**
 * Whether an attack can be made along this line. Asks the projectile question rather than the vision
 * one, so a shooter behind a barricade holds fire and walks until it has an angle.
 */
export function hasLineOfSight(maze: Maze, fromX: number, fromY: number, toX: number, toY: number): boolean {
  const distance = Math.hypot(toX - fromX, toY - fromY);
  const steps = Math.ceil(distance * 8);

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t;

    if (blocksProjectile(maze, Math.floor(x), Math.floor(y))) {
      return false;
    }
  }

  return true;
}

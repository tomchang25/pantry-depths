/**
 * Assembling one floor from one map.
 *
 * A floor is a grid of boundary brick that its rooms paint themselves onto: the main region in the
 * middle, and a room in each side slot the map's draw filled. How a room paints is the room's own
 * declaration — carved by a recursive backtracker and then opened up to the share of itself the room
 * asked to be, so it reads as a dungeon rather than a puzzle; open floor throughout for a room holding
 * one piece of business; or the cells exactly as somebody authored them.
 *
 * **The extent belongs to the floor, not to this module.** A floor carries its own width and height,
 * and the four accessors below are the only code anywhere that turns a coordinate into a flat index
 * or an index back into a coordinate. Nothing outside them multiplies by a stride, which is what lets
 * a floor of another shape be wrong loudly instead of silently. Whatever the rooms do not paint stays
 * boundary brick, which costs a slightly emptier map and buys the whole shape staying in this file.
 *
 * Block rings are boundary brick rather than masonry, so the blocks keep their shape however hard the
 * player swings; the only ways between them are the doorways punched below. Entrance and descent are
 * drawn uniformly from the main region's open cells with no reachability check here — that refusal
 * belongs to the map contract, and it is made once the floor exists rather than while it is built.
 */

import type { ResolvedMap } from "@/core/map-contract";
import { strandedGround, validateDrawnFloor, validateDrawnWalk } from "@/core/map-contract";
import type {
  MapCastMember,
  MapCrowd,
  MapQuantity,
  MapRoom,
  MapRoomRole,
  MapTileKind,
  MapWallMix,
} from "@/core/room-contract";

/**
 * How much floor there is, in cells.
 *
 * Two numbers rather than one, because a map that can be authored is a map that can be oblong. Every
 * floor-shaped thing satisfies this — a floor is one — so the accessors below take the floor itself.
 */
export type DemoGridExtent = Readonly<{ width: number; height: number }>;

/**
 * The tile vocabulary, owned by the content layer and aliased here.
 *
 * One list, not two that have to be kept equal by hand. The content layer may not import the demo, so
 * it declares the kinds and this half — which may import content — takes them as its own. A kind added
 * there without a branch here then fails to compile, which is the whole point of the arrangement.
 */
export type DemoTileKind = MapTileKind;

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

/** What business a room holds. Owned by the map contract and aliased here, the same as the tiles. */
export type DemoRoomRole = MapRoomRole;

/**
 * How many bodies a room holds, and how fast it puts them back.
 *
 * Owned by the room rather than by the floor because a body walks between rooms freely: a floor-wide
 * cap can state a total and can never say what any part of it holds, and that difference is exactly
 * what a boss room or an empty corridor needs to say.
 *
 * Aliased from the content layer rather than copied, the same as the tiles and the roles, so the shape
 * an author writes and the shape the spawn code reads cannot drift apart. What arrives here is the
 * declaration, not one floor's numbers — the rolling happens where the question is asked.
 */
export type DemoCrowd = MapCrowd;

/**
 * A block of a floor, large or small.
 *
 * The middle of the floor is one of these and so is each room hanging off it. They differ by what
 * they hold and how they are built — a side room hangs off a side, holds one piece of business, and
 * is reached through one doorway; the region everything else hangs off does none of the three — and
 * never by kind, which is what gives anything that varies per region somewhere honest to live.
 */
export type DemoRoom = Readonly<{
  /**
   * Which room file this was built from.
   *
   * Carried because a floor is assembled from a draw, and nothing else on an assembled room can say
   * which of the pool's rooms landed here — a role is optional and a side says only where. What needs
   * it is a tool showing an author what one draw did with their pool.
   */
  id: string;
  /** What business this room holds, when it holds any. */
  role?: DemoRoomRole;
  /** Which side of the main region it hangs off. The main region hangs off nothing. */
  side?: DemoRoomSide;
  /** Inclusive bounds of the open interior, wall ring excluded. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Middle of the interior, which is where the room's business stands. */
  center: DemoCell;
  /** The interior cell the doorway opens through, on the side facing the main region. */
  doorway?: DemoCell;
  crowd: DemoCrowd;
  /**
   * The bodies this room's file stands at named cells, still in room-local coordinates.
   *
   * Carried the way the crowd is, and for the same reason: what populates a floor walks the assembled
   * rooms and has no other way back to the file each one came from — a drawn side room is not
   * recoverable by name from the map, because which of the pool landed is decided during assembly.
   */
  cast: readonly MapCastMember[];
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
  /** Unbroken seconds the player has stood on the blessing altar's pad. */
  heldSeconds: number;
  /**
   * Unbroken seconds the player has stood on the extraction pad.
   *
   * Floor state rather than run state, and correctly so: stepping off is what cancels it, and a
   * descent has taken the pad with it. Damage does not touch it — the hold is broken by leaving and
   * by nothing else, the same rule the blessing altar runs on and for the same reason.
   */
  extractionSeconds: number;
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

export type DemoMaze = Readonly<{
  width: number;
  height: number;
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

/**
 * The floor's own artillery: a squat mortar on a carriage that shells whatever is standing in the open.
 *
 * As tough as a barricade, and worth the trip for the same reason one is worth avoiding. Its two-tile
 * dead zone means it can never fire at anything standing next to it, so walking up and breaking it
 * down is always available and always safe — which is the counter, and the reason it can afford to
 * range across the whole floor.
 */
export const MORTAR_HP = 8;
/** How high a thrown thing has to be flying to sail over a mortar rather than into it. */
const MORTAR_CLEAR_HEIGHT = 0.85;

/**
 * Bodies one water cell swallows before it is ground again.
 *
 * Per cell rather than per pool, which is what makes a wide pool a decision: three bodies buy one
 * square of crossing, and where you put that square is the whole of it.
 */
export const POOL_FILL_BODIES = 3;

/**
 * The patch of grid one room stands on, wall ring included.
 *
 * Two dimensions rather than one, because a map that can be authored is a map whose rooms can be
 * oblong. Everything below reads the block it was handed rather than a size the module knows.
 */
type DemoBlock = Readonly<{ x: number; y: number; width: number; height: number }>;

/** Which way a side room faces the region it hangs off. */
const SLOT_INWARD: Readonly<Record<DemoRoomSide, DemoCell>> = {
  north: { x: 0, y: 1 },
  south: { x: 0, y: -1 },
  west: { x: 1, y: 0 },
  east: { x: -1, y: 0 },
};

/** The cells a room actually holds, wall ring excluded. What every share a room states is taken of. */
function interiorArea(block: DemoBlock): number {
  return (block.width - 2) * (block.height - 2);
}

function blockCenter(block: DemoBlock): DemoCell {
  return { x: block.x + Math.floor((block.width - 1) / 2), y: block.y + Math.floor((block.height - 1) / 2) };
}

/**
 * The four questions anyone can ask about a grid's shape, and the only place a stride is spelled out.
 *
 * A flat index written with the wrong one of two extents type-checks perfectly and is wrong only on a
 * floor that is not square — which is exactly the first interesting floor anybody authors. Keeping the
 * multiplication here means there is one place for that mistake to be made and it has already been
 * made correctly.
 */
export function tileIndex(extent: DemoGridExtent, x: number, y: number): number {
  return y * extent.width + x;
}

export function cellFromIndex(extent: DemoGridExtent, index: number): DemoCell {
  return { x: index % extent.width, y: Math.floor(index / extent.width) };
}

export function isInsideGrid(extent: DemoGridExtent, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < extent.width && y < extent.height;
}

export function gridArea(extent: DemoGridExtent): number {
  return extent.width * extent.height;
}

/**
 * A whole number somewhere between two ends, inclusive.
 *
 * **Draws nothing when there is nothing to choose between.** A seeded run reproduces a floor only if
 * every roll happens the same number of times in the same order, so a range whose ends are equal has to
 * cost no randomness — otherwise stating a fixed quantity as a one-value range, which is exactly how an
 * exact number migrates out of code and into a room file, silently moves every later roll.
 */
function between(minimum: number, maximum: number): number {
  return minimum >= maximum ? minimum : minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

/** What a quantity a room stated comes to on this particular floor. A bare number costs no randomness. */
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

function carve(extent: DemoGridExtent, solid: boolean[], block: DemoBlock): void {
  const start: DemoCell = { x: block.x + 1, y: block.y + 1 };
  const last: DemoCell = { x: block.x + block.width - 2, y: block.y + block.height - 2 };
  const stack: DemoCell[] = [start];
  solid[tileIndex(extent, start.x, start.y)] = false;

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

/** Floods a few small pools into already-open floor. Pools grow by random adjacency, so none is a
 * neat rectangle and most end up hugging a corridor edge where something can be knocked into them. */
function floodPools(
  extent: DemoGridExtent,
  tiles: DemoTile[],
  open: DemoCell[],
  block: DemoBlock,
  keepClear: ReadonlySet<number>,
  wanted: Readonly<{ share: number; size: MapQuantity }>,
): void {
  // A share of the room rather than a number of pools, so the same declaration reads the same in a
  // room of any size. Pools of varying size adding to a fixed total still give a different number of
  // pools in different shapes every floor, which is where the variety comes from now.
  const target = Math.round(wanted.share * interiorArea(block));
  // Bounded on attempts rather than successes: a room whose open cells are nearly all on a way
  // between rooms can never reach its target, and the loop has to give up rather than spin.
  const attempts = target * 4 + 8;
  let wet = 0;

  for (let attempt = 0; attempt < attempts && wet < target; attempt += 1) {
    const seed = pick(open);

    if (!seed || tiles[tileIndex(extent, seed.x, seed.y)]?.kind !== "open") {
      continue;
    }

    const frontier: DemoCell[] = [seed];
    const size = Math.min(roll(wanted.size), target - wet);

    // A cell counts against the pool's size only once it is actually wet. The frontier holds the same
    // cell more than once whenever two of its neighbours reached it, so counting attempts instead
    // would quietly deliver a pool smaller than the one asked for — which did not matter when the
    // declaration was a number of pools and does now that it is a number of cells.
    let filled = 0;

    while (filled < size && frontier.length > 0) {
      const cell = frontier.splice(Math.floor(Math.random() * frontier.length), 1)[0] as DemoCell;
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

        // Bounded to the block that seeded it, so a pool can never grow out through a doorway and
        // close the only way into a room.
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

/**
 * Drops iron barricades into open floor, spread out rather than clustered.
 *
 * Placed by the generator rather than left behind by a broken wall: a hazard you can shove things
 * onto is only interesting where the fighting happens, and where the fighting happens is not where
 * the walls were.
 */
function scatterBarricades(extent: DemoGridExtent, tiles: DemoTile[], open: DemoCell[], quantity: MapQuantity): void {
  const wanted = roll(quantity);
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

/**
 * Drops mortar emplacements into open floor, well apart from each other.
 *
 * Spread harder than the barricades are, because two adjacent mortars would put two circles on the
 * same patch of floor and turn a readable hazard into a coin flip. The floor is small enough that a
 * handful of them reach everywhere between them.
 */
function scatterMortars(extent: DemoGridExtent, tiles: DemoTile[], open: DemoCell[], quantity: MapQuantity): void {
  const wanted = roll(quantity);
  const placed: DemoCell[] = [];

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

function walkableCells(extent: DemoGridExtent, tiles: readonly DemoTile[], block: DemoBlock): DemoCell[] {
  const cells: DemoCell[] = [];

  for (let y = block.y + 1; y < block.y + block.height - 1; y += 1) {
    for (let x = block.x + 1; x < block.x + block.width - 1; x += 1) {
      if (tiles[tileIndex(extent, x, y)]?.kind === "open") {
        cells.push({ x, y });
      }
    }
  }

  return cells;
}

function openTile(): DemoTile {
  return { kind: "open", hp: 0, maxHp: 0, bodies: 0 };
}

function borderTile(): DemoTile {
  return { kind: "border", hp: Number.POSITIVE_INFINITY, maxHp: Number.POSITIVE_INFINITY, bodies: 0 };
}

/** One wall, drawn against the room's own ratio. Normalised, so the two numbers need not sum to one. */
function wallTile(walls: MapWallMix): DemoTile {
  return Math.random() * (walls.stone + walls.wood) < walls.wood
    ? { kind: "wood", hp: WOOD_WALL_HP, maxHp: WOOD_WALL_HP, bodies: 0 }
    : { kind: "stone", hp: STONE_WALL_HP, maxHp: STONE_WALL_HP, bodies: 0 };
}

function tileOfKind(kind: DemoTileKind): DemoTile {
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

/**
 * Paints one room onto the floor, the way the room itself says it is built.
 *
 * Only the block's interior is ever written: the ring stays the boundary brick the floor started as,
 * which is what keeps the blocks blocks — the doorways punched afterwards are the only ways between
 * them. This is the whole of what "the main region is a room like the others" buys, and the reason a
 * map can carry an authored room beside a carved one without either knowing the other exists.
 */
function paintRoom(extent: DemoGridExtent, tiles: DemoTile[], block: DemoBlock, room: MapRoom): void {
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

  // Opened up after the carve rather than instead of it: a backtracker leaves exactly one route
  // between any two cells, and knocking walls out is what turns a puzzle into a dungeon.
  //
  // **The room's share is a floor, not a target to land on.** The corridors the carve left are
  // already the tightest this room can be, so a room asking to be less open than that gets its
  // corridors — closing one to meet a smaller number would sever the room the carve just guaranteed
  // was whole.
  const walls: DemoCell[] = [];
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

/**
 * What a room holding nobody spends on bodies.
 *
 * Nothing standing there, room for nothing, and no reinforcement at all — which is a statement rather
 * than a very large number. It used to be a cap of zero paired with an infinite interval, which is the
 * same contradiction an optional crowd exists to avoid, one layer further down.
 */
const NO_CROWD: MapCrowd = { cap: 0, starting: 0 };

/** Where a room stands on the floor, in the terms everything that walks and draws asks in. */
function roomOn(block: DemoBlock, source: MapRoom): DemoRoom {
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
 * Opens one side room's doorway and reports the room.
 *
 * A line of cells from one inside the room's inward edge, through both wall rings and whatever
 * boundary stands between them, to the main region's first interior cell. Every one is forced open and
 * recorded as clear, so neither a carve nor anything scattered afterwards can seal a room the player
 * is promised. For a room as deep as the margin it hangs in — which is every room the shipped map has
 * — that is the same five cells it has always been.
 */
function attachRoom(
  extent: DemoGridExtent,
  tiles: DemoTile[],
  keepClear: Set<number>,
  placed: Readonly<{ block: DemoBlock; side: DemoRoomSide; main: DemoBlock; source: MapRoom }>,
): DemoRoom {
  const { block, side, main, source } = placed;
  const inward = SLOT_INWARD[side];
  const center = blockCenter(block);
  const vertical = inward.x === 0;
  const step2 = vertical ? inward.y : inward.x;
  // The room's last interior cell on the side facing the main region.
  const edge = Math.floor(((vertical ? block.height : block.width) - 1) / 2) - 1;
  const doorway: DemoCell = { x: center.x + inward.x * edge, y: center.y + inward.y * edge };
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
 * **This is why a room gets less of what it scattered than it asked for.** Every route cleared here
 * gives back whatever stood on it, measured at roughly two cells per room attached — so the shipped
 * region pours eighteen cells of water and keeps about thirteen, and its caltrops thin out the same
 * way. Scattering after this pass instead of before it would deliver the declared amount exactly, at
 * the cost of never putting anything on the routes between rooms, and that is a decision about how a
 * floor should feel rather than a defect to be quietly patched here.
 *
 * Searches over floor and hazards together, which always succeeds: the carve leaves every open cell
 * in the main region on one tree, and every doorway was forced open onto it.
 */
function clearWalkToRooms(extent: DemoGridExtent, tiles: DemoTile[], from: DemoCell, rooms: readonly DemoRoom[]): void {
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
 * Opens whatever water has closed a ring around a piece of a floor.
 *
 * The content layer says which ground nothing can walk to; making it walkable is the business of the
 * thing that put the water there, which is here. **A floor is repaired rather than refused** because a
 * refusal means a run that does not start over a roll of the dice, and that is the worst possible way
 * to spend a guarantee.
 *
 * The walk back stops the moment it meets ground that was already reachable, so the pool that caused
 * the problem loses the cells that were in the way and keeps the rest. Nothing here draws a random
 * number, so a seeded floor is the floor it was unless it genuinely needed this.
 *
 * The whole pass repeats because opening one pool can expose ground still shut in behind another. The
 * bound is a backstop: reaching it leaves the floor stranded, and the refusal that runs afterwards is
 * what turns that into a loud failure rather than a quiet one.
 *
 * **A trench is not this function's business and both of its searches refuse to cross one.** It cannot
 * be opened by anything, so a route through one is not a route, and walking a path back through a cell
 * that will still be there afterwards would report a repair that did not happen. Ground sealed behind
 * a trench is refused when the room file is saved, which is why nothing here has to cope with it.
 */
function openStrandedGround(
  extent: DemoGridExtent,
  tiles: DemoTile[],
  from: DemoCell,
  authored: ReadonlySet<number>,
): void {
  const kinds = (): MapTileKind[] => tiles.map((tile) => tile.kind);
  const STEPS: readonly DemoCell[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  for (let pass = 0; pass < 16; pass += 1) {
    // Ground an author sealed off is left exactly as painted: an island in a pool is a design, and
    // cutting a channel to it would be this pass quietly editing somebody's room.
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

    // The same search again, this time allowed through water — but never through a trench, which no
    // walk back could open, and never through an author's own cells, which this pass may not edit.
    // Every stranded cell a generator's water shut in therefore has a route home.
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
 * Where a room stands, given the slot it landed in.
 *
 * The main region sits centred in the grid; a side room sits flush against its own grid edge and
 * centred on the other axis. Both are whole-cell placements, which is what the map contract's at-rest
 * rules were written to guarantee — this function trusts them rather than re-deriving them.
 */
function blockForSlot(map: ResolvedMap, slot: DemoRoomSide | "main", room: MapRoom, main: MapRoom): DemoBlock {
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

const SIDE_ORDER: readonly DemoRoomSide[] = ["north", "south", "west", "east"];

/**
 * Assembles one floor from one map, and refuses it if the draw left no way out.
 *
 * The order here is load-bearing in one place that does not look it: the draw happens after the
 * always-present rooms have painted and before the drawn ones do. Moving it earlier would shift every
 * subsequent draw in a seeded run, which is the one cheap piece of evidence this whole change has —
 * the same seed has to produce the same floor it produced before there were maps.
 */
export function buildDemoFloor(map: ResolvedMap): DemoMaze {
  const extent: DemoGridExtent = { width: map.width, height: map.height };
  const mainPlacement = map.fixed.find((placement) => placement.slot === "main");

  if (!mainPlacement) {
    throw new TypeError(`Map "${map.name}" has no main region to hang a floor off.`);
  }

  const main = mainPlacement.room;
  const mainBlock = blockForSlot(map, "main", main, main);
  const tiles: DemoTile[] = Array.from({ length: gridArea(extent) }, () => borderTile());
  const fixedSides = map.fixed.filter((placement) => placement.slot !== "main");

  paintRoom(extent, tiles, mainBlock, main);

  for (const placement of fixedSides) {
    const side = placement.slot as DemoRoomSide;
    paintRoom(extent, tiles, blockForSlot(map, side, placement.room, main), placement.room);
  }

  const takenSides = new Set(fixedSides.map((placement) => placement.slot as DemoRoomSide));
  const freeSides = SIDE_ORDER.filter((side) => !takenSides.has(side));
  const drawn = shuffled(map.pool).slice(0, map.draw);
  const placedSides = drawn.map((room, index) => ({ side: freeSides[index] as DemoRoomSide, room }));

  for (const placed of placedSides) {
    paintRoom(extent, tiles, blockForSlot(map, placed.side, placed.room, main), placed.room);
  }

  const keepClear = new Set<number>();
  const sideRooms = [
    ...fixedSides.map((placement) => ({ side: placement.slot as DemoRoomSide, room: placement.room })),
    ...placedSides,
  ].map((placed) =>
    attachRoom(extent, tiles, keepClear, {
      block: blockForSlot(map, placed.side, placed.room, main),
      side: placed.side,
      main: mainBlock,
      source: placed.room,
    }),
  );
  // The region everything hangs off comes first, so a cell is asked about the block it is actually in
  // before it is asked about the ones attached to that block.
  const rooms: readonly DemoRoom[] = [roomOn(mainBlock, main), ...sideRooms];
  const byRole = new Map(sideRooms.map((room) => [room.role, room]));

  // Each room is furnished with what it asked for and nothing else, so a room that asked for nothing
  // draws no random number at all. That a pool in the hot spring or caltrops around an altar is noise
  // on top of the one thing that room is for is still true — it is now the four side rooms saying so
  // in their own files rather than this loop saying it for them.
  //
  // The main region comes first and each thing is placed over a freshly recomputed list of free cells,
  // which is the order a seeded floor was drawn in before any of this was authorable.
  const furnished: readonly Readonly<{ block: DemoBlock; room: MapRoom }>[] = [
    { block: mainBlock, room: main },
    ...fixedSides.map((placement) => ({
      block: blockForSlot(map, placement.slot as DemoRoomSide, placement.room, main),
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

    const free = (): DemoCell[] =>
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

  // Which cells a person placed by hand, so the repair below and the refusal after it can tell a design
  // from a defect. Empty for every floor built out of generated rooms, which is every floor shipped
  // today — so nothing about how those are assembled or repaired moves.
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

  // Both the arrival and the descent stand in the main region, because descending is the main
  // region's business and a room only ever holds one thing.
  const open = walkableCells(extent, tiles, mainBlock);
  const entrance = pick(open) ?? blockCenter(mainBlock);
  clearWalkToRooms(extent, tiles, entrance, rooms);
  // After the walks to the rooms, because that pass opens hazards along them and so frees some ground
  // for nothing. The descent is drawn from cells captured before both, which is safe: neither can turn
  // open ground into anything else.
  openStrandedGround(extent, tiles, entrance, authoredCells);
  const away = open.filter((cell) => cell.x !== entrance.x || cell.y !== entrance.y);
  const exit = pick(away) ?? entrance;
  const altar = byRole.get("cursedAltar")?.center ?? entrance;
  const extraction = byRole.get("extraction")?.center ?? entrance;

  // Asked of the finished floor rather than during assembly. Whether a floor is legal is the map
  // contract's question, and folding it into the builder would leave nothing able to refuse one. Two
  // questions, because "can the stairs be reached, masonry coming down" and "is any ground cut off by
  // something that does not come down" are different and a floor has to answer both.
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
export function roomAt(maze: DemoMaze, x: number, y: number): DemoRoom | undefined {
  return maze.rooms.find((room) => x >= room.minX && y >= room.minY && x <= room.maxX && y <= room.maxY);
}

/** The region a floor's rooms hang off. Every floor has exactly one, and it hangs off nothing. */
export function mainRoom(maze: DemoMaze): DemoRoom {
  return (maze.rooms.find((room) => room.side === undefined) ?? maze.rooms[0]) as DemoRoom;
}

/**
 * The room a body standing here answers to, which is never nothing.
 *
 * A doorway punches through two wall rings that belong to neither interior, and a body crosses them
 * every time it enters a room. The region everything hangs off owns whatever is between rooms, which
 * is the whole reason it had to become a room before anything could be asked of it.
 */
export function standingRoom(maze: DemoMaze, x: number, y: number): DemoRoom {
  return roomAt(maze, x, y) ?? mainRoom(maze);
}

/**
 * Which room's pad a cell stands on, or nothing.
 *
 * A room is five cells across and its business used to run across all of it, which made the fixture
 * in the middle a decoration rather than the thing being used: you could claim the blessing standing
 * in a doorway, and the spring healed you anywhere in its room. The pad is the three cells around the
 * fixture, so what the room does happens where the room looks like it happens.
 *
 * One definition, read by the two systems that run a pad and by the scene that draws it. Three
 * separate distance checks is how the drawn extent and the working extent drift apart.
 */
export const ROOM_PAD_HALF = 1;

export function padRoomAt(maze: DemoMaze, x: number, y: number): DemoRoom | undefined {
  return maze.rooms.find(
    (room) =>
      // A pad is where a room's business stands, so a room holding no business has none. Without this
      // the main region would report one at its centre that nothing on the floor could ever use.
      room.role !== undefined &&
      Math.abs(x - room.center.x) <= ROOM_PAD_HALF &&
      Math.abs(y - room.center.y) <= ROOM_PAD_HALF,
  );
}

export function tileAt(maze: DemoMaze, x: number, y: number): DemoTile | undefined {
  return isInsideGrid(maze, x, y) ? maze.tiles[tileIndex(maze, x, y)] : undefined;
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

/** Line of sight only. You can see over a pool, a trench and a barricade — none of them stands up. */
export function blocksVision(maze: DemoMaze, x: number, y: number): boolean {
  const tile = tileAt(maze, x, y);
  return (
    tile === undefined ||
    (!isFloorKind(tile.kind) && tile.kind !== "water" && tile.kind !== "trench" && tile.kind !== "barricade")
  );
}

/**
 * What stops something thrown, shot, or knocked loose as debris.
 *
 * Barricades count and pools do not, which is what makes a barricade cover: you and whatever is
 * behind it can see each other perfectly well, and neither of you can put anything through it.
 */
export function blocksProjectile(maze: DemoMaze, x: number, y: number): boolean {
  const tile = tileAt(maze, x, y);
  return tile === undefined || (!isFloorKind(tile.kind) && tile.kind !== "water" && tile.kind !== "trench");
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

export function isTrenchCell(maze: DemoMaze, x: number, y: number): boolean {
  return tileAt(maze, x, y)?.kind === "trench";
}

/**
 * Whether spilled blood settles on a cell.
 *
 * Open water washes it away, and a filled pool is already made of what would have spilled — a stain
 * laid over the heap reads as red mud rather than as carnage. A trench takes what falls in it out of
 * sight entirely, so there is nothing on its surface to mark. Asked at both ends, where a stain is
 * recorded and where it is drawn, so the two can never disagree about a cell.
 */
export function holdsStains(maze: DemoMaze, x: number, y: number): boolean {
  const kind = tileAt(maze, x, y)?.kind;
  return kind !== "water" && kind !== "trench" && kind !== "filled" && kind !== "mortar";
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

/**
 * Somewhere to go, drawn at random from every cell a body could walk to from where it stands.
 *
 * The flood is the whole floor, which is what makes a wander a wander: a body that picks from its
 * immediate surroundings paces, and one that picks from the room it can reach crosses it. Cost is a
 * sweep of the open area, paid once when a target is chosen rather than per frame — a wanderer only
 * asks again when it has arrived.
 *
 * The start cell is never a candidate for itself, and it is not required to be walkable: a body flung
 * onto a barricade still gets asked where it is going, and the answer is somewhere off it.
 */
export function randomReachableCell(maze: DemoMaze, from: DemoCell): DemoCell | undefined {
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

/** Open cells reachable from a start cell, ignoring destructibility. Used only by enemy pathing. */
export function breadthFirstStep(maze: DemoMaze, from: DemoCell, to: DemoCell): DemoCell | undefined {
  if (from.x === to.x && from.y === to.y) {
    return undefined;
  }

  const cameFrom = new Map<number, number>();
  const queue: number[] = [tileIndex(maze, from.x, from.y)];
  const goal = tileIndex(maze, to.x, to.y);
  const seen = new Set<number>(queue);
  let found = false;
  // Read position instead of `shift()`: shifting re-indexes the whole remaining queue, which made
  // an exhaustive no-path search quadratic in the open area it swept.
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

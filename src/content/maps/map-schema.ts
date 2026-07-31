/**
 * What a map is, and the two ways one is refused.
 *
 * A map is one piece of content: a name, a grid, the rooms always standing on it, a pool the rest are
 * drawn from, and how many are drawn. A floor is one run's instance of a map, and the difference is
 * the whole reason there are two refusals here rather than one.
 *
 * **At rest, a map is a set of declarations**, and the errors visible there are contradictions between
 * them: a draw count larger than its pool, a room whose extent does not fit the slot it claims, an
 * area past the maximum, water enclosing a region in an authored room. **At load, a floor is one
 * particular draw**, and the error visible there is a property of that draw: no route from the arrival
 * to the way out. Refusing at only one end is not half the protection but the wrong protection — a
 * file that passes at rest and fails on the seventeenth run is worse than one that never saved.
 *
 * The tile and role vocabularies are declared here rather than imported from the runtime that uses
 * them, because `src/content/` may reach only content and core. They name the runtime's own eight
 * kinds and four roles and invent nothing: a map that needed a tile the game cannot walk on, see
 * through, or shoot past would be describing a game that does not exist. The half that may import
 * both is the half that holds the two lists equal.
 */

export const MAP_TILE_KINDS = ["open", "border", "stone", "wood", "water", "barricade", "filled", "mortar"] as const;

export type MapTileKind = (typeof MAP_TILE_KINDS)[number];

export const MAP_ROOM_ROLES = ["cursedAltar", "blessingAltar", "hotSpring", "extraction"] as const;

export type MapRoomRole = (typeof MAP_ROOM_ROLES)[number];

/**
 * Where a room stands on the map.
 *
 * `main` is the region every other room hangs off; the four others hang off it, one per side. A slot
 * with no room in it is simply not built and reads as boundary brick, the same as the corners the
 * assembly has always left over.
 */
export const MAP_SLOTS = ["main", "north", "south", "west", "east"] as const;

export type MapSlot = (typeof MAP_SLOTS)[number];

export const SIDE_SLOTS: readonly MapSlot[] = ["north", "south", "west", "east"];

/**
 * The most floor a map may declare.
 *
 * Measured rather than chosen: one terrain rebuild over the 1225 cells the generator produces costs
 * 0.20 ms median, which linearly would allow roughly 49,000 cells inside an 8 ms budget. That number
 * omits the browser's own per-frame work over the same area, and a limit an author can walk into
 * without noticing is worth less than an order of magnitude of headroom.
 */
export const MAX_MAP_AREA = 4096;

/** The smallest room worth declaring: a wall ring with one cell of interior. */
const MIN_ROOM_EXTENT = 3;

export type MapCrowd = Readonly<{
  /** The most bodies walking in this room at once. */
  cap: number;
  /** How many are standing there when the floor is built, before depth adds to it. */
  starting: number;
  /** Seconds between reinforcements. */
  respawnSeconds: number;
}>;

/**
 * How a room's cells come to exist.
 *
 * Generation belongs to a room and not to a map, which is what lets one map carry an authored room
 * beside a generated one without either knowing the other exists. `carved` is a backtracker run and
 * then perforated; `open` is floor throughout, which is what a room holding one piece of business
 * wants; `authored` is the cells themselves, row by row.
 */
export type MapRoomStructure =
  Readonly<{ generated: "carved" | "open" }> | Readonly<{ authored: readonly (readonly MapTileKind[])[] }>;

export type MapRoom = Readonly<{
  /** Names this room inside its map. Unique across the always-present rooms and the pool together. */
  id: string;
  /** What business it holds, when it holds any. */
  role?: MapRoomRole;
  /** Its extent in cells, wall ring included. */
  width: number;
  height: number;
  crowd: MapCrowd;
  structure: MapRoomStructure;
}>;

export type MapPlacement = Readonly<{ slot: MapSlot; room: MapRoom }>;

export type MapSource = Readonly<{
  /** The name the address bar uses. */
  name: string;
  /** The whole floor's extent in cells, boundary included. */
  width: number;
  height: number;
  /** Rooms that are always present, each with the slot it occupies. */
  fixed: readonly MapPlacement[];
  /** Rooms drawn into whichever side slots are still free. */
  pool: readonly MapRoom[];
  /** How many are drawn from that pool. Never the same room twice. */
  draw: number;
}>;

/** One run's floor, as far as the refusal below needs to see it. */
export type DrawnFloor = Readonly<{
  /** The map it came from, so a refusal says which file to open. */
  mapName: string;
  width: number;
  height: number;
  /** Row-major, one entry per cell. */
  tiles: readonly MapTileKind[];
  entrance: Readonly<{ x: number; y: number }>;
  exit: Readonly<{ x: number; y: number }>;
  /** The rooms this draw put on the floor, so a refusal names the combination that failed. */
  drawnRoomIds: readonly string[];
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function wholeNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a whole number of cells or bodies.`);
  }

  return value;
}

function parseCrowd(value: unknown, label: string): MapCrowd {
  const source = record(value, label);
  const respawnSeconds = source.respawnSeconds;

  if (typeof respawnSeconds !== "number" || !Number.isFinite(respawnSeconds) || respawnSeconds <= 0) {
    throw new TypeError(`${label}.respawnSeconds must be more than zero seconds.`);
  }

  const cap = wholeNumber(source.cap, `${label}.cap`);
  const starting = wholeNumber(source.starting, `${label}.starting`);

  if (starting > cap) {
    throw new TypeError(`${label}.starting is ${starting}, which is more than its cap of ${cap}.`);
  }

  return { cap, starting, respawnSeconds };
}

function parseAuthoredCells(
  value: unknown,
  label: string,
  width: number,
  height: number,
): readonly (readonly MapTileKind[])[] {
  if (!Array.isArray(value) || value.length !== height) {
    throw new TypeError(`${label} must hold ${height} rows, one per cell of height.`);
  }

  return value.map((rowValue, y) => {
    if (!Array.isArray(rowValue) || rowValue.length !== width) {
      throw new TypeError(`${label} row ${y} must hold ${width} cells.`);
    }

    return rowValue.map((cell, x) => {
      if (typeof cell !== "string" || !MAP_TILE_KINDS.includes(cell as MapTileKind)) {
        throw new TypeError(`${label} cell ${x},${y} must name a tile kind.`);
      }

      return cell as MapTileKind;
    });
  });
}

/**
 * Whether water cuts part of an authored room off from the rest of it.
 *
 * Crosses masonry deliberately. A wall in the way is the player's business and there are four ways to
 * open one; a pool is not, because filling one costs bodies the floor may not have yet. So a region
 * walled off is legal and a region moated off is not.
 */
function waterEnclosesRegion(cells: readonly (readonly MapTileKind[])[], width: number, height: number): boolean {
  const passable = (x: number, y: number): boolean => {
    const kind = cells[y]?.[x];
    return kind !== undefined && kind !== "water" && kind !== "border";
  };

  const queue: number[] = [];

  for (let y = 0; y < height && queue.length === 0; y += 1) {
    for (let x = 0; x < width && queue.length === 0; x += 1) {
      if (passable(x, y)) {
        queue.push(y * width + x);
      }
    }
  }

  if (queue.length === 0) {
    return false;
  }

  const seen = new Set<number>(queue);
  let head = 0;

  while (head < queue.length) {
    const current = queue[head] as number;
    head += 1;
    const currentX = current % width;
    const currentY = Math.floor(current / width);

    for (const step of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const nextX = currentX + step.x;
      const nextY = currentY + step.y;
      const next = nextY * width + nextX;

      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height || seen.has(next) || !passable(nextX, nextY)) {
        continue;
      }

      seen.add(next);
      queue.push(next);
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (passable(x, y) && !seen.has(y * width + x)) {
        return true;
      }
    }
  }

  return false;
}

function parseStructure(value: unknown, label: string, width: number, height: number): MapRoomStructure {
  const source = record(value, label);

  if (source.generated !== undefined) {
    if (source.generated !== "carved" && source.generated !== "open") {
      throw new TypeError(`${label}.generated must be carved or open.`);
    }

    return { generated: source.generated };
  }

  const authored = parseAuthoredCells(source.authored, `${label}.authored`, width, height);

  if (waterEnclosesRegion(authored, width, height)) {
    throw new TypeError(`${label}.authored has water enclosing a region no body could walk out of.`);
  }

  return { authored };
}

function parseRoom(value: unknown, label: string): MapRoom {
  const source = record(value, label);

  if (typeof source.id !== "string" || source.id.length === 0) {
    throw new TypeError(`${label}.id must name the room.`);
  }

  const width = wholeNumber(source.width, `${label}.width`);
  const height = wholeNumber(source.height, `${label}.height`);

  if (width < MIN_ROOM_EXTENT || height < MIN_ROOM_EXTENT) {
    throw new TypeError(
      `${label} is ${width} by ${height}, which leaves no interior inside its wall ring; ${MIN_ROOM_EXTENT} is the smallest either side may be.`,
    );
  }

  if (source.role !== undefined && !MAP_ROOM_ROLES.includes(source.role as MapRoomRole)) {
    throw new TypeError(`${label}.role must name a room role.`);
  }

  return {
    id: source.id,
    ...(source.role === undefined ? {} : { role: source.role as MapRoomRole }),
    width,
    height,
    crowd: parseCrowd(source.crowd, `${label}.crowd`),
    structure: parseStructure(source.structure, `${label}.structure`, width, height),
  };
}

function parsePlacement(value: unknown, label: string): MapPlacement {
  const source = record(value, label);

  if (typeof source.slot !== "string" || !MAP_SLOTS.includes(source.slot as MapSlot)) {
    throw new TypeError(`${label}.slot must name one of the map's slots.`);
  }

  return { slot: source.slot as MapSlot, room: parseRoom(source.room, `${label}.room`) };
}

/**
 * Checks a side room against the region it hangs off.
 *
 * The assembly places the main region centred in the grid and each side room flush against its own
 * grid edge, centred on the other axis. Both of those are whole-cell placements or they are nothing,
 * so the leftover space has to divide in two — a room half a cell off centre is a room whose drawn
 * extent and walked extent disagree, which is the class of bug this validation exists to make loud.
 */
function checkSideFit(map: MapSource, main: MapRoom, room: MapRoom, slot: MapSlot): void {
  const vertical = slot === "north" || slot === "south";
  const along = vertical ? room.height : room.width;
  const across = vertical ? room.width : room.height;
  const mainAlong = vertical ? main.height : main.width;
  const mainAcross = vertical ? main.width : main.height;
  const gridAlong = vertical ? map.height : map.width;
  const margin = (gridAlong - mainAlong) / 2;

  if (!Number.isInteger(margin) || margin < 0) {
    throw new TypeError(
      `Map "${map.name}" cannot centre its main region: ${gridAlong} cells with a ${mainAlong}-cell region leaves ${gridAlong - mainAlong} to split in two.`,
    );
  }

  if (along > margin) {
    throw new TypeError(
      `Map "${map.name}" room "${room.id}" is ${along} cells deep and the ${slot} slot has room for ${margin}.`,
    );
  }

  if (across > mainAcross || !Number.isInteger((mainAcross - across) / 2)) {
    throw new TypeError(
      `Map "${map.name}" room "${room.id}" is ${across} cells across and cannot sit centred on a ${mainAcross}-cell region.`,
    );
  }
}

/**
 * Reads a map and refuses one that cannot produce a legal floor from what it declares.
 *
 * Answers the same shape it was handed. The authoring endpoint writes this return value verbatim, so
 * a validator that helpfully reshapes its input writes a file its own next load rejects — which has
 * already taken the debug hub down once, through a different table.
 */
export function parseMapSource(value: unknown): MapSource {
  const source = record(value, "map");

  if (typeof source.name !== "string" || !/^[a-z][\da-z-]*$/.test(source.name)) {
    throw new TypeError("map.name must be a lowercase slug, because it is what the address bar carries.");
  }

  const name = source.name;
  const width = wholeNumber(source.width, `Map "${name}" width`);
  const height = wholeNumber(source.height, `Map "${name}" height`);
  const area = width * height;

  if (area > MAX_MAP_AREA) {
    throw new TypeError(
      `Map "${name}" declares ${width} by ${height}, which is ${area} cells against a maximum of ${MAX_MAP_AREA}.`,
    );
  }

  if (!Array.isArray(source.fixed)) {
    throw new TypeError(`Map "${name}" must list the rooms that are always present, even if the list is empty.`);
  }

  if (!Array.isArray(source.pool)) {
    throw new TypeError(`Map "${name}" must list its pool, even if the pool is empty.`);
  }

  const fixed = source.fixed.map((entry, index) => parsePlacement(entry, `Map "${name}" fixed[${index}]`));
  const pool = source.pool.map((entry, index) => parseRoom(entry, `Map "${name}" pool[${index}]`));
  const draw = wholeNumber(source.draw, `Map "${name}" draw`);

  if (draw > pool.length) {
    throw new TypeError(`Map "${name}" draws ${draw} rooms from a pool of ${pool.length}.`);
  }

  const ids = new Set<string>();

  for (const room of [...fixed.map((placement) => placement.room), ...pool]) {
    if (ids.has(room.id)) {
      throw new TypeError(`Map "${name}" names two rooms "${room.id}".`);
    }

    ids.add(room.id);
  }

  const takenSlots = new Set<MapSlot>();

  for (const placement of fixed) {
    if (takenSlots.has(placement.slot)) {
      throw new TypeError(`Map "${name}" puts two rooms in its ${placement.slot} slot.`);
    }

    takenSlots.add(placement.slot);
  }

  const main = fixed.find((placement) => placement.slot === "main")?.room;

  if (!main) {
    throw new TypeError(
      `Map "${name}" has no main region, so it has nothing to hang a room off and nowhere to arrive.`,
    );
  }

  const freeSideSlots = SIDE_SLOTS.filter((slot) => !takenSlots.has(slot));

  if (draw > freeSideSlots.length) {
    throw new TypeError(
      `Map "${name}" draws ${draw} rooms into ${freeSideSlots.length} free slots, so a drawn room would have nowhere to stand.`,
    );
  }

  const parsed: MapSource = { name, width, height, fixed, pool, draw };

  // Every room that could land in a side slot is checked against every slot it could land in: which
  // one it gets is drawn, so a fit that holds for three of the four is a floor that fails at random.
  for (const placement of fixed) {
    if (placement.slot !== "main") {
      checkSideFit(parsed, main, placement.room, placement.slot);
    }
  }

  for (const room of pool) {
    for (const slot of freeSideSlots) {
      checkSideFit(parsed, main, room, slot);
    }
  }

  return parsed;
}

/**
 * Refuses a floor one particular draw has produced.
 *
 * The declarations were checked when the file was saved and nothing here re-checks them. What is only
 * visible now is whether this combination of rooms happens to leave a route from where the run arrives
 * to the way out — a route that may have to be broken through, because masonry is the player's
 * business and there are four ways to open one. Only the boundary stops this search, which is the same
 * thing that stops the player.
 */
export function validateDrawnFloor(floor: DrawnFloor): void {
  const { width, height, tiles } = floor;
  const drawn = floor.drawnRoomIds.length > 0 ? floor.drawnRoomIds.join(", ") : "no drawn rooms";
  const index = (x: number, y: number): number => y * width + x;
  const passable = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && tiles[index(x, y)] !== "border";

  if (!passable(floor.entrance.x, floor.entrance.y)) {
    throw new TypeError(`Map "${floor.mapName}" drew a floor whose arrival stands in the boundary (${drawn}).`);
  }

  const goal = index(floor.exit.x, floor.exit.y);
  const queue: number[] = [index(floor.entrance.x, floor.entrance.y)];
  const seen = new Set<number>(queue);
  let head = 0;

  while (head < queue.length) {
    const current = queue[head] as number;
    head += 1;

    if (current === goal) {
      return;
    }

    const currentX = current % width;
    const currentY = Math.floor(current / width);

    for (const step of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const nextX = currentX + step.x;
      const nextY = currentY + step.y;

      if (!passable(nextX, nextY) || seen.has(index(nextX, nextY))) {
        continue;
      }

      seen.add(index(nextX, nextY));
      queue.push(index(nextX, nextY));
    }
  }

  throw new TypeError(`Map "${floor.mapName}" drew a floor with no route to the way out (${drawn}).`);
}

/**
 * What a map is, and the two ways one is refused.
 *
 * A map is one piece of content: a name, a grid, the names of the rooms always standing on it, a pool
 * of names the rest are drawn from, and how many are drawn. A floor is one run's instance of a map, and
 * the difference is the whole reason there are two refusals here rather than one.
 *
 * **At rest, a map is a set of declarations**, and the errors visible there are contradictions between
 * them: a draw count larger than its pool, two rooms in one slot, an area past the maximum. **At load,
 * a floor is one particular draw**, and the error visible there is a property of that draw: no route
 * from the arrival to the way out. Refusing at only one end is not half the protection but the wrong
 * protection — a file that passes at rest and fails on the seventeenth run is worse than one that never
 * saved.
 *
 * **A map file holds names, so this file answers names.** The authoring endpoint writes a validator's
 * return value verbatim into the file it validated, so a validator that resolved names into rooms would
 * write a map naming no rooms, which its own next load would refuse. Turning names into rooms — and
 * every refusal that needs to see an extent — belongs to `map-resolver.ts`.
 */

import type { MapTileKind } from "./room-schema";

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

/** What a map's name may look like. It is what the address bar carries and what its file is called. */
export const MAP_NAME_PATTERN = /^[a-z][\da-z-]*$/;

/** A slot, and the name of the room standing in it. */
export type MapPlacement = Readonly<{ slot: MapSlot; room: string }>;

export type MapSource = Readonly<{
  /** The name the address bar uses. */
  name: string;
  /** The whole floor's extent in cells, boundary included. */
  width: number;
  height: number;
  /** Rooms that are always present, each named, with the slot it occupies. */
  fixed: readonly MapPlacement[];
  /** The names rooms are drawn from into whichever side slots are still free. */
  pool: readonly string[];
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

function roomName(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must name a room.`);
  }

  return value;
}

function parsePlacement(value: unknown, label: string): MapPlacement {
  const source = record(value, label);

  if (typeof source.slot !== "string" || !MAP_SLOTS.includes(source.slot as MapSlot)) {
    throw new TypeError(`${label}.slot must name one of the map's slots.`);
  }

  return { slot: source.slot as MapSlot, room: roomName(source.room, `${label}.room`) };
}

/**
 * Reads a map file and refuses one that contradicts itself.
 *
 * Answers the same shape it was handed. The authoring endpoint writes this return value verbatim, so a
 * validator that helpfully reshaped its input — names into rooms, say — writes a file its own next load
 * will reject, and the failure lands on whoever opens the tool afterwards rather than on whoever saved.
 *
 * Everything decidable from names alone is decided here. Everything needing an extent — whether a room
 * exists at all, and whether it fits the slot it could land in — belongs to the resolver.
 */
export function parseMapSource(value: unknown): MapSource {
  const source = record(value, "map");

  if (typeof source.name !== "string" || !MAP_NAME_PATTERN.test(source.name)) {
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
  const pool = source.pool.map((entry, index) => roomName(entry, `Map "${name}" pool[${index}]`));
  const draw = wholeNumber(source.draw, `Map "${name}" draw`);

  if (draw > pool.length) {
    throw new TypeError(`Map "${name}" draws ${draw} rooms from a pool of ${pool.length}.`);
  }

  const named = new Set<string>();

  for (const room of [...fixed.map((placement) => placement.room), ...pool]) {
    if (named.has(room)) {
      throw new TypeError(`Map "${name}" names two rooms "${room}".`);
    }

    named.add(room);
  }

  const takenSlots = new Set<MapSlot>();

  for (const placement of fixed) {
    if (takenSlots.has(placement.slot)) {
      throw new TypeError(`Map "${name}" puts two rooms in its ${placement.slot} slot.`);
    }

    takenSlots.add(placement.slot);
  }

  if (!fixed.some((placement) => placement.slot === "main")) {
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

  return { name, width, height, fixed, pool, draw };
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

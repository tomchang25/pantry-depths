/**
 * What a room is, on its own.
 *
 * A room is the unit that gets reused — a boss room, an arena, a corridor — so it is a file rather than
 * a passage inside the one map that happens to want it. A room locked inside a map has to be copied to
 * be used twice, and every later edit is then two edits.
 *
 * Everything here is decidable by looking at the room alone: its extent, the business it holds, the
 * crowd it keeps if it keeps one, and how its cells come to exist. Whether it fits the slot some map
 * could drop it into is not — that needs the map, and it lives with the resolver.
 *
 * The tile and role vocabularies are declared here rather than imported from the runtime that uses
 * them, because `src/content/` may reach only content and core. They name the runtime's own eight kinds
 * and four roles and invent nothing: a room that needed a tile the game cannot walk on, see through, or
 * shoot past would be describing a game that does not exist. The half that may import both is the half
 * that holds the two lists equal.
 *
 * The kit that lies on a floor is the exception, and only because it already had a home: its kinds are
 * the presentation layer's, which is content, so they are imported rather than restated.
 */

import { PROP_KINDS, type PropKind } from "@/content/presentation/prop-display-schema";

export const MAP_TILE_KINDS = ["open", "border", "stone", "wood", "water", "barricade", "filled", "mortar"] as const;

export type MapTileKind = (typeof MAP_TILE_KINDS)[number];

export const MAP_ROOM_ROLES = ["cursedAltar", "blessingAltar", "hotSpring", "extraction"] as const;

export type MapRoomRole = (typeof MAP_ROOM_ROLES)[number];

/** The smallest room worth declaring: a wall ring with one cell of interior. */
const MIN_ROOM_EXTENT = 3;

/** What a room's identity may look like. The same shape a map name takes, and for the same reason. */
export const ROOM_ID_PATTERN = /^[a-z][\da-z-]*$/;

/**
 * A number a room states, which may be one value or two ends to choose between.
 *
 * The bare number stays legal and stays the common case, because most quantities have one right value
 * and a range around it would be noise. What the range buys is the quantities that should not be
 * identical on every floor.
 *
 * The two forms are kept as written rather than normalised into one, because the authoring endpoint
 * writes a validator's return value verbatim into the file it validated — a reader that helpfully
 * turned every number into a range would rewrite every file it touched.
 */
export type MapRange = Readonly<{ minimum: number; maximum: number }>;

export type MapQuantity = number | MapRange;

/**
 * What is scattered into a room, beyond the bodies walking in it.
 *
 * Optional throughout, and absent means none of that thing — the same rule the crowd follows, for the
 * same reason: a room meant to hold nothing needs a way to say so, and a count of zero is a different
 * statement from an absence.
 *
 * Loose kit is the odd one out and deliberately so. The other three are placed inside one room's own
 * block; kit is scattered across the whole floor from one pool of cells, side rooms included. It is
 * therefore declared by whichever room stands in a map's main slot and applies to the floor, not to
 * that room — making it per-room would move every piece of kit on every floor a seed has ever drawn.
 */
export type MapScatter = Readonly<{
  /** How many pools, and how many cells each grows to. */
  pools?: Readonly<{ count: MapQuantity; size: MapQuantity }>;
  barricades?: MapQuantity;
  mortars?: MapQuantity;
  /** How much of each kind lies on the floor. Read only from a map's main room. */
  props?: Readonly<Partial<Record<PropKind, MapQuantity>>>;
}>;

/**
 * How bodies keep coming, when they do.
 *
 * Optional on the crowd, and the absence is a statement an author can mean: a room whose bodies stand
 * once and are never replaced. Both numbers are rolled at each arrival rather than once per floor, so a
 * range here reads as "somewhere between four and six seconds" rather than "this floor's rate".
 */
export type MapReinforcement = Readonly<{
  /** Seconds between arrivals. */
  every: MapQuantity;
  /** How many arrive at once. Fewer come if the cap has no room for them. */
  count: MapQuantity;
}>;

export type MapCrowd = Readonly<{
  /**
   * The most bodies walking in this room at once.
   *
   * Exact rather than a quantity, deliberately: a cap is a promise about the room, and a promise that
   * is rolled for is not one.
   */
  cap: number;
  /** How many are standing there when the floor is built, before depth adds to it. */
  starting: MapQuantity;
  reinforcement?: MapReinforcement;
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
  /**
   * Names this room across the whole library, and is what its file is called.
   *
   * A slug rather than any string, because a map names it and the authoring endpoint addresses it: an
   * id that cannot be a filename is a room nothing could ever open.
   */
  id: string;
  /** What business it holds, when it holds any. */
  role?: MapRoomRole;
  /** Its extent in cells, wall ring included. */
  width: number;
  height: number;
  /**
   * How many bodies live here, when any do.
   *
   * Optional, and the omission is the point: a room that holds nobody has no honest way to say so with
   * three required numbers. A cap of zero paired with a respawn interval still declares a rate for
   * something that never happens, which is a different statement from "nothing lives here".
   */
  crowd?: MapCrowd;
  /** What is put on its floor beyond the bodies. Absent means nothing is. */
  scatter?: MapScatter;
  structure: MapRoomStructure;
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

/** Seconds, which unlike a count of things may be a fraction of one. */
function positiveSeconds(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be more than zero seconds.`);
  }

  return value;
}

/**
 * Either form of a quantity, over whatever a single value has to satisfy.
 *
 * The check is a parameter because a count of caltrops and a number of seconds are both quantities and
 * are not the same kind of number — one is whole, the other may be a fraction — and a reader that
 * insisted on whole seconds would tighten a rule nobody asked to have tightened.
 */
function parseQuantityWith(
  value: unknown,
  label: string,
  readNumber: (value: unknown, label: string) => number,
): MapQuantity {
  if (typeof value === "number") {
    return readNumber(value, label);
  }

  const source = record(value, label);
  const minimum = readNumber(source.minimum, `${label}.minimum`);
  const maximum = readNumber(source.maximum, `${label}.maximum`);

  if (minimum > maximum) {
    throw new TypeError(`${label} runs from ${minimum} down to ${maximum}, which is no range at all.`);
  }

  return { minimum, maximum };
}

function parseQuantity(value: unknown, label: string): MapQuantity {
  return parseQuantityWith(value, label, wholeNumber);
}

function parseSeconds(value: unknown, label: string): MapQuantity {
  return parseQuantityWith(value, label, positiveSeconds);
}

function parseProps(value: unknown, label: string): Readonly<Partial<Record<PropKind, MapQuantity>>> {
  const source = record(value, label);
  const parsed: Partial<Record<PropKind, MapQuantity>> = {};

  // Walked in the file's own order rather than the vocabulary's, because the order kit is scattered in
  // is the order it is written in, and a reader that sorted it would move every piece on a seeded floor.
  for (const [kind, quantity] of Object.entries(source)) {
    if (!PROP_KINDS.includes(kind as PropKind)) {
      throw new TypeError(`${label} names "${kind}", which is not a kind of thing that lies on a floor.`);
    }

    parsed[kind as PropKind] = parseQuantity(quantity, `${label}.${kind}`);
  }

  return parsed;
}

function parseScatter(value: unknown, label: string): MapScatter {
  const source = record(value, label);

  return {
    ...(source.pools === undefined
      ? {}
      : {
          pools: {
            count: parseQuantity(record(source.pools, `${label}.pools`).count, `${label}.pools.count`),
            size: parseQuantity(record(source.pools, `${label}.pools`).size, `${label}.pools.size`),
          },
        }),
    ...(source.barricades === undefined ? {} : { barricades: parseQuantity(source.barricades, `${label}.barricades`) }),
    ...(source.mortars === undefined ? {} : { mortars: parseQuantity(source.mortars, `${label}.mortars`) }),
    ...(source.props === undefined ? {} : { props: parseProps(source.props, `${label}.props`) }),
  };
}

/** The largest a quantity can come out, which is what a cap has to be checked against. */
function most(quantity: MapQuantity): number {
  return typeof quantity === "number" ? quantity : quantity.maximum;
}

function parseReinforcement(value: unknown, label: string): MapReinforcement {
  const source = record(value, label);

  return {
    every: parseSeconds(source.every, `${label}.every`),
    count: parseQuantity(source.count, `${label}.count`),
  };
}

function parseCrowd(value: unknown, label: string): MapCrowd {
  const source = record(value, label);
  const cap = wholeNumber(source.cap, `${label}.cap`);
  const starting = parseQuantity(source.starting, `${label}.starting`);

  if (most(starting) > cap) {
    throw new TypeError(`${label}.starting can be as many as ${most(starting)}, which is more than its cap of ${cap}.`);
  }

  return {
    cap,
    starting,
    ...(source.reinforcement === undefined
      ? {}
      : { reinforcement: parseReinforcement(source.reinforcement, `${label}.reinforcement`) }),
  };
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

/**
 * Reads one room file and refuses one that could not be built.
 *
 * Answers the same shape the file holds, because the authoring endpoint writes this return value
 * verbatim into the file it validated. A parser that helpfully reshaped its input would write a file
 * its own next load rejects.
 */
export function parseRoomSource(value: unknown): MapRoom {
  const source = record(value, "room");

  if (typeof source.id !== "string" || !ROOM_ID_PATTERN.test(source.id)) {
    throw new TypeError(
      "room.id must be a lowercase slug, because it is what a map names and what its file is called.",
    );
  }

  const id = source.id;
  const label = `Room "${id}"`;
  const width = wholeNumber(source.width, `${label} width`);
  const height = wholeNumber(source.height, `${label} height`);

  if (width < MIN_ROOM_EXTENT || height < MIN_ROOM_EXTENT) {
    throw new TypeError(
      `${label} is ${width} by ${height}, which leaves no interior inside its wall ring; ${MIN_ROOM_EXTENT} is the smallest either side may be.`,
    );
  }

  if (source.role !== undefined && !MAP_ROOM_ROLES.includes(source.role as MapRoomRole)) {
    throw new TypeError(`${label} role must name a room role.`);
  }

  return {
    id,
    ...(source.role === undefined ? {} : { role: source.role as MapRoomRole }),
    width,
    height,
    ...(source.crowd === undefined ? {} : { crowd: parseCrowd(source.crowd, `${label} crowd`) }),
    ...(source.scatter === undefined ? {} : { scatter: parseScatter(source.scatter, `${label} scatter`) }),
    structure: parseStructure(source.structure, `${label} structure`, width, height),
  };
}

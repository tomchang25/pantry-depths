/**
 * Reading a room from a file, and refusing a file that lies.
 *
 * What a room *is* lives in `@/core/room-contract` — the tile, role, cast, crowd, scatter, and
 * structure vocabulary is core's, because it is the contract the rules assemble floors from. What
 * lives here is the content layer's half: parsing authored JSON into those contracts, the identity
 * pattern a room's filename must satisfy, and the validation that only an author's own cells can
 * answer. The authoring endpoint writes these parsers' return values verbatim into the files they
 * validated, which is why they answer exactly the shape they were handed.
 */

import { PROP_KINDS, type PropKind } from "@/core/prop-kinds";
import {
  MAP_CAST_KINDS,
  MAP_ROOM_ROLES,
  MAP_TILE_KINDS,
  UNFILLABLE_GROUND,
  type MapCastKind,
  type MapCastMember,
  type MapCrowd,
  type MapQuantity,
  type MapReinforcement,
  type MapRoom,
  type MapRoomRole,
  type MapRoomStructure,
  type MapScatter,
  type MapTileKind,
  type MapWallMix,
} from "@/core/floor/room-contract";

/** The smallest room worth declaring: a wall ring with one cell of interior. */
const MIN_ROOM_EXTENT = 3;

/** What a room's identity may look like. The same shape a map name takes, and for the same reason. */
export const ROOM_ID_PATTERN = /^[a-z][\da-z-]*$/;

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

/** One side of a ratio. Any non-negative number, because the pair is normalised rather than checked. */
function positiveOrZero(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be zero or more.`);
  }

  return value;
}

/** A share of something, which is a fraction between none of it and all of it. */
function unitInterval(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`${label} must be a share between 0 and 1.`);
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
            share: unitInterval(record(source.pools, `${label}.pools`).share, `${label}.pools.share`),
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

/**
 * The bodies a room stands, refusing only what the file alone can decide.
 *
 * Two refusals and no more: a cell outside the room's interior, and two bodies on one cell. Whether a
 * cell is floor is not decidable here — a carved room's cells are a property of one assembly — and it
 * is not always a mistake either: a body standing in water drowns on arrival, which an author placing
 * one there may be doing on purpose.
 */
function parseCast(value: unknown, label: string, width: number, height: number): readonly MapCastMember[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be a list of bodies.`);
  }

  const taken = new Set<string>();

  return value.map((entry, index) => {
    const source = record(entry, `${label}[${index}]`);

    if (typeof source.kind !== "string" || !MAP_CAST_KINDS.includes(source.kind as MapCastKind)) {
      throw new TypeError(`${label}[${index}] must name a kind of body that stands on a floor.`);
    }

    const x = wholeNumber(source.x, `${label}[${index}].x`);
    const y = wholeNumber(source.y, `${label}[${index}].y`);

    // The interior is one cell in from each edge, which is what the assembly paints for every
    // structure kind. A body on the wall ring is a body in the masonry.
    if (x < 1 || y < 1 || x > width - 2 || y > height - 2) {
      throw new TypeError(`${label}[${index}] stands at ${x},${y}, which is outside this room's interior.`);
    }

    const cell = `${x},${y}`;

    if (taken.has(cell)) {
      throw new TypeError(`${label} stands two bodies on ${cell}, and a cell holds one.`);
    }

    taken.add(cell);
    return { kind: source.kind as MapCastKind, x, y };
  });
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
 * open one; unfillable ground is not, because closing a pool costs bodies the floor may not have yet
 * and closing a trench is impossible. So a region walled off is legal and a region moated off is not.
 *
 * **This answers a question; it no longer refuses the file.** It used to, on the grounds that a sealed
 * region is an unwinnable floor — but that is true of a generator's mistake and not of an author's
 * decision. An island in the middle of a pool is a floor that costs bodies to reach, which is a design;
 * the same shape arrived at by a generator is a floor nobody meant, which is a defect. The project
 * already draws that line for unfillable ground itself — a generator may not place it and an author
 * may — and this is the same line one step further out.
 *
 * So the refusal moved to where it can tell the two apart: the assembly repairs and refuses stranded
 * ground in generated rooms, and leaves an authored room's cells exactly as they were painted. What is
 * left here is a warning an editor shows while an author paints, which is the moment it is useful.
 */
export function unfillableEnclosesRegion(
  cells: readonly (readonly MapTileKind[])[],
  width: number,
  height: number,
): boolean {
  const passable = (x: number, y: number): boolean => {
    const kind = cells[y]?.[x];
    return kind !== undefined && kind !== "border" && !UNFILLABLE_GROUND.includes(kind);
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

function parseWallMix(value: unknown, label: string): MapWallMix {
  const source = record(value, label);
  const stone = positiveOrZero(source.stone, `${label}.stone`);
  const wood = positiveOrZero(source.wood, `${label}.wood`);

  if (stone + wood === 0) {
    throw new TypeError(`${label} asks for neither stone nor timber, so a wall would be made of nothing.`);
  }

  return { stone, wood };
}

function parseStructure(value: unknown, label: string, width: number, height: number): MapRoomStructure {
  const source = record(value, label);

  if (source.generated !== undefined) {
    if (source.generated !== "carved" && source.generated !== "open") {
      throw new TypeError(`${label}.generated must be carved or open.`);
    }

    if (source.generated === "open") {
      // Refused rather than ignored. A room that is floor throughout has no walls to make and nothing
      // to open up, so either field on one is an author describing a room they did not write.
      if (source.openShare !== undefined || source.walls !== undefined) {
        throw new TypeError(`${label} is open floor throughout, so it has no openShare and no walls to mix.`);
      }

      return { generated: "open" };
    }

    return {
      generated: "carved",
      openShare: unitInterval(source.openShare, `${label}.openShare`),
      walls: parseWallMix(source.walls, `${label}.walls`),
    };
  }

  // Deliberately not refused for enclosing a region. See `unfillableEnclosesRegion`: an author sealing
  // one off is a design the assembly honours, and a generator doing it is a defect the assembly repairs.
  return { authored: parseAuthoredCells(source.authored, `${label}.authored`, width, height) };
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
    // Returned, not merely read: the authoring endpoint writes this value verbatim into the file it
    // validated, so a cast parsed and dropped here is a cast the next save silently deletes.
    ...(source.cast === undefined ? {} : { cast: parseCast(source.cast, `${label} cast`, width, height) }),
    ...(source.scatter === undefined ? {} : { scatter: parseScatter(source.scatter, `${label} scatter`) }),
    structure: parseStructure(source.structure, `${label} structure`, width, height),
  };
}

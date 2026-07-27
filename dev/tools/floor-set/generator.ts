import type { Cell, Facing } from "@/core/grid";
import type { KeyColor } from "@/core/run-state";
import type { FloorSetSource, FloorSource, GameplayEntitySource } from "@/content/floor/floor-schema";
import { validateParsedFloorSet } from "@/content/floor/floor-validation";

export type FloorSetGenerationOptions = Readonly<{
  seed: number;
  floorCount: number;
  width?: number;
  height?: number;
  redKeys?: number;
  redDoors?: number;
  blueKeys?: number;
  blueDoors?: number;
  yellowKeys?: number;
  yellowDoors?: number;
  enemies?: number;
}>;

type ColorCounts = Readonly<{ keys: number; doors: number }>;

type ResolvedOptions = Readonly<{
  seed: number;
  floorCount: number;
  width: number;
  height: number;
  colorCounts: Readonly<Record<KeyColor, ColorCounts>>;
  enemies: number;
}>;

type FloorAllocation = Readonly<{
  colorCounts: Readonly<Record<KeyColor, ColorCounts>>;
  enemies: number;
}>;

type FloorPlan = Readonly<{
  passable: Uint8Array;
  entryIndex: number;
  exitIndex: number;
  route: readonly number[];
}>;

/** Signals that one attempt ran out of legal placement room and the caller should reseed. */
class PlacementExhaustedError extends Error {}

const ENTRY_CELL: Cell = { x: 1, y: 1 };
const ARRIVAL_FACING: Facing = "east";
const KEY_COLORS: readonly KeyColor[] = ["red", "blue", "yellow"];
const ENEMY_ARCHETYPE_IDS: readonly string[] = ["bat", "goblin", "skeleton", "guard"];
const GOAL_ARCHETYPE_ID = "princess";
const THEMES: readonly string[] = ["cellar", "icehouse", "meat-locker", "guard-post", "deep-store"];
const MAZE_STEPS: readonly Cell[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
const UNVISITED = -2;
const ROOT = -1;
const MAX_ATTEMPTS = 32;
const DEFAULT_DIMENSION = 13;
const MIN_DIMENSION = 5;
const DEFAULT_KEYS_PER_COLOR = 1;
const DEFAULT_DOORS_PER_COLOR = 1;
const DEFAULT_ENEMIES = 1;
const EMPTY_BLOCKED: ReadonlySet<number> = new Set<number>();

function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 2 ** 32;
  };
}

function pickIndex(random: () => number, length: number): number {
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
}

/** Fisher-Yates shuffle using the generator's own seeded random, so the order stays deterministic. */
function shuffle<Value>(values: readonly Value[], random: () => number): Value[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = pickIndex(random, index + 1);
    const current = shuffled[index];
    const swapped = shuffled[swapIndex];

    if (current !== undefined && swapped !== undefined) {
      shuffled[index] = swapped;
      shuffled[swapIndex] = current;
    }
  }

  return shuffled;
}

/** Spreads exactly `total` units across floors via a shuffled cycle, so no run always favors the first floors. */
function distributeAcrossFloors(random: () => number, total: number, floorCount: number): readonly number[] {
  const counts = Array.from<number>({ length: Math.max(0, floorCount) }).fill(0);

  if (total <= 0 || floorCount <= 0) {
    return counts;
  }

  const order = shuffle(
    Array.from({ length: floorCount }, (_value, index) => index),
    random,
  );

  for (let unit = 0; unit < total; unit += 1) {
    const floor = order[unit % floorCount];

    if (floor !== undefined) {
      counts[floor] = (counts[floor] ?? 0) + 1;
    }
  }

  return counts;
}

/**
 * Converts candidate-wide totals into per-floor, per-color counts.
 *
 * Each color's matching key/door pairs are distributed together so a floor that receives a pair can gate
 * with it; only the leftover on whichever side is larger is distributed independently as unpaired spares.
 */
function allocateAcrossFloors(random: () => number, resolved: ResolvedOptions): readonly FloorAllocation[] {
  const perFloorColorCounts: Record<KeyColor, ColorCounts>[] = Array.from({ length: resolved.floorCount }, () => ({
    red: { keys: 0, doors: 0 },
    blue: { keys: 0, doors: 0 },
    yellow: { keys: 0, doors: 0 },
  }));

  for (const color of KEY_COLORS) {
    const { keys, doors } = resolved.colorCounts[color];
    const pairCount = Math.min(keys, doors);
    const leftoverKeys = keys - pairCount;
    const leftoverDoors = doors - pairCount;

    const pairAllocation = distributeAcrossFloors(random, pairCount, resolved.floorCount);
    const leftoverKeyAllocation = distributeAcrossFloors(random, leftoverKeys, resolved.floorCount);
    const leftoverDoorAllocation = distributeAcrossFloors(random, leftoverDoors, resolved.floorCount);

    for (let floor = 0; floor < resolved.floorCount; floor += 1) {
      const floorCounts = perFloorColorCounts[floor];

      if (!floorCounts) {
        continue;
      }

      floorCounts[color] = {
        keys: (pairAllocation[floor] ?? 0) + (leftoverKeyAllocation[floor] ?? 0),
        doors: (pairAllocation[floor] ?? 0) + (leftoverDoorAllocation[floor] ?? 0),
      };
    }
  }

  const enemyAllocation = distributeAcrossFloors(random, resolved.enemies, resolved.floorCount);

  return perFloorColorCounts.map((colorCounts, floor) => ({
    colorCounts,
    enemies: enemyAllocation[floor] ?? 0,
  }));
}

function toIndex(cell: Cell, width: number): number {
  return cell.y * width + cell.x;
}

function toCell(index: number, width: number): Cell {
  return { x: index % width, y: Math.floor(index / width) };
}

function isPassable(passable: Uint8Array, index: number): boolean {
  return passable[index] === 1;
}

function neighbourIndices(index: number, width: number, height: number): readonly number[] {
  const cell = toCell(index, width);

  return MAZE_STEPS.map((step) => ({ x: cell.x + step.x, y: cell.y + step.y }))
    .filter((candidate) => candidate.x >= 0 && candidate.x < width && candidate.y >= 0 && candidate.y < height)
    .map((candidate) => toIndex(candidate, width));
}

/** Carves a perfect corridor maze whose nodes sit on odd coordinates inside a solid border. */
function carveMaze(random: () => number, width: number, height: number): Uint8Array {
  const passable = new Uint8Array(width * height);
  const stack: Cell[] = [ENTRY_CELL];
  passable[toIndex(ENTRY_CELL, width)] = 1;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];

    if (!current) {
      break;
    }

    const candidates = MAZE_STEPS.map((step) => ({
      node: { x: current.x + step.x * 2, y: current.y + step.y * 2 },
      wall: { x: current.x + step.x, y: current.y + step.y },
    })).filter(
      (candidate) =>
        candidate.node.x > 0 &&
        candidate.node.x < width - 1 &&
        candidate.node.y > 0 &&
        candidate.node.y < height - 1 &&
        !isPassable(passable, toIndex(candidate.node, width)),
    );

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const chosen = candidates[pickIndex(random, candidates.length)];

    if (!chosen) {
      stack.pop();
      continue;
    }

    passable[toIndex(chosen.wall, width)] = 1;
    passable[toIndex(chosen.node, width)] = 1;
    stack.push(chosen.node);
  }

  return passable;
}

/** Largest odd room edge that still fits inside a bordered interior of the given dimension, or 0 if none fits. */
function maxOddRoomSize(dimension: number): number {
  const maxSize = dimension - 2;

  if (maxSize < 3) {
    return 0;
  }

  return maxSize % 2 === 0 ? maxSize - 1 : maxSize;
}

/** Opens a few odd-aligned rectangles so the maze gains open rooms without losing connectivity. */
function carveRooms(passable: Uint8Array, random: () => number, width: number, height: number): void {
  const maxSize = maxOddRoomSize(Math.min(width, height));

  if (maxSize < 3) {
    return;
  }

  const roomCount = 2 + pickIndex(random, 2);

  for (let room = 0; room < roomCount; room += 1) {
    const size = Math.min(3 + 2 * pickIndex(random, 2), maxSize);
    const startsX = Math.floor((width - 2 - size) / 2) + 1;
    const startsY = Math.floor((height - 2 - size) / 2) + 1;
    const originX = 1 + 2 * pickIndex(random, startsX);
    const originY = 1 + 2 * pickIndex(random, startsY);

    for (let y = originY; y < originY + size; y += 1) {
      for (let x = originX; x < originX + size; x += 1) {
        passable[toIndex({ x, y }, width)] = 1;
      }
    }
  }
}

/** Breadth-first parent map from one origin, treating blocked indices as impassable. */
function traverse(
  passable: Uint8Array,
  originIndex: number,
  blocked: ReadonlySet<number>,
  width: number,
  height: number,
): Int32Array {
  const parents = new Int32Array(width * height).fill(UNVISITED);
  const queue: number[] = [originIndex];
  parents[originIndex] = ROOT;
  let head = 0;

  while (head < queue.length) {
    const current = queue[head];
    head += 1;

    if (current === undefined) {
      continue;
    }

    for (const neighbour of neighbourIndices(current, width, height)) {
      if (!isPassable(passable, neighbour) || blocked.has(neighbour) || parents[neighbour] !== UNVISITED) {
        continue;
      }

      parents[neighbour] = current;
      queue.push(neighbour);
    }
  }

  return parents;
}

function reachableIndices(parents: Int32Array): readonly number[] {
  const reachable: number[] = [];

  for (let index = 0; index < parents.length; index += 1) {
    if (parents[index] !== UNVISITED) {
      reachable.push(index);
    }
  }

  return reachable;
}

function routeTo(parents: Int32Array, targetIndex: number): readonly number[] {
  const reversed: number[] = [];

  for (let index = targetIndex; index !== ROOT && index !== UNVISITED; index = parents[index] ?? UNVISITED) {
    reversed.push(index);
  }

  const route: number[] = [];

  for (let position = reversed.length - 1; position >= 0; position -= 1) {
    const index = reversed[position];

    if (index !== undefined) {
      route.push(index);
    }
  }

  return route;
}

/** Chooses the reachable cell with the longest breadth-first route so the floor spans its full width. */
function farthestIndex(parents: Int32Array, originIndex: number): number {
  const reachable = reachableIndices(parents);
  let best = originIndex;
  let bestLength = 0;

  for (const index of reachable) {
    const length = routeTo(parents, index).length;

    if (length > bestLength) {
      best = index;
      bestLength = length;
    }
  }

  return best;
}

function planFloor(random: () => number, width: number, height: number): FloorPlan {
  const passable = carveMaze(random, width, height);
  carveRooms(passable, random, width, height);

  const entryIndex = toIndex(ENTRY_CELL, width);
  const parents = traverse(passable, entryIndex, EMPTY_BLOCKED, width, height);
  const exitIndex = farthestIndex(parents, entryIndex);

  return { passable, entryIndex, exitIndex, route: routeTo(parents, exitIndex) };
}

function takeRandom(random: () => number, candidates: readonly number[], occupied: ReadonlySet<number>): number {
  const free = candidates.filter((index) => !occupied.has(index));
  const chosen = free[pickIndex(random, free.length)];

  if (free.length === 0 || chosen === undefined) {
    throw new PlacementExhaustedError("No free reachable cell remains for the requested placement.");
  }

  return chosen;
}

/**
 * Picks evenly spaced interior route positions so gating doors stay ordered along the required path.
 *
 * Throws when the route cannot hold the requested number of distinct gates, so an over-dense request
 * signals exhaustion for the caller to reseed or reject instead of silently placing fewer gates.
 */
function gateRouteIndices(route: readonly number[], gateCount: number): readonly number[] {
  const interior = route.slice(1, -1);

  if (gateCount > interior.length) {
    throw new PlacementExhaustedError("Not enough route cells remain for the requested gate count.");
  }

  const gates: number[] = [];

  for (let gate = 0; gate < gateCount; gate += 1) {
    const position = Math.floor(((gate + 1) * interior.length) / (gateCount + 1));
    const index = interior[Math.min(interior.length - 1, position)];

    if (index !== undefined && !gates.includes(index)) {
      gates.push(index);
    }
  }

  return gates;
}

function deadEndIndices(
  passable: Uint8Array,
  reachable: readonly number[],
  width: number,
  height: number,
): readonly number[] {
  return reachable.filter(
    (index) =>
      neighbourIndices(index, width, height).filter((neighbour) => isPassable(passable, neighbour)).length === 1,
  );
}

function pickArchetypeId(random: () => number, floorIndex: number, floorCount: number): string {
  const depth = floorCount <= 1 ? 0 : floorIndex / (floorCount - 1);
  const tier = Math.min(ENEMY_ARCHETYPE_IDS.length - 1, Math.floor(depth * ENEMY_ARCHETYPE_IDS.length));

  return ENEMY_ARCHETYPE_IDS[pickIndex(random, tier + 1)] ?? "bat";
}

/** Builds one gate-slot color per matched pair a color was allocated, grouped by color before shuffling. */
function buildColorSequence(colorGateCounts: Readonly<Record<KeyColor, number>>): readonly KeyColor[] {
  const sequence: KeyColor[] = [];

  for (const color of KEY_COLORS) {
    for (let count = 0; count < colorGateCounts[color]; count += 1) {
      sequence.push(color);
    }
  }

  return sequence;
}

/**
 * Places the lock-and-key chain, spare records, and enemies for one floor from its resolved allocation.
 *
 * Each color gates as many doors as it has matching keys on this floor; those gate doors sit on the
 * required route and every matching key is placed in the region still reachable with that door and all
 * later ones closed, which makes the floor solvable by construction. Spare doors only ever land on dead
 * ends so they can never seal off a key. Running out of route room or placement room throws rather than
 * silently placing fewer than the resolved allocation asked for.
 */
function placeFloorEntities(
  plan: FloorPlan,
  floorId: string,
  floorIndex: number,
  floorCount: number,
  allocation: FloorAllocation,
  width: number,
  height: number,
  random: () => number,
  occupied: Set<number>,
): readonly GameplayEntitySource[] {
  const entities: GameplayEntitySource[] = [];
  const parents = traverse(plan.passable, plan.entryIndex, EMPTY_BLOCKED, width, height);
  const reachable = reachableIndices(parents);

  const colorGateCounts: Record<KeyColor, number> = { red: 0, blue: 0, yellow: 0 };

  for (const color of KEY_COLORS) {
    colorGateCounts[color] = Math.min(allocation.colorCounts[color].keys, allocation.colorCounts[color].doors);
  }

  const totalGateCount = KEY_COLORS.reduce((sum, color) => sum + colorGateCounts[color], 0);
  const gateIndices = gateRouteIndices(plan.route, totalGateCount);
  const gateColors = shuffle(buildColorSequence(colorGateCounts), random);

  gateIndices.forEach((index, gate) => {
    const color = gateColors[gate] ?? "red";
    entities.push({
      kind: "door",
      id: `${floorId}-gate-door-${gate + 1}`,
      cell: toCell(index, width),
      color,
    });
    occupied.add(index);
  });

  gateIndices.forEach((_index, gate) => {
    const blocked = new Set(gateIndices.slice(gate));
    const openable = reachableIndices(traverse(plan.passable, plan.entryIndex, blocked, width, height));
    const cellIndex = takeRandom(random, openable, occupied);
    entities.push({
      kind: "key",
      id: `${floorId}-gate-key-${gate + 1}`,
      cell: toCell(cellIndex, width),
      color: gateColors[gate] ?? "red",
    });
    occupied.add(cellIndex);
  });

  const spareDoorTargets = deadEndIndices(plan.passable, reachable, width, height);

  for (const color of KEY_COLORS) {
    const spareDoorCount = allocation.colorCounts[color].doors - colorGateCounts[color];

    for (let spare = 0; spare < spareDoorCount; spare += 1) {
      const available = spareDoorTargets.filter((index) => !occupied.has(index));

      if (available.length === 0) {
        throw new PlacementExhaustedError("No dead-end cell remains for the requested spare door.");
      }

      const cellIndex = takeRandom(random, available, occupied);
      entities.push({
        kind: "door",
        id: `${floorId}-spare-door-${color}-${spare + 1}`,
        cell: toCell(cellIndex, width),
        color,
      });
      occupied.add(cellIndex);
    }
  }

  for (const color of KEY_COLORS) {
    const spareKeyCount = allocation.colorCounts[color].keys - colorGateCounts[color];

    for (let spare = 0; spare < spareKeyCount; spare += 1) {
      const cellIndex = takeRandom(random, reachable, occupied);
      entities.push({
        kind: "key",
        id: `${floorId}-spare-key-${color}-${spare + 1}`,
        cell: toCell(cellIndex, width),
        color,
      });
      occupied.add(cellIndex);
    }
  }

  for (let enemy = 0; enemy < allocation.enemies; enemy += 1) {
    const cellIndex = takeRandom(random, reachable, occupied);
    entities.push({
      kind: "enemy",
      id: `${floorId}-enemy-${enemy + 1}`,
      cell: toCell(cellIndex, width),
      archetypeId: pickArchetypeId(random, floorIndex, floorCount),
    });
    occupied.add(cellIndex);
  }

  return entities;
}

function renderTiles(passable: Uint8Array, width: number, height: number): readonly string[] {
  return Array.from({ length: height }, (_row, y) =>
    Array.from({ length: width }, (_column, x) => (isPassable(passable, toIndex({ x, y }, width)) ? "." : "#")).join(
      "",
    ),
  );
}

function buildFloorSet(resolved: ResolvedOptions, attempt: number): FloorSetSource {
  const random = createRandom((resolved.seed + attempt * 0x9e3779b1) >>> 0);
  const allocations = allocateAcrossFloors(random, resolved);
  const plans = Array.from({ length: resolved.floorCount }, () => planFloor(random, resolved.width, resolved.height));
  const floors: FloorSource[] = [];

  for (const [floorIndex, plan] of plans.entries()) {
    const floorId = `B${floorIndex + 1}`;
    const isDeepest = floorIndex === resolved.floorCount - 1;
    const occupied = new Set<number>([plan.entryIndex, plan.exitIndex]);
    const entities: GameplayEntitySource[] = [];
    const allocation = allocations[floorIndex];

    if (!allocation) {
      throw new PlacementExhaustedError("Missing the resolved allocation for this floor.");
    }

    if (floorIndex > 0) {
      if (!plans[floorIndex - 1]) {
        throw new PlacementExhaustedError("Missing the floor above while wiring stairs.");
      }

      entities.push({
        kind: "stair",
        id: `${floorId}-up`,
        cell: toCell(plan.entryIndex, resolved.width),
        destinationStairId: `B${floorIndex}-down`,
        arrivalFacing: ARRIVAL_FACING,
      });
    }

    if (isDeepest) {
      entities.push({
        kind: "enemy",
        id: `${floorId}-goal`,
        cell: toCell(plan.exitIndex, resolved.width),
        archetypeId: GOAL_ARCHETYPE_ID,
      });
    } else {
      entities.push({
        kind: "stair",
        id: `${floorId}-down`,
        cell: toCell(plan.exitIndex, resolved.width),
        destinationStairId: `B${floorIndex + 2}-up`,
        arrivalFacing: ARRIVAL_FACING,
      });
    }

    entities.push(
      ...placeFloorEntities(
        plan,
        floorId,
        floorIndex,
        resolved.floorCount,
        allocation,
        resolved.width,
        resolved.height,
        random,
        occupied,
      ),
    );
    floors.push({
      id: floorId,
      theme: THEMES[floorIndex % THEMES.length] ?? "candidate",
      tiles: renderTiles(plan.passable, resolved.width, resolved.height),
      gameplayEntities: entities,
      environmentFeatures: [],
    });
  }

  return {
    schemaVersion: 3,
    initial: { floorId: "B1", cell: ENTRY_CELL, facing: ARRIVAL_FACING },
    goalEntityId: `B${resolved.floorCount}-goal`,
    floors,
  };
}

function resolveCount(value: number | undefined, label: string, fallback: number): number {
  const resolved = value ?? fallback;

  if (!Number.isInteger(resolved) || resolved < 0) {
    throw new RangeError(`${label} must be a non-negative integer.`);
  }

  return resolved;
}

function resolveDimension(value: number | undefined, label: string): number {
  const resolved = value ?? DEFAULT_DIMENSION;

  if (!Number.isInteger(resolved) || resolved < MIN_DIMENSION || Math.abs(resolved % 2) !== 1) {
    throw new RangeError(`${label} must be an odd integer of at least ${MIN_DIMENSION}.`);
  }

  return resolved;
}

function resolveOptions(options: FloorSetGenerationOptions): ResolvedOptions {
  if (!Number.isInteger(options.floorCount) || options.floorCount < 1) {
    throw new RangeError("floorCount must be a positive integer.");
  }

  const colorCounts: Record<KeyColor, ColorCounts> = {
    red: {
      keys: resolveCount(options.redKeys, "redKeys", DEFAULT_KEYS_PER_COLOR),
      doors: resolveCount(options.redDoors, "redDoors", DEFAULT_DOORS_PER_COLOR),
    },
    blue: {
      keys: resolveCount(options.blueKeys, "blueKeys", DEFAULT_KEYS_PER_COLOR),
      doors: resolveCount(options.blueDoors, "blueDoors", DEFAULT_DOORS_PER_COLOR),
    },
    yellow: {
      keys: resolveCount(options.yellowKeys, "yellowKeys", DEFAULT_KEYS_PER_COLOR),
      doors: resolveCount(options.yellowDoors, "yellowDoors", DEFAULT_DOORS_PER_COLOR),
    },
  };

  return {
    seed: options.seed,
    floorCount: options.floorCount,
    width: resolveDimension(options.width, "width"),
    height: resolveDimension(options.height, "height"),
    colorCounts,
    enemies: resolveCount(options.enemies, "enemies", DEFAULT_ENEMIES),
  };
}

/**
 * Produces a deterministic, structurally solvable candidate floor set for offline authoring.
 *
 * Equal options always produce equal output. Each attempt is checked with the canonical validator and
 * a failed attempt reseeds deterministically, so callers never receive a candidate without a solution.
 */
export function generateFloorSet(options: FloorSetGenerationOptions): FloorSetSource {
  const resolved = resolveOptions(options);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let candidate: FloorSetSource;

    try {
      candidate = buildFloorSet(resolved, attempt);
    } catch (caught) {
      if (caught instanceof PlacementExhaustedError) {
        continue;
      }

      throw caught;
    }

    const validation = validateParsedFloorSet(candidate);

    if (validation.solution && !validation.findings.some((finding) => finding.severity === "error")) {
      return candidate;
    }

    // Reseeding cannot help when the validator ran out of search budget; the requested density is the cause.
    if (validation.findings.some((finding) => finding.code === "topology.searchExhausted")) {
      throw new RangeError(
        "The requested key and door totals exceed the structural validator's search budget. Lower a key or door total, or raise floorCount.",
      );
    }
  }

  throw new Error(
    `Unable to generate a solvable floor set from seed ${options.seed} after ${MAX_ATTEMPTS} attempts. Lower a door total or raise the matching key total.`,
  );
}

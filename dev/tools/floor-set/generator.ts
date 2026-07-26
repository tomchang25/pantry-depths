import type { Cell, Facing } from "@/core/grid";
import type { KeyColor } from "@/core/run-state";
import type { FloorSetSource, FloorSource, GameplayEntitySource } from "@/content/floor/floor-schema";
import { validateParsedFloorSet } from "@/content/floor/floor-validation";

export type FloorSetGenerationOptions = Readonly<{
  seed: number;
  floorCount: number;
  keysPerFloor?: number;
  doorsPerFloor?: number;
  enemiesPerFloor?: number;
}>;

type ResolvedOptions = Required<FloorSetGenerationOptions>;

type FloorPlan = Readonly<{
  passable: Uint8Array;
  entryIndex: number;
  exitIndex: number;
  route: readonly number[];
}>;

/** Signals that one attempt ran out of legal placement room and the caller should reseed. */
class PlacementExhaustedError extends Error {}

const FLOOR_SIZE = 13;
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
const DEFAULT_KEYS_PER_FLOOR = 1;
const DEFAULT_DOORS_PER_FLOOR = 1;
const DEFAULT_ENEMIES_PER_FLOOR = 1;
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

function pickFrom<Value>(random: () => number, values: readonly Value[], fallback: Value): Value {
  return values[pickIndex(random, values.length)] ?? fallback;
}

function toIndex(cell: Cell): number {
  return cell.y * FLOOR_SIZE + cell.x;
}

function toCell(index: number): Cell {
  return { x: index % FLOOR_SIZE, y: Math.floor(index / FLOOR_SIZE) };
}

function isPassable(passable: Uint8Array, index: number): boolean {
  return passable[index] === 1;
}

function neighbourIndices(index: number): readonly number[] {
  const cell = toCell(index);

  return MAZE_STEPS.map((step) => ({ x: cell.x + step.x, y: cell.y + step.y }))
    .filter((candidate) => candidate.x >= 0 && candidate.x < FLOOR_SIZE && candidate.y >= 0 && candidate.y < FLOOR_SIZE)
    .map(toIndex);
}

/** Carves a perfect corridor maze whose nodes sit on odd coordinates inside a solid border. */
function carveMaze(random: () => number): Uint8Array {
  const passable = new Uint8Array(FLOOR_SIZE * FLOOR_SIZE);
  const stack: Cell[] = [ENTRY_CELL];
  passable[toIndex(ENTRY_CELL)] = 1;

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
        candidate.node.x < FLOOR_SIZE - 1 &&
        candidate.node.y > 0 &&
        candidate.node.y < FLOOR_SIZE - 1 &&
        !isPassable(passable, toIndex(candidate.node)),
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

    passable[toIndex(chosen.wall)] = 1;
    passable[toIndex(chosen.node)] = 1;
    stack.push(chosen.node);
  }

  return passable;
}

/** Opens a few odd-aligned rectangles so the maze gains open rooms without losing connectivity. */
function carveRooms(passable: Uint8Array, random: () => number): void {
  const roomCount = 2 + pickIndex(random, 2);

  for (let room = 0; room < roomCount; room += 1) {
    const size = 3 + 2 * pickIndex(random, 2);
    const starts = Math.floor((FLOOR_SIZE - 2 - size) / 2) + 1;
    const originX = 1 + 2 * pickIndex(random, starts);
    const originY = 1 + 2 * pickIndex(random, starts);

    for (let y = originY; y < originY + size; y += 1) {
      for (let x = originX; x < originX + size; x += 1) {
        passable[toIndex({ x, y })] = 1;
      }
    }
  }
}

/** Breadth-first parent map from one origin, treating blocked indices as impassable. */
function traverse(passable: Uint8Array, originIndex: number, blocked: ReadonlySet<number>): Int32Array {
  const parents = new Int32Array(FLOOR_SIZE * FLOOR_SIZE).fill(UNVISITED);
  const queue: number[] = [originIndex];
  parents[originIndex] = ROOT;
  let head = 0;

  while (head < queue.length) {
    const current = queue[head];
    head += 1;

    if (current === undefined) {
      continue;
    }

    for (const neighbour of neighbourIndices(current)) {
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

function planFloor(random: () => number): FloorPlan {
  const passable = carveMaze(random);
  carveRooms(passable, random);

  const entryIndex = toIndex(ENTRY_CELL);
  const parents = traverse(passable, entryIndex, EMPTY_BLOCKED);
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

/** Picks evenly spaced interior route positions so gating doors stay ordered along the required path. */
function gateRouteIndices(route: readonly number[], gateCount: number): readonly number[] {
  const interior = route.slice(1, -1);
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

function deadEndIndices(passable: Uint8Array, reachable: readonly number[]): readonly number[] {
  return reachable.filter(
    (index) => neighbourIndices(index).filter((neighbour) => isPassable(passable, neighbour)).length === 1,
  );
}

function pickArchetypeId(random: () => number, floorIndex: number, floorCount: number): string {
  const depth = floorCount <= 1 ? 0 : floorIndex / (floorCount - 1);
  const tier = Math.min(ENEMY_ARCHETYPE_IDS.length - 1, Math.floor(depth * ENEMY_ARCHETYPE_IDS.length));

  return ENEMY_ARCHETYPE_IDS[pickIndex(random, tier + 1)] ?? "bat";
}

/**
 * Places the lock-and-key chain, spare records, and enemies for one floor.
 *
 * Gating doors sit on the required route and every matching key is placed in the region still reachable
 * with that door and all later ones closed, which makes the floor solvable by construction. Spare doors
 * only ever land on dead ends so they can never seal off a key.
 */
function placeFloorEntities(
  plan: FloorPlan,
  floorId: string,
  floorIndex: number,
  options: ResolvedOptions,
  random: () => number,
  occupied: Set<number>,
): readonly GameplayEntitySource[] {
  const entities: GameplayEntitySource[] = [];
  const parents = traverse(plan.passable, plan.entryIndex, EMPTY_BLOCKED);
  const reachable = reachableIndices(parents);
  const gateCount = Math.min(options.keysPerFloor, options.doorsPerFloor, Math.max(0, plan.route.length - 2));
  const gateIndices = gateRouteIndices(plan.route, gateCount);
  const gateColors = gateIndices.map(() => pickFrom(random, KEY_COLORS, "red"));

  gateIndices.forEach((index, gate) => {
    entities.push({
      kind: "door",
      id: `${floorId}-gate-door-${gate + 1}`,
      cell: toCell(index),
      color: gateColors[gate] ?? "red",
    });
    occupied.add(index);
  });

  gateIndices.forEach((_index, gate) => {
    const blocked = new Set(gateIndices.slice(gate));
    const openable = reachableIndices(traverse(plan.passable, plan.entryIndex, blocked));
    const cellIndex = takeRandom(random, openable, occupied);
    entities.push({
      kind: "key",
      id: `${floorId}-gate-key-${gate + 1}`,
      cell: toCell(cellIndex),
      color: gateColors[gate] ?? "red",
    });
    occupied.add(cellIndex);
  });

  const spareDoorTargets = deadEndIndices(plan.passable, reachable);

  for (let spare = 0; spare < options.doorsPerFloor - gateIndices.length; spare += 1) {
    const available = spareDoorTargets.filter((index) => !occupied.has(index));

    if (available.length === 0) {
      break;
    }

    const cellIndex = takeRandom(random, available, occupied);
    entities.push({
      kind: "door",
      id: `${floorId}-spare-door-${spare + 1}`,
      cell: toCell(cellIndex),
      color: pickFrom(random, KEY_COLORS, "red"),
    });
    occupied.add(cellIndex);
  }

  for (let spare = 0; spare < options.keysPerFloor - gateIndices.length; spare += 1) {
    const cellIndex = takeRandom(random, reachable, occupied);
    entities.push({
      kind: "key",
      id: `${floorId}-spare-key-${spare + 1}`,
      cell: toCell(cellIndex),
      color: pickFrom(random, KEY_COLORS, "red"),
    });
    occupied.add(cellIndex);
  }

  for (let enemy = 0; enemy < options.enemiesPerFloor; enemy += 1) {
    const cellIndex = takeRandom(random, reachable, occupied);
    entities.push({
      kind: "enemy",
      id: `${floorId}-enemy-${enemy + 1}`,
      cell: toCell(cellIndex),
      archetypeId: pickArchetypeId(random, floorIndex, options.floorCount),
    });
    occupied.add(cellIndex);
  }

  return entities;
}

function renderTiles(passable: Uint8Array): readonly string[] {
  return Array.from({ length: FLOOR_SIZE }, (_row, y) =>
    Array.from({ length: FLOOR_SIZE }, (_column, x) => (isPassable(passable, toIndex({ x, y })) ? "." : "#")).join(""),
  );
}

function buildFloorSet(options: ResolvedOptions, attempt: number): FloorSetSource {
  const random = createRandom((options.seed + attempt * 0x9e3779b1) >>> 0);
  const plans = Array.from({ length: options.floorCount }, () => planFloor(random));
  const floors: FloorSource[] = [];

  for (const [floorIndex, plan] of plans.entries()) {
    const floorId = `B${floorIndex + 1}`;
    const isDeepest = floorIndex === options.floorCount - 1;
    const occupied = new Set<number>([plan.entryIndex, plan.exitIndex]);
    const entities: GameplayEntitySource[] = [];

    if (floorIndex > 0) {
      const above = plans[floorIndex - 1];

      if (!above) {
        throw new PlacementExhaustedError("Missing the floor above while wiring stairs.");
      }

      entities.push({
        kind: "stair",
        id: `${floorId}-up`,
        cell: toCell(plan.entryIndex),
        destinationFloorId: `B${floorIndex}`,
        destinationCell: toCell(above.exitIndex),
        destinationFacing: ARRIVAL_FACING,
      });
    }

    if (isDeepest) {
      entities.push({
        kind: "enemy",
        id: `${floorId}-goal`,
        cell: toCell(plan.exitIndex),
        archetypeId: GOAL_ARCHETYPE_ID,
      });
    } else {
      entities.push({
        kind: "stair",
        id: `${floorId}-down`,
        cell: toCell(plan.exitIndex),
        destinationFloorId: `B${floorIndex + 2}`,
        destinationCell: ENTRY_CELL,
        destinationFacing: ARRIVAL_FACING,
      });
    }

    entities.push(...placeFloorEntities(plan, floorId, floorIndex, options, random, occupied));
    floors.push({
      id: floorId,
      theme: THEMES[floorIndex % THEMES.length] ?? "candidate",
      tiles: renderTiles(plan.passable),
      gameplayEntities: entities,
      environmentFeatures: [],
    });
  }

  return {
    schemaVersion: 2,
    initial: { floorId: "B1", cell: ENTRY_CELL, facing: ARRIVAL_FACING },
    goalEntityId: `B${options.floorCount}-goal`,
    floors,
  };
}

function resolveOptions(options: FloorSetGenerationOptions): ResolvedOptions {
  const resolved: ResolvedOptions = {
    seed: options.seed,
    floorCount: options.floorCount,
    keysPerFloor: options.keysPerFloor ?? DEFAULT_KEYS_PER_FLOOR,
    doorsPerFloor: options.doorsPerFloor ?? DEFAULT_DOORS_PER_FLOOR,
    enemiesPerFloor: options.enemiesPerFloor ?? DEFAULT_ENEMIES_PER_FLOOR,
  };

  if (!Number.isInteger(resolved.floorCount) || resolved.floorCount < 1) {
    throw new RangeError("floorCount must be a positive integer.");
  }

  for (const field of ["keysPerFloor", "doorsPerFloor", "enemiesPerFloor"] as const) {
    if (!Number.isInteger(resolved[field]) || resolved[field] < 0) {
      throw new RangeError(`${field} must be a non-negative integer.`);
    }
  }

  return resolved;
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
        "The requested key and door density exceeds the structural validator's search budget. Lower keysPerFloor, doorsPerFloor, or floorCount.",
      );
    }
  }

  throw new Error(
    `Unable to generate a solvable floor set from seed ${options.seed} after ${MAX_ATTEMPTS} attempts. Lower doorsPerFloor or raise keysPerFloor.`,
  );
}

import { moveForward, type Cell, type Facing } from "@/core/grid";
import type { KeyColor } from "@/core/run-state";
import {
  FloorSchemaError,
  isSolidTile,
  parseFloorSet,
  type FloorSetSource,
  type FloorSource,
  type GameplayEntitySource,
} from "@/content/floor/floor-schema";

export type TopologyFinding = Readonly<{
  severity: "error" | "warning";
  code: string;
  message: string;
  floorId?: string;
  entityId?: string;
  cell?: Cell;
}>;

export type TopologyStep = Readonly<{
  type: "move" | "openDoor" | "useStair" | "breakWall" | "defeatEnemy";
  floorId: string;
  cell: Cell;
  entityId?: string;
}>;

export type FloorValidationResult = Readonly<{
  findings: readonly TopologyFinding[];
  solution: readonly TopologyStep[] | undefined;
}>;

type LocatedEntity = Readonly<{
  floorId: string;
  entity: GameplayEntitySource;
}>;

type KeyCounts = Record<KeyColor, number>;

type SearchState = Readonly<{
  floorId: string;
  cell: Cell;
  keys: KeyCounts;
  collected: bigint;
  opened: bigint;
  parentIndex: number;
  steps: readonly TopologyStep[];
}>;

type SolveOutcome = Readonly<{
  solution: readonly TopologyStep[] | undefined;
  exhausted: boolean;
}>;

const FACINGS: readonly Facing[] = ["north", "east", "south", "west"];
const OPPOSITE_FACING: Readonly<Record<Facing, Facing>> = {
  north: "south",
  east: "west",
  south: "north",
  west: "east",
};
const EMPTY_KEYS: KeyCounts = { red: 0, blue: 0, yellow: 0 };

/**
 * Upper bound on distinct search states before the solver reports an undecided result.
 *
 * Lock-and-key reachability grows exponentially with the number of independent keys and doors, so an
 * unbounded search can exhaust memory on a dense authored set. The bound turns that into a finding.
 */
const MAX_SEARCH_STATES = 1_500_000;

function error(
  code: string,
  message: string,
  context: Omit<TopologyFinding, "severity" | "code" | "message"> = {},
): TopologyFinding {
  return { severity: "error", code, message, ...context };
}

function isInsideFloor(floor: FloorSource, cell: Cell): boolean {
  return cell.y >= 0 && cell.y < floor.tiles.length && cell.x >= 0 && cell.x < (floor.tiles[0]?.length ?? 0);
}

function isBasePassable(floor: FloorSource, cell: Cell): boolean {
  if (!isInsideFloor(floor, cell)) {
    return false;
  }

  const tile = floor.tiles[cell.y]?.[cell.x];
  return tile !== undefined && !isSolidTile(tile);
}

/** Assigns one bit per collectable key and openable door so search state fits in two integers. */
function createEntityBits(entities: readonly LocatedEntity[]): ReadonlyMap<string, bigint> {
  const bits = new Map<string, bigint>();

  for (const { entity } of entities) {
    if (entity.kind === "key" || entity.kind === "door") {
      bits.set(entity.id, 1n << BigInt(bits.size));
    }
  }

  return bits;
}

function isMarked(mask: bigint, bit: bigint): boolean {
  return (mask & bit) !== 0n;
}

/**
 * Identifies one search state.
 *
 * Key counts are omitted because they are a function of the collected and opened sets. Defeated enemies
 * and broken walls are omitted because both are unconditional, permanent, and never block a route, so
 * the solver clears them on contact instead of branching on them.
 */
function stateKey(state: SearchState): string {
  return [
    state.floorId,
    `${state.cell.x},${state.cell.y}`,
    state.collected.toString(36),
    state.opened.toString(36),
  ].join("|");
}

function entityKey(floorId: string, cell: Cell): string {
  return `${floorId}|${cell.x},${cell.y}`;
}

function collectEntities(floorSet: FloorSetSource): readonly LocatedEntity[] {
  return floorSet.floors.flatMap((floor) => floor.gameplayEntities.map((entity) => ({ floorId: floor.id, entity })));
}

function validateReferences(floorSet: FloorSetSource): readonly TopologyFinding[] {
  const findings: TopologyFinding[] = [];
  const floors = new Map<string, FloorSource>();
  const entityIds = new Set<string>();
  const occupiedCells = new Set<string>();
  const tileDecorationCells = new Set<string>();
  const wallDecorationFaces = new Set<string>();

  for (const floor of floorSet.floors) {
    if (floors.has(floor.id)) {
      findings.push(error("floor.duplicateId", `Floor ${floor.id} is declared more than once.`, { floorId: floor.id }));
      continue;
    }

    floors.set(floor.id, floor);

    for (const entity of floor.gameplayEntities) {
      if (entityIds.has(entity.id)) {
        findings.push(
          error("entity.duplicateId", `Entity ${entity.id} is declared more than once.`, {
            floorId: floor.id,
            entityId: entity.id,
          }),
        );
      }

      entityIds.add(entity.id);

      if (!isInsideFloor(floor, entity.cell) || !isBasePassable(floor, entity.cell)) {
        findings.push(
          error("entity.invalidCell", `Entity ${entity.id} must occupy an in-bounds passable base tile.`, {
            floorId: floor.id,
            entityId: entity.id,
            cell: entity.cell,
          }),
        );
      }

      const key = entityKey(floor.id, entity.cell);

      if (occupiedCells.has(key)) {
        findings.push(
          error(
            "entity.overlap",
            `Only one authored entity may occupy ${floor.id} (${entity.cell.x}, ${entity.cell.y}).`,
            {
              floorId: floor.id,
              entityId: entity.id,
              cell: entity.cell,
            },
          ),
        );
      }

      occupiedCells.add(key);
    }

    for (const feature of floor.environmentFeatures) {
      if (entityIds.has(feature.id)) {
        findings.push(
          error("content.duplicateId", `Content record ${feature.id} is declared more than once.`, {
            floorId: floor.id,
            entityId: feature.id,
          }),
        );
      }

      entityIds.add(feature.id);

      if (feature.kind === "wallDecoration") {
        const anchorKey = `${entityKey(floor.id, feature.wallCell)}|${feature.face}`;

        if (
          !isInsideFloor(floor, feature.wallCell) ||
          !isSolidTile(floor.tiles[feature.wallCell.y]?.[feature.wallCell.x] ?? ".")
        ) {
          findings.push(
            error(
              "environment.invalidWallDecorationCell",
              `Wall decoration ${feature.id} must anchor to an in-bounds solid base tile.`,
              { floorId: floor.id, entityId: feature.id, cell: feature.wallCell },
            ),
          );
        }

        if (!isBasePassable(floor, moveForward(feature.wallCell, feature.face))) {
          findings.push(
            error(
              "environment.invalidWallDecorationFace",
              `Wall decoration ${feature.id} must face an in-bounds passable observation cell.`,
              { floorId: floor.id, entityId: feature.id, cell: moveForward(feature.wallCell, feature.face) },
            ),
          );
        }

        if (wallDecorationFaces.has(anchorKey)) {
          findings.push(
            error(
              "environment.wallDecorationOverlap",
              `Only one wall decoration may use ${floor.id} (${feature.wallCell.x}, ${feature.wallCell.y}) ${feature.face}.`,
              { floorId: floor.id, entityId: feature.id, cell: feature.wallCell },
            ),
          );
        }

        wallDecorationFaces.add(anchorKey);
        continue;
      }

      if (!isBasePassable(floor, feature.cell)) {
        findings.push(
          error(
            "environment.invalidFloorPosition",
            `Environment feature ${feature.id} must use an in-bounds passable base tile.`,
            { floorId: floor.id, entityId: feature.id, cell: feature.cell },
          ),
        );
      }

      if (feature.kind === "tileDecoration") {
        const tileKey = entityKey(floor.id, feature.cell);

        if (tileDecorationCells.has(tileKey)) {
          findings.push(
            error(
              "environment.tileDecorationOverlap",
              `Only one tile decoration may use ${floor.id} (${feature.cell.x}, ${feature.cell.y}).`,
              { floorId: floor.id, entityId: feature.id, cell: feature.cell },
            ),
          );
        }

        tileDecorationCells.add(tileKey);
      }
    }
  }

  const initialFloor = floors.get(floorSet.initial.floorId);

  if (!initialFloor || !isBasePassable(initialFloor, floorSet.initial.cell)) {
    findings.push(
      error("initial.invalid", "The initial player cell must exist on a passable base tile.", {
        cell: floorSet.initial.cell,
      }),
    );
  }

  const allEntities = collectEntities(floorSet);
  const goal = allEntities.find((entry) => entry.entity.id === floorSet.goalEntityId);

  if (!goal || goal.entity.kind !== "enemy") {
    findings.push(
      error("goal.invalid", "goalEntityId must name an authored enemy entity.", { entityId: floorSet.goalEntityId }),
    );
  }

  for (const { floorId, entity } of allEntities) {
    if (entity.kind === "stair") {
      const destination = allEntities.find((candidate) => candidate.entity.id === entity.destinationStairId);

      if (!destination || destination.entity.kind !== "stair" || destination.entity.id === entity.id) {
        findings.push(
          error("stair.invalidDestination", `Stair ${entity.id} must target another authored stair ID.`, {
            floorId,
            entityId: entity.id,
            cell: entity.cell,
          }),
        );
      }
    }

    if (entity.kind === "breakableWall") {
      const floor = floors.get(floorId);

      if (!floor) {
        continue;
      }

      const uniqueFaces = new Set(entity.hintFaces);
      const hasInvalidCount = entity.hintFaces.length < 1 || entity.hintFaces.length > 2;
      const hasDuplicate = uniqueFaces.size !== entity.hintFaces.length;
      const hasNonOpposingPair =
        entity.hintFaces.length === 2 &&
        entity.hintFaces[0] !== undefined &&
        entity.hintFaces[1] !== OPPOSITE_FACING[entity.hintFaces[0]];

      if (hasInvalidCount || hasDuplicate || hasNonOpposingPair) {
        findings.push(
          error(
            "wall.invalidHintConfiguration",
            `Breakable wall ${entity.id} must declare one hint face or two distinct opposing hint faces.`,
            { floorId, entityId: entity.id, cell: entity.cell },
          ),
        );
        continue;
      }

      for (const face of entity.hintFaces) {
        const observationCell = moveForward(entity.cell, face);

        if (!isBasePassable(floor, observationCell)) {
          findings.push(
            error("wall.invalidHintFace", `Breakable wall ${entity.id} has an unreachable ${face} hint face.`, {
              floorId,
              entityId: entity.id,
              cell: observationCell,
            }),
          );
        }
      }
    }
  }

  return findings;
}

const REPEATABLE_STEP_TYPES: ReadonlySet<TopologyStep["type"]> = new Set(["move", "useStair"]);

/** Concatenates transition step groups, keeping only the first clearing step for each entity. */
function flattenSteps(groups: readonly (readonly TopologyStep[])[]): readonly TopologyStep[] {
  const solution: TopologyStep[] = [];
  const clearedIds = new Set<string>();

  for (const group of groups) {
    for (const step of group) {
      if (REPEATABLE_STEP_TYPES.has(step.type) || step.entityId === undefined) {
        solution.push(step);
        continue;
      }

      if (!clearedIds.has(step.entityId)) {
        clearedIds.add(step.entityId);
        solution.push(step);
      }
    }
  }

  return solution;
}

/**
 * Walks parent links back to the initial state so visited states never carry a copied path.
 *
 * Because the solver clears an enemy or wall on every contact, a route that revisits a cleared cell
 * would repeat its clearing step; only the first occurrence of each one is kept.
 */
function buildSolution(
  states: readonly SearchState[],
  parentIndex: number,
  finalSteps: readonly TopologyStep[],
): readonly TopologyStep[] {
  const chain: number[] = [];

  for (let index = parentIndex; index >= 0; index = states[index]?.parentIndex ?? -1) {
    chain.push(index);
  }

  const groups: (readonly TopologyStep[])[] = [];

  for (let position = chain.length - 1; position >= 0; position -= 1) {
    const index = chain[position];
    groups.push(index === undefined ? [] : (states[index]?.steps ?? []));
  }

  groups.push(finalSteps);
  return flattenSteps(groups);
}

type ReachNode = Readonly<{
  floorId: string;
  cell: Cell;
  parentKey: string | undefined;
  steps: readonly TopologyStep[];
}>;

type EntityIndex = Readonly<{
  floors: ReadonlyMap<string, FloorSource>;
  entitiesAt: ReadonlyMap<string, LocatedEntity>;
  entitiesById: ReadonlyMap<string, LocatedEntity>;
}>;

function indexFloorSet(floorSet: FloorSetSource): EntityIndex {
  const entitiesAt = new Map<string, LocatedEntity>();
  const entitiesById = new Map<string, LocatedEntity>();

  for (const entity of collectEntities(floorSet)) {
    entitiesAt.set(entityKey(entity.floorId, entity.entity.cell), entity);
    entitiesById.set(entity.entity.id, entity);
  }

  return { floors: new Map(floorSet.floors.map((floor) => [floor.id, floor])), entitiesAt, entitiesById };
}

/**
 * Breadth-first reachability with the door set held fixed.
 *
 * Closed doors are walls; enemies and breakable walls are entered by clearing them. Nodes are returned
 * in breadth-first order so the first match a caller finds is also the nearest one.
 */
function exploreReachable(
  index: EntityIndex,
  origin: Readonly<{ floorId: string; cell: Cell }>,
  opened: ReadonlySet<string>,
): ReadonlyMap<string, ReachNode> {
  const originKey = entityKey(origin.floorId, origin.cell);
  const reached = new Map<string, ReachNode>([
    [originKey, { floorId: origin.floorId, cell: origin.cell, parentKey: undefined, steps: [] }],
  ]);
  const queue: ReachNode[] = [reached.get(originKey) as ReachNode];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head];
    head += 1;

    if (!current) {
      continue;
    }

    const floor = index.floors.get(current.floorId);

    if (!floor) {
      continue;
    }

    const currentKey = entityKey(current.floorId, current.cell);

    for (const facing of FACINGS) {
      const targetCell = moveForward(current.cell, facing);

      if (!isBasePassable(floor, targetCell)) {
        continue;
      }

      const entity = index.entitiesAt.get(entityKey(current.floorId, targetCell))?.entity;
      const moveStep: TopologyStep = { type: "move", floorId: current.floorId, cell: targetCell };
      let next: ReachNode | undefined;

      if (!entity) {
        next = { floorId: current.floorId, cell: targetCell, parentKey: currentKey, steps: [moveStep] };
      } else if (entity.kind === "key") {
        next = {
          floorId: current.floorId,
          cell: targetCell,
          parentKey: currentKey,
          steps: [{ ...moveStep, entityId: entity.id }],
        };
      } else if (entity.kind === "enemy" || entity.kind === "breakableWall") {
        const clearStep: TopologyStep = {
          type: entity.kind === "enemy" ? "defeatEnemy" : "breakWall",
          floorId: current.floorId,
          cell: targetCell,
          entityId: entity.id,
        };
        next = { floorId: current.floorId, cell: targetCell, parentKey: currentKey, steps: [clearStep, moveStep] };
      } else if (entity.kind === "stair") {
        const destination = index.entitiesById.get(entity.destinationStairId);

        if (destination?.entity.kind === "stair") {
          next = {
            floorId: destination.floorId,
            cell: destination.entity.cell,
            parentKey: currentKey,
            steps: [{ type: "useStair", floorId: current.floorId, cell: targetCell, entityId: entity.id }],
          };
        }
      } else if (entity.kind === "door" && opened.has(entity.id)) {
        next = { floorId: current.floorId, cell: targetCell, parentKey: currentKey, steps: [moveStep] };
      }

      if (!next) {
        continue;
      }

      const nextKey = entityKey(next.floorId, next.cell);

      if (reached.has(nextKey)) {
        continue;
      }

      reached.set(nextKey, next);
      queue.push(next);
    }
  }

  return reached;
}

function routeSteps(reached: ReadonlyMap<string, ReachNode>, targetKey: string): readonly (readonly TopologyStep[])[] {
  const reversed: (readonly TopologyStep[])[] = [];

  for (let key: string | undefined = targetKey; key !== undefined; key = reached.get(key)?.parentKey) {
    const node = reached.get(key);

    if (!node) {
      break;
    }

    reversed.push(node.steps);
  }

  const forward: (readonly TopologyStep[])[] = [];

  for (let position = reversed.length - 1; position >= 0; position -= 1) {
    forward.push(reversed[position] ?? []);
  }

  return forward;
}

/**
 * Polynomial-time greedy solver: take every reachable key before spending one, then open the nearest
 * affordable door. Each round collects a key or opens a door, so it terminates in at most one round per
 * key and door.
 *
 * It is sound but not complete. It only fails when a limited key must be committed to one of several
 * same-colored doors, which is exactly the choice that makes the general problem intractable, so the
 * caller falls back to the exhaustive search. Authored content rarely makes that choice binding, which
 * is why this path answers almost every real edit immediately.
 */
function solveGreedy(floorSet: FloorSetSource): readonly TopologyStep[] | undefined {
  const index = indexFloorSet(floorSet);
  const goal = collectEntities(floorSet).find((entry) => entry.entity.id === floorSet.goalEntityId);

  if (!goal) {
    return undefined;
  }

  const goalKey = entityKey(goal.floorId, goal.entity.cell);
  const keys: KeyCounts = { ...EMPTY_KEYS };
  const collected = new Set<string>();
  const opened = new Set<string>();
  const groups: (readonly TopologyStep[])[] = [];
  let position = { floorId: floorSet.initial.floorId, cell: floorSet.initial.cell };
  let rounds = index.entitiesAt.size + 1;

  while (rounds > 0) {
    rounds -= 1;

    const reached = exploreReachable(index, position, opened);

    // A goal standing on the origin has not been entered, so it is not yet defeated; requiring a
    // non-empty route keeps that case walking off and back rather than reporting a zero-step win.
    if ((reached.get(goalKey)?.steps.length ?? 0) > 0) {
      groups.push(...routeSteps(reached, goalKey));

      // Entering the goal cell emits a defeat step and a move; defeating the goal ends the route, so the
      // trailing move is dropped to match the terminal shape the exhaustive search returns.
      const solution = flattenSteps(groups);
      return solution.at(-1)?.type === "move" ? solution.slice(0, -1) : solution;
    }

    let advanced = false;

    for (const [key, node] of reached) {
      const entity = index.entitiesAt.get(entityKey(node.floorId, node.cell))?.entity;

      if (entity?.kind !== "key" || collected.has(entity.id)) {
        continue;
      }

      groups.push(...routeSteps(reached, key));
      collected.add(entity.id);
      keys[entity.color] += 1;
      position = { floorId: node.floorId, cell: node.cell };
      advanced = true;
      break;
    }

    if (advanced) {
      continue;
    }

    for (const [, node] of reached) {
      const floor = index.floors.get(node.floorId);

      if (!floor) {
        continue;
      }

      const doorEntry = FACINGS.map((facing) => moveForward(node.cell, facing))
        .map((cell) => index.entitiesAt.get(entityKey(node.floorId, cell))?.entity)
        .find((candidate) => candidate?.kind === "door" && !opened.has(candidate.id) && keys[candidate.color] > 0);

      if (doorEntry?.kind !== "door") {
        continue;
      }

      groups.push(...routeSteps(reached, entityKey(node.floorId, node.cell)));
      groups.push([
        { type: "openDoor", floorId: node.floorId, cell: doorEntry.cell, entityId: doorEntry.id },
        { type: "move", floorId: node.floorId, cell: doorEntry.cell },
      ]);
      opened.add(doorEntry.id);
      keys[doorEntry.color] -= 1;
      position = { floorId: node.floorId, cell: doorEntry.cell };
      advanced = true;
      break;
    }

    if (!advanced) {
      return undefined;
    }
  }

  return undefined;
}

function solveTopology(floorSet: FloorSetSource): SolveOutcome {
  const floors = new Map(floorSet.floors.map((floor) => [floor.id, floor]));
  const entities = collectEntities(floorSet);
  const entityBits = createEntityBits(entities);
  const entitiesAt = new Map<string, LocatedEntity>();
  const entitiesById = new Map<string, LocatedEntity>();

  for (const entity of entities) {
    entitiesAt.set(entityKey(entity.floorId, entity.entity.cell), entity);
    entitiesById.set(entity.entity.id, entity);
  }

  const initialState: SearchState = {
    floorId: floorSet.initial.floorId,
    cell: floorSet.initial.cell,
    keys: EMPTY_KEYS,
    collected: 0n,
    opened: 0n,
    parentIndex: -1,
    steps: [],
  };
  const states: SearchState[] = [initialState];
  const visited = new Set<string>([stateKey(initialState)]);
  let head = 0;

  // `states` doubles as the queue; `head` advances instead of shifting so dequeue stays constant time.
  while (head < states.length) {
    if (states.length > MAX_SEARCH_STATES) {
      return { solution: undefined, exhausted: true };
    }

    const currentIndex = head;
    const current = states[currentIndex];
    head += 1;

    if (!current) {
      continue;
    }

    const floor = floors.get(current.floorId);

    if (!floor) {
      continue;
    }

    const enqueue = (next: SearchState): void => {
      const key = stateKey(next);

      if (visited.has(key)) {
        return;
      }

      visited.add(key);
      states.push(next);
    };

    for (const facing of FACINGS) {
      const targetCell = moveForward(current.cell, facing);

      if (!isBasePassable(floor, targetCell)) {
        continue;
      }

      const located = entitiesAt.get(entityKey(current.floorId, targetCell));
      const entity = located?.entity;

      const moveStep: TopologyStep = { type: "move", floorId: current.floorId, cell: targetCell };

      if (!entity) {
        enqueue({ ...current, cell: targetCell, parentIndex: currentIndex, steps: [moveStep] });
        continue;
      }

      if (entity.kind === "key") {
        const bit = entityBits.get(entity.id) ?? 0n;
        const alreadyCollected = isMarked(current.collected, bit);
        const keys = alreadyCollected
          ? current.keys
          : { ...current.keys, [entity.color]: current.keys[entity.color] + 1 };
        enqueue({
          ...current,
          cell: targetCell,
          keys,
          collected: current.collected | bit,
          parentIndex: currentIndex,
          steps: [{ ...moveStep, entityId: entity.id }],
        });
        continue;
      }

      // An enemy or a breakable wall is always defeatable and never recovers, so contact clears it and
      // the move completes in the same transition. Neither needs to enter the visited key.
      if (entity.kind === "enemy") {
        const defeatStep: TopologyStep = {
          type: "defeatEnemy",
          floorId: current.floorId,
          cell: targetCell,
          entityId: entity.id,
        };

        if (entity.id === floorSet.goalEntityId) {
          return { solution: buildSolution(states, currentIndex, [defeatStep]), exhausted: false };
        }

        enqueue({ ...current, cell: targetCell, parentIndex: currentIndex, steps: [defeatStep, moveStep] });
        continue;
      }

      if (entity.kind === "breakableWall") {
        const breakStep: TopologyStep = {
          type: "breakWall",
          floorId: current.floorId,
          cell: targetCell,
          entityId: entity.id,
        };
        enqueue({ ...current, cell: targetCell, parentIndex: currentIndex, steps: [breakStep, moveStep] });
        continue;
      }

      if (entity.kind === "door") {
        const bit = entityBits.get(entity.id) ?? 0n;

        if (isMarked(current.opened, bit)) {
          enqueue({ ...current, cell: targetCell, parentIndex: currentIndex, steps: [moveStep] });
          continue;
        }

        if (current.keys[entity.color] === 0) {
          continue;
        }

        enqueue({
          ...current,
          cell: targetCell,
          keys: { ...current.keys, [entity.color]: current.keys[entity.color] - 1 },
          opened: current.opened | bit,
          parentIndex: currentIndex,
          steps: [{ type: "openDoor", floorId: current.floorId, cell: targetCell, entityId: entity.id }, moveStep],
        });
        continue;
      }

      if (entity.kind === "stair") {
        const destination = entitiesById.get(entity.destinationStairId);

        if (!destination || destination.entity.kind !== "stair") {
          continue;
        }

        enqueue({
          ...current,
          floorId: destination.floorId,
          cell: destination.entity.cell,
          parentIndex: currentIndex,
          steps: [{ type: "useStair", floorId: current.floorId, cell: targetCell, entityId: entity.id }],
        });
      }
    }
  }

  return { solution: undefined, exhausted: false };
}

/** Validates parsed authored data and returns structural findings plus one legal solution when available. */
export function validateParsedFloorSet(floorSet: FloorSetSource): FloorValidationResult {
  const findings = [...validateReferences(floorSet)];

  if (findings.some((finding) => finding.severity === "error")) {
    return { findings, solution: undefined };
  }

  // The greedy pass answers almost every authored set in polynomial time; the exhaustive search only
  // runs when a limited key had to be committed to one of several same-colored doors.
  const greedySolution = solveGreedy(floorSet);

  if (greedySolution) {
    return { findings, solution: greedySolution };
  }

  const outcome = solveTopology(floorSet);

  if (outcome.exhausted) {
    findings.push(
      error(
        "topology.searchExhausted",
        `Structural search passed ${MAX_SEARCH_STATES} states without deciding whether the goal is reachable. Reduce the number of independent keys and doors.`,
      ),
    );
  } else if (!outcome.solution) {
    findings.push(error("topology.noSolution", "No legal structural route reaches the configured goal entity."));
  }

  return { findings, solution: outcome.solution };
}

/** Parses and validates unknown JSON through the same path used by runtime catalog assembly. */
export function validateFloorSet(value: unknown): FloorValidationResult {
  try {
    return validateParsedFloorSet(parseFloorSet(value));
  } catch (caught) {
    const message = caught instanceof FloorSchemaError ? caught.message : "Unable to parse floor content.";
    return { findings: [error("schema.invalid", message)], solution: undefined };
  }
}

import { ENEMY_ARCHETYPES } from "@/content/combat/enemies";
import { PLAYER_UPGRADES } from "@/content/combat/player-stages";
import {
  getFloorTileDefinition,
  isSolidTile,
  type FloorSetSource,
  type FloorSource,
  type FloorTile,
  type GameplayEntitySource,
} from "@/content/floor/floor-schema";
import { areSameCell, moveForward, type Cell, type Facing } from "@/core/grid";

export type FloorAuthoringResult =
  Readonly<{ ok: true; floorSet: FloorSetSource }> | Readonly<{ ok: false; message: string }>;

const FACINGS: readonly Facing[] = ["north", "east", "south", "west"];

function success(floorSet: FloorSetSource): FloorAuthoringResult {
  return { ok: true, floorSet };
}

function failure(message: string): FloorAuthoringResult {
  return { ok: false, message };
}

function floorIndex(floorSet: FloorSetSource, floorId: string): number {
  return floorSet.floors.findIndex((floor) => floor.id === floorId);
}

function isInsideFloor(floor: FloorSource, cell: Cell): boolean {
  return cell.y >= 0 && cell.y < floor.tiles.length && cell.x >= 0 && cell.x < (floor.tiles[0]?.length ?? 0);
}

function isPassable(floor: FloorSource, cell: Cell): boolean {
  return isInsideFloor(floor, cell) && !isSolidTile(floor.tiles[cell.y]?.[cell.x] ?? "#");
}

function contentIds(floorSet: FloorSetSource, ignoredId?: string): ReadonlySet<string> {
  const ids = new Set<string>();

  for (const floor of floorSet.floors) {
    for (const entity of floor.gameplayEntities) {
      if (entity.id !== ignoredId) {
        ids.add(entity.id);
      }
    }

    for (const feature of floor.environmentFeatures) {
      if (feature.id !== ignoredId) {
        ids.add(feature.id);
      }
    }
  }

  return ids;
}

function withFloor(floorSet: FloorSetSource, index: number, floor: FloorSource): FloorSetSource {
  return {
    ...floorSet,
    floors: floorSet.floors.map((candidate, candidateIndex) => (candidateIndex === index ? floor : candidate)),
  };
}

function validateEntityCell(floor: FloorSource, cell: Cell, ignoredEntityId?: string): string | undefined {
  if (!isInsideFloor(floor, cell)) {
    return "Gameplay entities must stay inside the selected floor.";
  }

  if (!isPassable(floor, cell)) {
    return "Gameplay entities require a passable base tile.";
  }

  if (floor.gameplayEntities.some((entity) => entity.id !== ignoredEntityId && areSameCell(entity.cell, cell))) {
    return "Only one gameplay entity may occupy a cell.";
  }

  return undefined;
}

function validateBreakableWall(floor: FloorSource, entity: GameplayEntitySource): string | undefined {
  if (entity.kind !== "breakableWall") {
    return undefined;
  }

  if (entity.health <= 0 || entity.defense < 0) {
    return "A breakable wall requires positive health and non-negative defense.";
  }

  const faces = new Set(entity.hintFaces);
  const hasOpposingPair =
    entity.hintFaces.length === 2 &&
    ((faces.has("north") && faces.has("south")) || (faces.has("east") && faces.has("west")));

  if (entity.hintFaces.length === 0 || entity.hintFaces.length > 2 || faces.size !== entity.hintFaces.length) {
    return "A breakable wall needs one hint face or two distinct opposing hint faces.";
  }

  if (entity.hintFaces.length === 2 && !hasOpposingPair) {
    return "Two breakable-wall hint faces must oppose each other.";
  }

  if (entity.hintFaces.some((face) => !isPassable(floor, moveForward(entity.cell, face)))) {
    return "Each breakable-wall hint face needs a passable observation cell.";
  }

  return undefined;
}

function validateEntityDefinition(
  floorSet: FloorSetSource,
  floor: FloorSource,
  entity: GameplayEntitySource,
  ignoredId?: string,
): string | undefined {
  if (entity.id.trim().length === 0) {
    return "Gameplay entities need a non-empty ID.";
  }

  if (contentIds(floorSet, ignoredId).has(entity.id)) {
    return `Content ID ${entity.id} is already in use.`;
  }

  const cellIssue = validateEntityCell(floor, entity.cell, ignoredId);

  if (cellIssue) {
    return cellIssue;
  }

  if (entity.kind === "enemy" && !ENEMY_ARCHETYPES.some((archetype) => archetype.id === entity.archetypeId)) {
    return `Unknown enemy archetype ${entity.archetypeId}.`;
  }

  if (
    entity.kind === "door" &&
    entity.upgradeEffectId !== undefined &&
    !PLAYER_UPGRADES.some((upgrade) => upgrade.id === entity.upgradeEffectId)
  ) {
    return `Unknown door upgrade effect ${entity.upgradeEffectId}.`;
  }

  return validateBreakableWall(floor, entity);
}

function defaultId(floorSet: FloorSetSource, floorId: string, kind: GameplayEntitySource["kind"], cell: Cell): string {
  const base = `${floorId.toLowerCase()}-${kind}-${cell.x}-${cell.y}`;
  const ids = contentIds(floorSet);
  let suffix = 1;
  let candidate = base;

  while (ids.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

/** Creates a complete, editable entity record for the selected passable cell. */
export function createDefaultGameplayEntity(
  floorSet: FloorSetSource,
  floorId: string,
  cell: Cell,
  kind: GameplayEntitySource["kind"],
): GameplayEntitySource | undefined {
  const index = floorIndex(floorSet, floorId);
  const floor = floorSet.floors[index];

  if (!floor || !isPassable(floor, cell)) {
    return undefined;
  }

  const id = defaultId(floorSet, floorId, kind, cell);

  if (kind === "enemy") {
    return { kind, id, cell, archetypeId: ENEMY_ARCHETYPES[0].id };
  }

  if (kind === "key") {
    return { kind, id, cell, color: "red" };
  }

  if (kind === "door") {
    return { kind, id, cell, color: "red" };
  }

  if (kind === "stair") {
    const destination = floorSet.floors.flatMap((candidateFloor) =>
      candidateFloor.gameplayEntities
        .filter(
          (candidate): candidate is Extract<GameplayEntitySource, { kind: "stair" }> => candidate.kind === "stair",
        )
        .map((candidate) => ({ floor: candidateFloor, stair: candidate })),
    )[0];

    if (!destination) {
      return undefined;
    }

    return {
      kind,
      id,
      cell,
      destinationFloorId: destination.floor.id,
      destinationCell: destination.stair.cell,
      destinationFacing: "north",
    };
  }

  if (kind === "breakableWall") {
    const hintFace = FACINGS.find((face) => isPassable(floor, moveForward(cell, face)));

    if (!hintFace) {
      return undefined;
    }

    return { kind, id, cell, health: 1, defense: 0, hintFaces: [hintFace] };
  }

  return { kind: "hotSpring", id, cell };
}

/** Paints one terrain cell while retaining every authored record that remains locally valid. */
export function paintTerrain(
  floorSet: FloorSetSource,
  floorId: string,
  cell: Cell,
  tile: FloorTile,
): FloorAuthoringResult {
  const index = floorIndex(floorSet, floorId);
  const floor = floorSet.floors[index];

  if (!floor || !isInsideFloor(floor, cell)) {
    return failure("The selected terrain cell is outside this floor.");
  }

  const definition = getFloorTileDefinition(tile);

  if (!definition) {
    return failure("The selected terrain material is unsupported.");
  }

  if (floor.tiles[cell.y]?.[cell.x] === tile) {
    return success(floorSet);
  }

  const becomesSolid = definition.blocksEntry;

  if (becomesSolid && floor.gameplayEntities.some((entity) => areSameCell(entity.cell, cell))) {
    return failure("A solid terrain tile cannot overwrite a gameplay entity.");
  }

  for (const feature of floor.environmentFeatures) {
    if (feature.kind === "wallDecoration") {
      if (areSameCell(feature.wallCell, cell) && !becomesSolid) {
        return failure("A wall decoration requires its anchor cell to remain solid terrain.");
      }

      if (areSameCell(moveForward(feature.wallCell, feature.face), cell) && becomesSolid) {
        return failure("A wall decoration requires its faced observation cell to remain passable.");
      }
      continue;
    }

    if (areSameCell(feature.cell, cell) && becomesSolid) {
      return failure("A cell environment feature requires its base terrain to remain passable.");
    }
  }

  const tiles = floor.tiles.map((row, y) =>
    y === cell.y ? `${row.slice(0, cell.x)}${tile}${row.slice(cell.x + 1)}` : row,
  );
  return success(withFloor(floorSet, index, { ...floor, tiles }));
}

/** Adds a complete gameplay entity after checking local placement and ID invariants. */
export function addGameplayEntity(
  floorSet: FloorSetSource,
  floorId: string,
  entity: GameplayEntitySource,
): FloorAuthoringResult {
  const index = floorIndex(floorSet, floorId);
  const floor = floorSet.floors[index];

  if (!floor) {
    return failure(`Unknown floor ${floorId}.`);
  }

  const issue = validateEntityDefinition(floorSet, floor, entity);

  if (issue) {
    return failure(issue);
  }

  return success(withFloor(floorSet, index, { ...floor, gameplayEntities: [...floor.gameplayEntities, entity] }));
}

/** Replaces non-coordinate fields for an existing entity without allowing a duplicate ID or invalid hint configuration. */
export function updateGameplayEntity(
  floorSet: FloorSetSource,
  floorId: string,
  originalId: string,
  entity: GameplayEntitySource,
): FloorAuthoringResult {
  const index = floorIndex(floorSet, floorId);
  const floor = floorSet.floors[index];

  if (!floor) {
    return failure(`Unknown floor ${floorId}.`);
  }

  const current = floor.gameplayEntities.find((candidate) => candidate.id === originalId);

  if (!current) {
    return failure(`Unknown gameplay entity ${originalId}.`);
  }

  if (current.kind !== entity.kind) {
    return failure("Change an entity kind by removing it and adding a new entity.");
  }

  const issue = validateEntityDefinition(floorSet, floor, entity, originalId);

  if (issue) {
    return failure(issue);
  }

  if (floorSet.goalEntityId === originalId && entity.kind !== "enemy") {
    return failure("The goal entity must remain an enemy.");
  }

  const goalEntityId = floorSet.goalEntityId === originalId ? entity.id : floorSet.goalEntityId;
  return success({
    ...withFloor(floorSet, index, {
      ...floor,
      gameplayEntities: floor.gameplayEntities.map((candidate) => (candidate.id === originalId ? entity : candidate)),
    }),
    goalEntityId,
  });
}

/** Removes a non-goal gameplay entity from the selected floor. */
export function removeGameplayEntity(
  floorSet: FloorSetSource,
  floorId: string,
  entityId: string,
): FloorAuthoringResult {
  if (floorSet.goalEntityId === entityId) {
    return failure("The goal entity cannot be removed while this workbench does not edit goal selection.");
  }

  const index = floorIndex(floorSet, floorId);
  const floor = floorSet.floors[index];

  if (!floor || !floor.gameplayEntities.some((entity) => entity.id === entityId)) {
    return failure(`Unknown gameplay entity ${entityId}.`);
  }

  return success(
    withFloor(floorSet, index, {
      ...floor,
      gameplayEntities: floor.gameplayEntities.filter((entity) => entity.id !== entityId),
    }),
  );
}

/** Moves one entity within its current floor without changing its identity or details. */
export function moveGameplayEntity(
  floorSet: FloorSetSource,
  floorId: string,
  entityId: string,
  cell: Cell,
): FloorAuthoringResult {
  const index = floorIndex(floorSet, floorId);
  const floor = floorSet.floors[index];
  const entity = floor?.gameplayEntities.find((candidate) => candidate.id === entityId);

  if (!floor || !entity) {
    return failure(`Unknown gameplay entity ${entityId}.`);
  }

  const issue = validateEntityCell(floor, cell, entityId);

  if (issue) {
    return failure(issue);
  }

  const moved = { ...entity, cell } as GameplayEntitySource;
  const hintIssue = validateBreakableWall(floor, moved);

  if (hintIssue) {
    return failure(hintIssue);
  }

  return success(
    withFloor(floorSet, index, {
      ...floor,
      gameplayEntities: floor.gameplayEntities.map((candidate) => (candidate.id === entityId ? moved : candidate)),
    }),
  );
}

function resizeConflicts(
  floorSet: FloorSetSource,
  floor: FloorSource,
  width: number,
  height: number,
): readonly string[] {
  const conflicts: string[] = [];
  const isRetained = (cell: Cell): boolean => cell.x >= 0 && cell.y >= 0 && cell.x < width && cell.y < height;

  for (const entity of floor.gameplayEntities) {
    if (!isRetained(entity.cell)) {
      conflicts.push(`Gameplay entity ${entity.id} at (${entity.cell.x}, ${entity.cell.y}) would be removed.`);
    }
  }

  for (const feature of floor.environmentFeatures) {
    const cell = feature.kind === "wallDecoration" ? feature.wallCell : feature.cell;

    if (!isRetained(cell)) {
      conflicts.push(`Environment feature ${feature.id} at (${cell.x}, ${cell.y}) would be removed.`);
      continue;
    }

    if (feature.kind === "wallDecoration" && !isRetained(moveForward(feature.wallCell, feature.face))) {
      conflicts.push(`Wall decoration ${feature.id} would lose its passable observation cell.`);
    }
  }

  if (floorSet.initial.floorId === floor.id && !isRetained(floorSet.initial.cell)) {
    conflicts.push("The initial player cell would be removed.");
  }

  for (const sourceFloor of floorSet.floors) {
    for (const entity of sourceFloor.gameplayEntities) {
      if (entity.kind === "stair" && entity.destinationFloorId === floor.id && !isRetained(entity.destinationCell)) {
        conflicts.push(`Stair ${entity.id} from ${sourceFloor.id} would lose its destination.`);
      }
    }
  }

  return conflicts;
}

/** Resizes one floor from its top-left origin, preserving retained cells and rejecting destructive crops. */
export function resizeFloor(
  floorSet: FloorSetSource,
  floorId: string,
  width: number,
  height: number,
): FloorAuthoringResult {
  const index = floorIndex(floorSet, floorId);
  const floor = floorSet.floors[index];

  if (!floor) {
    return failure(`Unknown floor ${floorId}.`);
  }

  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return failure("Floor width and height must be positive whole numbers.");
  }

  const currentWidth = floor.tiles[0]?.length ?? 0;
  const currentHeight = floor.tiles.length;

  if (width === currentWidth && height === currentHeight) {
    return success(floorSet);
  }

  const conflicts = resizeConflicts(floorSet, floor, width, height);

  if (conflicts.length > 0) {
    return failure(`Resize refused: ${conflicts.join(" ")}`);
  }

  const tiles = Array.from({ length: height }, (_, y) => {
    const retained = floor.tiles[y]?.slice(0, width) ?? "";
    return retained.padEnd(width, "#");
  });

  return success(withFloor(floorSet, index, { ...floor, tiles }));
}

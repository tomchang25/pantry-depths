import { ENEMY_ARCHETYPES } from "@/content/combat/enemies";
import { PLAYER_UPGRADES } from "@/content/combat/player-stages";
import {
  getFloorTileDefinition,
  isSolidTile,
  type EnvironmentFeatureSource,
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

  if (entity.kind === "stair") {
    const destination = floorSet.floors
      .flatMap((candidateFloor) => candidateFloor.gameplayEntities)
      .find((candidate) => candidate.id === entity.destinationStairId);

    if (!destination || destination.kind !== "stair" || destination.id === ignoredId) {
      return "A stair must target another authored stair ID.";
    }
  }

  return validateBreakableWall(floor, entity);
}

function defaultId(
  floorSet: FloorSetSource,
  floorId: string,
  kind: GameplayEntitySource["kind"] | EnvironmentFeatureSource["kind"],
  cell: Cell,
): string {
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
      destinationStairId: destination.stair.id,
      arrivalFacing: "north",
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

/** Replaces non-coordinate fields, rewriting inbound stair references when a stair ID changes. */
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
  const renamedStair = current.kind === "stair" && entity.id !== originalId;
  const floors = floorSet.floors.map((candidateFloor, candidateIndex) => ({
    ...candidateFloor,
    gameplayEntities: candidateFloor.gameplayEntities.map((candidate) => {
      if (candidateIndex === index && candidate.id === originalId) {
        return entity;
      }

      if (renamedStair && candidate.kind === "stair" && candidate.destinationStairId === originalId) {
        return { ...candidate, destinationStairId: entity.id };
      }

      return candidate;
    }),
  }));

  return success({ ...floorSet, floors, goalEntityId });
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
  const entity = floor?.gameplayEntities.find((candidate) => candidate.id === entityId);

  if (!floor || !entity) {
    return failure(`Unknown gameplay entity ${entityId}.`);
  }

  if (entity.kind === "stair") {
    const inboundStairs = floorSet.floors.flatMap((candidateFloor) =>
      candidateFloor.gameplayEntities.filter(
        (candidate): candidate is Extract<GameplayEntitySource, { kind: "stair" }> =>
          candidate.kind === "stair" && candidate.id !== entityId && candidate.destinationStairId === entityId,
      ),
    );

    if (inboundStairs.length > 0) {
      return failure(`Remove or redirect inbound stairs first: ${inboundStairs.map((stair) => stair.id).join(", ")}.`);
    }
  }

  return success(
    withFloor(floorSet, index, {
      ...floor,
      gameplayEntities: floor.gameplayEntities.filter((candidate) => candidate.id !== entityId),
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

function featureAnchorCell(feature: EnvironmentFeatureSource): Cell {
  return feature.kind === "wallDecoration" ? feature.wallCell : feature.cell;
}

function wallDecorationConflict(floor: FloorSource, wallCell: Cell, face: Facing, ignoredId?: string): boolean {
  return floor.environmentFeatures.some(
    (feature) =>
      feature.kind === "wallDecoration" &&
      feature.id !== ignoredId &&
      areSameCell(feature.wallCell, wallCell) &&
      feature.face === face,
  );
}

function tileDecorationConflict(floor: FloorSource, cell: Cell, ignoredId?: string): boolean {
  return floor.environmentFeatures.some(
    (feature) => feature.kind === "tileDecoration" && feature.id !== ignoredId && areSameCell(feature.cell, cell),
  );
}

function legalWallDecorationFaces(floor: FloorSource, wallCell: Cell, ignoredId?: string): readonly Facing[] {
  if (!isInsideFloor(floor, wallCell) || !isSolidTile(floor.tiles[wallCell.y]?.[wallCell.x] ?? ".")) {
    return [];
  }

  return FACINGS.filter(
    (face) =>
      isPassable(floor, moveForward(wallCell, face)) && !wallDecorationConflict(floor, wallCell, face, ignoredId),
  );
}

/** Reports which environment-feature kinds may currently be added at the selected cell. */
export function legalEnvironmentFeatureKinds(
  floor: FloorSource,
  cell: Cell,
): readonly EnvironmentFeatureSource["kind"][] {
  const kinds: EnvironmentFeatureSource["kind"][] = [];
  const passable = isPassable(floor, cell);

  if (passable && !tileDecorationConflict(floor, cell)) {
    kinds.push("tileDecoration");
  }

  if (legalWallDecorationFaces(floor, cell).length > 0) {
    kinds.push("wallDecoration");
  }

  if (passable) {
    kinds.push("ambientLight", "effectEmitter");
  }

  return kinds;
}

export type EnvironmentPresetSuggestions = Readonly<{
  decoration: readonly string[];
  effect: readonly string[];
  light: readonly string[];
}>;

/** Collects every preset identifier already used anywhere in the draft, deduplicated and sorted. */
export function collectPresetSuggestions(floorSet: FloorSetSource): EnvironmentPresetSuggestions {
  const decoration = new Set<string>();
  const light = new Set<string>();
  const effect = new Set<string>();

  for (const floor of floorSet.floors) {
    for (const feature of floor.environmentFeatures) {
      if (feature.kind === "tileDecoration" || feature.kind === "wallDecoration") {
        decoration.add(feature.decorationPresetId);
      }

      if (feature.kind === "ambientLight") {
        light.add(feature.lightPresetId);
      } else if (feature.kind === "wallDecoration" && feature.lightPresetId) {
        light.add(feature.lightPresetId);
      }

      if (feature.kind === "effectEmitter") {
        effect.add(feature.effectPresetId);
      } else if (feature.kind === "wallDecoration" && feature.effectPresetId) {
        effect.add(feature.effectPresetId);
      }
    }
  }

  return {
    decoration: [...decoration].sort(),
    light: [...light].sort(),
    effect: [...effect].sort(),
  };
}

function defaultPreset(suggestions: readonly string[]): string {
  return suggestions[0] ?? "unspecified";
}

/** Creates a complete, editable environment-feature record for the selected cell. */
export function createDefaultEnvironmentFeature(
  floorSet: FloorSetSource,
  floorId: string,
  cell: Cell,
  kind: EnvironmentFeatureSource["kind"],
): EnvironmentFeatureSource | undefined {
  const floor = floorSet.floors[floorIndex(floorSet, floorId)];

  if (!floor) {
    return undefined;
  }

  const suggestions = collectPresetSuggestions(floorSet);
  const id = defaultId(floorSet, floorId, kind, cell);

  if (kind === "tileDecoration") {
    if (!isPassable(floor, cell) || tileDecorationConflict(floor, cell)) {
      return undefined;
    }

    return { kind, id, cell, decorationPresetId: defaultPreset(suggestions.decoration) };
  }

  if (kind === "wallDecoration") {
    const face = legalWallDecorationFaces(floor, cell)[0];

    if (!face) {
      return undefined;
    }

    return { kind, id, wallCell: cell, face, decorationPresetId: defaultPreset(suggestions.decoration) };
  }

  if (kind === "ambientLight") {
    if (!isPassable(floor, cell)) {
      return undefined;
    }

    return { kind, id, cell, lightPresetId: defaultPreset(suggestions.light) };
  }

  if (!isPassable(floor, cell)) {
    return undefined;
  }

  return { kind: "effectEmitter", id, cell, effectPresetId: defaultPreset(suggestions.effect) };
}

function normalizeEnvironmentFeature(feature: EnvironmentFeatureSource): EnvironmentFeatureSource {
  const id = feature.id.trim();

  if (feature.kind === "tileDecoration") {
    return { ...feature, id, decorationPresetId: feature.decorationPresetId.trim() };
  }

  if (feature.kind === "wallDecoration") {
    const { lightPresetId: _ignoredLightPresetId, effectPresetId: _ignoredEffectPresetId, ...rest } = feature;
    const lightPresetId = feature.lightPresetId?.trim();
    const effectPresetId = feature.effectPresetId?.trim();

    return {
      ...rest,
      id,
      decorationPresetId: feature.decorationPresetId.trim(),
      ...(lightPresetId ? { lightPresetId } : {}),
      ...(effectPresetId ? { effectPresetId } : {}),
    };
  }

  if (feature.kind === "ambientLight") {
    return { ...feature, id, lightPresetId: feature.lightPresetId.trim() };
  }

  return { ...feature, id, effectPresetId: feature.effectPresetId.trim() };
}

function validateEnvironmentFeatureDefinition(
  floorSet: FloorSetSource,
  floor: FloorSource,
  feature: EnvironmentFeatureSource,
  ignoredId?: string,
): string | undefined {
  if (feature.id.length === 0) {
    return "Environment features need a non-empty ID.";
  }

  if (contentIds(floorSet, ignoredId).has(feature.id)) {
    return `Content ID ${feature.id} is already in use.`;
  }

  if (feature.kind === "wallDecoration") {
    if (
      !isInsideFloor(floor, feature.wallCell) ||
      !isSolidTile(floor.tiles[feature.wallCell.y]?.[feature.wallCell.x] ?? ".")
    ) {
      return "A wall decoration must anchor to an in-bounds solid wall.";
    }

    if (!isPassable(floor, moveForward(feature.wallCell, feature.face))) {
      return "A wall decoration's outward face needs a passable observation cell.";
    }

    if (wallDecorationConflict(floor, feature.wallCell, feature.face, ignoredId)) {
      return "Only one wall decoration may use this anchor and face.";
    }

    if (feature.decorationPresetId.length === 0) {
      return "A wall decoration needs a decoration preset.";
    }

    if (feature.lightPresetId !== undefined && feature.lightPresetId.length === 0) {
      return "Clear the light preset field instead of leaving it blank.";
    }

    if (feature.effectPresetId !== undefined && feature.effectPresetId.length === 0) {
      return "Clear the effect preset field instead of leaving it blank.";
    }

    return undefined;
  }

  if (!isPassable(floor, feature.cell)) {
    return "Environment features require a passable base tile.";
  }

  if (feature.kind === "tileDecoration") {
    if (tileDecorationConflict(floor, feature.cell, ignoredId)) {
      return "Only one tile decoration may use this cell.";
    }

    if (feature.decorationPresetId.length === 0) {
      return "A tile decoration needs a decoration preset.";
    }

    return undefined;
  }

  if (feature.kind === "ambientLight") {
    if (feature.lightPresetId.length === 0) {
      return "An ambient light needs a light preset.";
    }

    return undefined;
  }

  if (feature.effectPresetId.length === 0) {
    return "An effect emitter needs an effect preset.";
  }

  return undefined;
}

/** Adds a complete environment feature after checking local placement and ID invariants. */
export function addEnvironmentFeature(
  floorSet: FloorSetSource,
  floorId: string,
  feature: EnvironmentFeatureSource,
): FloorAuthoringResult {
  const index = floorIndex(floorSet, floorId);
  const floor = floorSet.floors[index];

  if (!floor) {
    return failure(`Unknown floor ${floorId}.`);
  }

  const normalized = normalizeEnvironmentFeature(feature);
  const issue = validateEnvironmentFeatureDefinition(floorSet, floor, normalized);

  if (issue) {
    return failure(issue);
  }

  return success(
    withFloor(floorSet, index, { ...floor, environmentFeatures: [...floor.environmentFeatures, normalized] }),
  );
}

/** Replaces one environment feature's identifier, face, and preset fields. */
export function updateEnvironmentFeature(
  floorSet: FloorSetSource,
  floorId: string,
  originalId: string,
  feature: EnvironmentFeatureSource,
): FloorAuthoringResult {
  const index = floorIndex(floorSet, floorId);
  const floor = floorSet.floors[index];

  if (!floor) {
    return failure(`Unknown floor ${floorId}.`);
  }

  const current = floor.environmentFeatures.find((candidate) => candidate.id === originalId);

  if (!current) {
    return failure(`Unknown environment feature ${originalId}.`);
  }

  if (current.kind !== feature.kind) {
    return failure("Change an environment feature kind by removing it and adding a new one.");
  }

  const normalized = normalizeEnvironmentFeature(feature);
  const issue = validateEnvironmentFeatureDefinition(floorSet, floor, normalized, originalId);

  if (issue) {
    return failure(issue);
  }

  return success(
    withFloor(floorSet, index, {
      ...floor,
      environmentFeatures: floor.environmentFeatures.map((candidate) =>
        candidate.id === originalId ? normalized : candidate,
      ),
    }),
  );
}

/** Removes an environment feature from the selected floor. */
export function removeEnvironmentFeature(
  floorSet: FloorSetSource,
  floorId: string,
  featureId: string,
): FloorAuthoringResult {
  const index = floorIndex(floorSet, floorId);
  const floor = floorSet.floors[index];
  const feature = floor?.environmentFeatures.find((candidate) => candidate.id === featureId);

  if (!floor || !feature) {
    return failure(`Unknown environment feature ${featureId}.`);
  }

  return success(
    withFloor(floorSet, index, {
      ...floor,
      environmentFeatures: floor.environmentFeatures.filter((candidate) => candidate.id !== featureId),
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
    const cell = featureAnchorCell(feature);

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

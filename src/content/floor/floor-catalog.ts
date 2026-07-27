import floorSetJson from "@/content/floors/provisional-floor-set.json";
import { ENEMY_ARCHETYPES } from "@/content/combat/enemies";
import { PLAYER_BASELINE, PLAYER_UPGRADES } from "@/content/combat/player-stages";
import {
  isSolidTile,
  parseFloorSet,
  type FloorSetSource,
  type GameplayEntitySource,
} from "@/content/floor/floor-schema";
import { validateParsedFloorSet, type FloorValidationResult } from "@/content/floor/floor-validation";
import type { Cell } from "@/core/grid";
import { assertNever, type RunWorld, type WorldEntity } from "@/core/run-state";

type LocatedStair = Readonly<{
  floorId: string;
  entity: Extract<GameplayEntitySource, { kind: "stair" }>;
}>;

function assembleEntity(
  floorId: string,
  entity: GameplayEntitySource,
  stairsById: ReadonlyMap<string, LocatedStair>,
): WorldEntity {
  if (entity.kind === "enemy") {
    const archetype = ENEMY_ARCHETYPES.find((candidate) => candidate.id === entity.archetypeId);

    if (!archetype) {
      throw new Error(`unknown enemy archetype: ${entity.archetypeId}`);
    }

    return {
      kind: "enemy",
      id: entity.id,
      floorId,
      cell: entity.cell,
      appearanceId: archetype.appearanceId,
      movement: { blocksEntry: true },
      combat: {
        health: archetype.health,
        attack: archetype.attack,
        defense: archetype.defense,
        retaliates: true,
      },
    };
  }

  if (entity.kind === "key") {
    return {
      kind: "key",
      id: entity.id,
      floorId,
      cell: entity.cell,
      pickup: { effects: [{ type: "grantKey", color: entity.color, amount: 1 }, { type: "deactivateSelf" }] },
    };
  }

  if (entity.kind === "door") {
    return {
      kind: "door",
      id: entity.id,
      floorId,
      cell: entity.cell,
      movement: { blocksEntry: true },
      interaction: {
        requirements: [{ type: "key", color: entity.color, amount: 1 }],
        effects: [
          { type: "consumeKey", color: entity.color, amount: 1 },
          ...(entity.upgradeEffectId ? [{ type: "applyUpgrade" as const, effectId: entity.upgradeEffectId }] : []),
          { type: "deactivateSelf" },
        ],
      },
    };
  }

  if (entity.kind === "stair") {
    const destination = stairsById.get(entity.destinationStairId);

    if (!destination) {
      throw new Error(`unknown destination stair: ${entity.destinationStairId}`);
    }

    return {
      kind: "stair",
      id: entity.id,
      floorId,
      cell: entity.cell,
      movement: { blocksEntry: true },
      interaction: {
        effects: [
          {
            type: "transition",
            floorId: destination.floorId,
            cell: destination.entity.cell,
            facing: destination.entity.arrivalFacing,
          },
        ],
      },
    };
  }

  if (entity.kind === "breakableWall") {
    return {
      kind: "breakableWall",
      id: entity.id,
      floorId,
      cell: entity.cell,
      directionalHint: { faces: entity.hintFaces },
      movement: { blocksEntry: true },
      combat: { health: entity.health, attack: 0, defense: entity.defense, retaliates: false },
    };
  }

  if (entity.kind === "hotSpring") {
    return {
      kind: "hotSpring",
      id: entity.id,
      floorId,
      cell: entity.cell,
      movement: { blocksEntry: true },
      interaction: { effects: [{ type: "restoreHealth" }] },
    };
  }

  if (entity.kind === "exit") {
    return {
      kind: "exit",
      id: entity.id,
      floorId,
      cell: entity.cell,
      movement: { blocksEntry: true },
      interaction: { effects: [{ type: "completeRun" }] },
    };
  }

  // A new gameplay entity kind must declare its own capabilities rather than inherit the last branch's.
  return assertNever(entity);
}

function collectSolidCells(tiles: readonly string[]): readonly Cell[] {
  const cells: Cell[] = [];

  for (let y = 0; y < tiles.length; y += 1) {
    const row = tiles[y];

    if (!row) {
      continue;
    }

    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];

      if (tile && isSolidTile(tile)) {
        cells.push({ x, y });
      }
    }
  }

  return cells;
}

/** Assembles canonical gameplay input from validated authored floor content. */
export function createRunWorldFromFloorSet(floorSet: FloorSetSource): RunWorld {
  const validation = validateParsedFloorSet(floorSet);
  const errors = validation.findings.filter((finding) => finding.severity === "error");

  if (errors.length > 0) {
    throw new Error(errors.map((finding) => `${finding.code}: ${finding.message}`).join("\n"));
  }

  const stairsById = new Map<string, LocatedStair>();

  for (const floor of floorSet.floors) {
    for (const entity of floor.gameplayEntities) {
      if (entity.kind === "stair") {
        stairsById.set(entity.id, { floorId: floor.id, entity });
      }
    }
  }

  return {
    floors: floorSet.floors.map((floor) => ({
      id: floor.id,
      width: floor.tiles[0]?.length ?? 0,
      height: floor.tiles.length,
      solidCells: collectSolidCells(floor.tiles),
    })),
    player: PLAYER_BASELINE,
    initialFloorId: floorSet.initial.floorId,
    initialCell: floorSet.initial.cell,
    initialFacing: floorSet.initial.facing,
    entities: floorSet.floors.flatMap((floor) =>
      floor.gameplayEntities.map((entity) => assembleEntity(floor.id, entity, stairsById)),
    ),
    upgradeEffects: PLAYER_UPGRADES,
  };
}

export const PROVISIONAL_FLOOR_SET = parseFloorSet(floorSetJson);
export const PROVISIONAL_FLOOR_VALIDATION: FloorValidationResult = validateParsedFloorSet(PROVISIONAL_FLOOR_SET);
export const PROVISIONAL_RUN_WORLD = createRunWorldFromFloorSet(PROVISIONAL_FLOOR_SET);

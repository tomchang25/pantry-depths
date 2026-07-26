import type { Cell, Facing } from "@/core/grid";
import type { EntityKind, KeyColor } from "@/core/run-state";

export const FLOOR_TILE_DEFINITIONS = {
  ".": { material: "floor", label: "Passable floor", blocksEntry: false },
  "#": { material: "stoneWall", label: "Stone wall", blocksEntry: true },
  "=": { material: "oldBrickWall", label: "Old brick wall", blocksEntry: true },
  "+": { material: "ironBarWall", label: "Iron-bar wall", blocksEntry: true },
} as const;

export type FloorTile = keyof typeof FLOOR_TILE_DEFINITIONS;

export type FloorTileDefinition = (typeof FLOOR_TILE_DEFINITIONS)[FloorTile];

export type FloorEntitySource =
  | Readonly<{ kind: "enemy"; id: string; cell: Cell; archetypeId: string }>
  | Readonly<{ kind: "key"; id: string; cell: Cell; color: KeyColor }>
  | Readonly<{ kind: "door"; id: string; cell: Cell; color: KeyColor; upgradeEffectId?: string }>
  | Readonly<{
      kind: "stair";
      id: string;
      cell: Cell;
      destinationFloorId: string;
      destinationCell: Cell;
      destinationFacing: Facing;
    }>
  | Readonly<{
      kind: "breakableWall";
      id: string;
      cell: Cell;
      health: number;
      defense: number;
      hintFaces: readonly Facing[];
    }>
  | Readonly<{ kind: "hotSpring"; id: string; cell: Cell }>;

export type FloorSource = Readonly<{
  id: string;
  theme: string;
  tiles: readonly string[];
  entities: readonly FloorEntitySource[];
}>;

export type FloorSetSource = Readonly<{
  schemaVersion: 1;
  initial: Readonly<{ floorId: string; cell: Cell; facing: Facing }>;
  goalEntityId: string;
  floors: readonly FloorSource[];
}>;

export class FloorSchemaError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "FloorSchemaError";
  }
}

const FACINGS = new Set<Facing>(["north", "east", "south", "west"]);
const KEY_COLORS = new Set<KeyColor>(["red", "blue", "yellow"]);
const ENTITY_KINDS = new Set<EntityKind>(["enemy", "key", "door", "stair", "breakableWall", "hotSpring"]);

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FloorSchemaError(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new FloorSchemaError(`${label} must be a non-empty string`);
  }

  return value;
}

function asFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new FloorSchemaError(`${label} must be a finite number`);
  }

  return value;
}

function asArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new FloorSchemaError(`${label} must be an array`);
  }

  return value;
}

function parseCell(value: unknown, label: string): Cell {
  const record = asRecord(value, label);
  const x = asFiniteNumber(record.x, `${label}.x`);
  const y = asFiniteNumber(record.y, `${label}.y`);

  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new FloorSchemaError(`${label} must use integer coordinates`);
  }

  return { x, y };
}

function parseFacing(value: unknown, label: string): Facing {
  if (typeof value !== "string" || !FACINGS.has(value as Facing)) {
    throw new FloorSchemaError(`${label} must be a cardinal facing`);
  }

  return value as Facing;
}

function parseKeyColor(value: unknown, label: string): KeyColor {
  if (typeof value !== "string" || !KEY_COLORS.has(value as KeyColor)) {
    throw new FloorSchemaError(`${label} must be a key color`);
  }

  return value as KeyColor;
}

function parseEntity(value: unknown, label: string): FloorEntitySource {
  const record = asRecord(value, label);
  const kind = record.kind;

  if (typeof kind !== "string" || !ENTITY_KINDS.has(kind as EntityKind)) {
    throw new FloorSchemaError(`${label}.kind must be a supported entity kind`);
  }

  const id = asString(record.id, `${label}.id`);
  const cell = parseCell(record.cell, `${label}.cell`);

  if (kind === "enemy") {
    return { kind, id, cell, archetypeId: asString(record.archetypeId, `${label}.archetypeId`) };
  }

  if (kind === "key") {
    return { kind, id, cell, color: parseKeyColor(record.color, `${label}.color`) };
  }

  if (kind === "door") {
    const upgradeEffectId = record.upgradeEffectId;

    return {
      kind,
      id,
      cell,
      color: parseKeyColor(record.color, `${label}.color`),
      ...(upgradeEffectId === undefined
        ? {}
        : { upgradeEffectId: asString(upgradeEffectId, `${label}.upgradeEffectId`) }),
    };
  }

  if (kind === "stair") {
    return {
      kind,
      id,
      cell,
      destinationFloorId: asString(record.destinationFloorId, `${label}.destinationFloorId`),
      destinationCell: parseCell(record.destinationCell, `${label}.destinationCell`),
      destinationFacing: parseFacing(record.destinationFacing, `${label}.destinationFacing`),
    };
  }

  if (kind === "breakableWall") {
    const health = asFiniteNumber(record.health, `${label}.health`);
    const defense = asFiniteNumber(record.defense, `${label}.defense`);

    if (health <= 0 || defense < 0) {
      throw new FloorSchemaError(`${label} must use positive health and non-negative defense`);
    }

    return {
      kind,
      id,
      cell,
      health,
      defense,
      hintFaces: asArray(record.hintFaces, `${label}.hintFaces`).map((face, index) =>
        parseFacing(face, `${label}.hintFaces[${index}]`),
      ),
    };
  }

  return { kind: "hotSpring", id, cell };
}

function parseFloor(value: unknown, index: number): FloorSource {
  const label = `floors[${index}]`;
  const record = asRecord(value, label);
  const tiles = asArray(record.tiles, `${label}.tiles`).map((row, rowIndex) => {
    const text = asString(row, `${label}.tiles[${rowIndex}]`);

    for (const tile of text) {
      if (!Object.hasOwn(FLOOR_TILE_DEFINITIONS, tile)) {
        throw new FloorSchemaError(`${label}.tiles[${rowIndex}] contains an unknown tile ${tile}`);
      }
    }

    return text;
  });

  if (tiles.length === 0 || tiles[0]?.length === 0 || tiles.some((row) => row.length !== tiles[0]?.length)) {
    throw new FloorSchemaError(`${label}.tiles must be a non-empty rectangle`);
  }

  return {
    id: asString(record.id, `${label}.id`),
    theme: asString(record.theme, `${label}.theme`),
    tiles,
    entities: asArray(record.entities, `${label}.entities`).map((entity, entityIndex) =>
      parseEntity(entity, `${label}.entities[${entityIndex}]`),
    ),
  };
}

/** Parses untrusted JSON into the floor content contract used by catalog and validation code. */
export function parseFloorSet(value: unknown): FloorSetSource {
  const record = asRecord(value, "floor set");

  if (record.schemaVersion !== 1) {
    throw new FloorSchemaError("floor set.schemaVersion must be 1");
  }

  const initial = asRecord(record.initial, "floor set.initial");

  return {
    schemaVersion: 1,
    initial: {
      floorId: asString(initial.floorId, "floor set.initial.floorId"),
      cell: parseCell(initial.cell, "floor set.initial.cell"),
      facing: parseFacing(initial.facing, "floor set.initial.facing"),
    },
    goalEntityId: asString(record.goalEntityId, "floor set.goalEntityId"),
    floors: asArray(record.floors, "floor set.floors").map(parseFloor),
  };
}

export function getFloorTileDefinition(tile: string): FloorTileDefinition | undefined {
  return Object.hasOwn(FLOOR_TILE_DEFINITIONS, tile) ? FLOOR_TILE_DEFINITIONS[tile as FloorTile] : undefined;
}

export function isSolidTile(tile: string): boolean {
  return getFloorTileDefinition(tile)?.blocksEntry ?? true;
}

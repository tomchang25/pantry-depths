import { getEnemyArchetype, type EnemyId } from "@/content/combat/enemies";
import type { FloorSetSource, FloorSource, FloorTile } from "@/content/floor/floor-schema";
import { WORLD_SPRITE_PLACEMENTS, type SpritePlacement } from "@/content/presentation/sprite-placements";
import { DECORATION_PRESETS, EFFECT_PRESETS, LIGHT_PRESETS } from "@/presentation/environment-presets";
import type { Cell, Facing } from "@/core/grid";
import type { KeyColor, RunSnapshot, RunWorld } from "@/core/run-state";

export type CameraPose = Readonly<{ x: number; y: number; angle: number }>;

export type RenderSurfaceMaterial =
  "stoneWall" | "oldBrickWall" | "ironBarWall" | "doorRed" | "doorBlue" | "doorYellow" | "breakableWall";

export type RenderSurface = Readonly<{
  cell: Cell;
  material: RenderSurfaceMaterial;
  hintFaces?: readonly Facing[];
}>;

export type RenderSprite = Readonly<{
  id: string;
  x: number;
  y: number;
  placement: "billboard" | "ground" | "wall";
  assetId: string;
  scale: number;
  verticalAnchor: number;
  enemyId?: EnemyId;
  wallFace?: Facing;
}>;

export type RenderLight = Readonly<{
  id: string;
  x: number;
  y: number;
  radius: number;
  color: readonly [number, number, number];
  intensity: number;
}>;

export type RenderEmitter = Readonly<{
  id: string;
  x: number;
  y: number;
  kind: "embers" | "steam";
  density: number;
}>;

export type RenderScene = Readonly<{
  floorId: string;
  theme: string;
  width: number;
  height: number;
  tiles: readonly string[];
  camera: CameraPose;
  surfaces: readonly RenderSurface[];
  sprites: readonly RenderSprite[];
  lights: readonly RenderLight[];
  emitters: readonly RenderEmitter[];
}>;

const FACING_ANGLES: Readonly<Record<Facing, number>> = {
  east: 0,
  south: Math.PI / 2,
  west: Math.PI,
  north: -Math.PI / 2,
};

const TILE_MATERIALS: Readonly<Partial<Record<FloorTile, RenderSurfaceMaterial>>> = {
  "#": "stoneWall",
  "=": "oldBrickWall",
  "+": "ironBarWall",
};

const WALL_FACE_OFFSETS: Readonly<Record<Facing, Readonly<{ x: number; y: number }>>> = {
  north: { x: 0.5, y: -0.015 },
  east: { x: 1.015, y: 0.5 },
  south: { x: 0.5, y: 1.015 },
  west: { x: -0.015, y: 0.5 },
};

export function cameraPoseFromSnapshot(snapshot: RunSnapshot): CameraPose {
  return {
    x: snapshot.player.cell.x + 0.5,
    y: snapshot.player.cell.y + 0.5,
    angle: FACING_ANGLES[snapshot.player.facing],
  };
}

function requireFloor(floorSet: FloorSetSource, floorId: string): FloorSource {
  const floor = floorSet.floors.find((candidate) => candidate.id === floorId);

  if (!floor) {
    throw new Error(`render scene: unknown floor ${floorId}`);
  }

  return floor;
}

function activeEntityIds(snapshot: RunSnapshot): ReadonlySet<string> {
  return new Set(snapshot.entities.filter((entity) => entity.active).map((entity) => entity.id));
}

function terrainSurfaces(floor: FloorSource): RenderSurface[] {
  const surfaces: RenderSurface[] = [];

  for (let y = 0; y < floor.tiles.length; y += 1) {
    const row = floor.tiles[y];

    if (!row) {
      continue;
    }

    for (let x = 0; x < row.length; x += 1) {
      const material = TILE_MATERIALS[row[x] as FloorTile];

      if (material) {
        surfaces.push({ cell: { x, y }, material });
      }
    }
  }

  return surfaces;
}

function groundSprite(id: string, cell: Cell, assetId: string, size: SpritePlacement): RenderSprite {
  return { id, x: cell.x + 0.5, y: cell.y + 0.5, placement: "ground", assetId, ...size };
}

function projectGameplay(
  floor: FloorSource,
  world: RunWorld,
  activeIds: ReadonlySet<string>,
  surfaces: RenderSurface[],
  sprites: RenderSprite[],
): void {
  for (const source of floor.gameplayEntities) {
    if (!activeIds.has(source.id)) {
      continue;
    }

    if (source.kind === "door") {
      const color = `${source.color[0]?.toUpperCase()}${source.color.slice(1)}`;
      surfaces.push({ cell: source.cell, material: `door${color}` as RenderSurfaceMaterial });
      continue;
    }

    if (source.kind === "breakableWall") {
      surfaces.push({ cell: source.cell, material: "breakableWall", hintFaces: source.hintFaces });
      continue;
    }

    if (source.kind === "enemy") {
      const entity = world.entities.find((candidate) => candidate.id === source.id);
      const enemyId = entity?.appearanceId as EnemyId | undefined;

      if (!enemyId) {
        continue;
      }

      const archetype = getEnemyArchetype(enemyId);
      sprites.push({
        id: source.id,
        x: source.cell.x + 0.5,
        y: source.cell.y + 0.5,
        placement: "billboard",
        assetId: `enemy.${enemyId}.normal`,
        enemyId,
        scale: archetype.displayScale,
        verticalAnchor: archetype.verticalAnchor,
      });
      continue;
    }

    if (source.kind === "key") {
      sprites.push({
        id: source.id,
        x: source.cell.x + 0.5,
        y: source.cell.y + 0.5,
        placement: "billboard",
        assetId: `key.${source.color satisfies KeyColor}`,
        ...WORLD_SPRITE_PLACEMENTS.key,
      });
      continue;
    }

    if (source.kind === "stair") {
      sprites.push(groundSprite(source.id, source.cell, "presentation.stair", WORLD_SPRITE_PLACEMENTS.stair));
      continue;
    }

    if (source.kind === "hotSpring") {
      sprites.push(groundSprite(source.id, source.cell, "presentation.hotSpring", WORLD_SPRITE_PLACEMENTS.hotSpring));
      continue;
    }

    // A new gameplay entity kind must choose its own presentation form rather than inherit one.
    source satisfies never;
  }
}

function projectEnvironment(
  floor: FloorSource,
  sprites: RenderSprite[],
  lights: RenderLight[],
  emitters: RenderEmitter[],
): void {
  for (const feature of floor.environmentFeatures) {
    if (feature.kind === "tileDecoration") {
      const preset = DECORATION_PRESETS[feature.decorationPresetId];

      if (preset) {
        sprites.push({
          id: feature.id,
          x: feature.cell.x + 0.5,
          y: feature.cell.y + 0.5,
          placement: "ground",
          assetId: preset.assetId,
          scale: preset.scale,
          verticalAnchor: preset.verticalAnchor,
        });
      }
      continue;
    }

    if (feature.kind === "wallDecoration") {
      const decoration = DECORATION_PRESETS[feature.decorationPresetId];
      const offset = WALL_FACE_OFFSETS[feature.face];

      if (decoration) {
        sprites.push({
          id: feature.id,
          x: feature.wallCell.x + offset.x,
          y: feature.wallCell.y + offset.y,
          placement: "wall",
          wallFace: feature.face,
          assetId: decoration.assetId,
          scale: decoration.scale,
          verticalAnchor: decoration.verticalAnchor,
        });
      }

      if (feature.lightPresetId) {
        const light = LIGHT_PRESETS[feature.lightPresetId];

        if (light) {
          lights.push({ id: feature.id, x: feature.wallCell.x + offset.x, y: feature.wallCell.y + offset.y, ...light });
        }
      }

      if (feature.effectPresetId) {
        const effect = EFFECT_PRESETS[feature.effectPresetId];

        if (effect) {
          emitters.push({
            id: feature.id,
            x: feature.wallCell.x + offset.x,
            y: feature.wallCell.y + offset.y,
            ...effect,
          });
        }
      }
      continue;
    }

    if (feature.kind === "ambientLight") {
      const light = LIGHT_PRESETS[feature.lightPresetId];

      if (light) {
        lights.push({ id: feature.id, x: feature.cell.x + 0.5, y: feature.cell.y + 0.5, ...light });
      }
      continue;
    }

    const effect = EFFECT_PRESETS[feature.effectPresetId];

    if (effect) {
      emitters.push({ id: feature.id, x: feature.cell.x + 0.5, y: feature.cell.y + 0.5, ...effect });
    }
  }
}

/** Projects settled gameplay truth and authored annotations into presentation-only scene data. */
export function createRenderScene(
  floorSet: FloorSetSource,
  world: RunWorld,
  snapshot: RunSnapshot,
  camera: CameraPose = cameraPoseFromSnapshot(snapshot),
): RenderScene {
  const floor = requireFloor(floorSet, snapshot.player.floorId);
  const activeIds = activeEntityIds(snapshot);
  const surfaces = terrainSurfaces(floor);
  const sprites: RenderSprite[] = [];
  const lights: RenderLight[] = [];
  const emitters: RenderEmitter[] = [];

  projectGameplay(floor, world, activeIds, surfaces, sprites);
  projectEnvironment(floor, sprites, lights, emitters);

  return {
    floorId: floor.id,
    theme: floor.theme,
    width: floor.tiles[0]?.length ?? 0,
    height: floor.tiles.length,
    tiles: floor.tiles,
    camera,
    surfaces,
    sprites,
    lights,
    emitters,
  };
}

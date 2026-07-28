import { findEnemyArchetype, type EnemyAppearanceId } from "@/content/combat/enemies";
import type { FloorSetSource, FloorSource, FloorTile } from "@/content/floor/floor-schema";
import { WORLD_SPRITE_PLACEMENTS, type SpritePlacement } from "@/content/presentation/sprite-placements";
import { DECORATION_PRESETS, EFFECT_PRESETS, LIGHT_PRESETS } from "@/presentation/environment-presets";
import type { Cell, Facing } from "@/core/grid";
import type { KeyColor, RunSnapshot, RunWorld } from "@/core/run-state";

export type CameraPose = Readonly<{
  x: number;
  y: number;
  angle: number;
  /**
   * Vertical look, as a fraction of canvas height the horizon shifts by. Omitted means level, which
   * is what every baked floor uses; only the free-look demo surface ever sets it.
   */
  pitch?: number;
}>;

export type RenderSurfaceMaterial =
  | "stoneWall"
  | "oldBrickWall"
  | "ironBarWall"
  | "doorRed"
  | "doorBlue"
  | "doorYellow"
  | "breakableWall"
  // Added for the standalone demo surface; the baked floors never author these. They are separate
  // materials rather than improvements to the shipped ones so the shipped game renders unchanged.
  | "demoFoundation"
  | "demoAshlar"
  | "demoSpalledAshlar"
  | "woodWall"
  | "splinteredWoodWall";

export type RenderSurface = Readonly<{
  cell: Cell;
  material: RenderSurfaceMaterial;
  hintFaces?: readonly Facing[];
}>;

/**
 * A floor material other than the level's default one.
 *
 * The floor is drawn per pixel from a single tiling texture, so a cell that should look different
 * has to be named here rather than covered with a sprite: a sprite laid flat is a squashed billboard
 * that floats, tiles against its neighbours with a visible seam, and cannot be walked over correctly.
 */
export type RenderFloorMaterial = "water" | "demoFlagstone" | "demoVault";

export type RenderFloorPatch = Readonly<{ cell: Cell; material: RenderFloorMaterial }>;

export type RenderSprite = Readonly<{
  id: string;
  x: number;
  y: number;
  placement: "billboard" | "ground" | "wall";
  assetId: string;
  scale: number;
  verticalAnchor: number;
  /** Which baked artwork this sprite draws. Archetypes share appearances, so this is not an identity. */
  appearanceId?: EnemyAppearanceId;
  wallFace?: Facing;
  /**
   * Draws a second, glowing silhouette of this sprite that ignores what is in front of it, so the
   * thing stays locatable through walls. Only the demo surface marks anything this way.
   */
  xray?: Readonly<{ color: readonly [number, number, number]; alpha: number }>;
}>;

/** A world-space point, where `z` is height above the floor in cell units — eye level is 0.5. */
export type RenderPoint = Readonly<{ x: number; y: number; z: number }>;

/**
 * A rod in the world, drawn as an oriented segment rather than a camera-facing image.
 *
 * A billboard cannot express a thrown stick: it is the same picture whichever way the stick is
 * travelling, so throwing one away from the camera reads as a picture of a stick sliding backwards.
 * A beam is projected end to end, so it foreshortens to a stub when it points into the screen and
 * runs its full length when it crosses the view — which is the whole difference between an image of
 * a thrown object and a thrown object.
 */
export type RenderBeam = Readonly<{
  id: string;
  from: RenderPoint;
  to: RenderPoint;
  /** Thickness in cell units, projected like any other world measurement. */
  width: number;
  color: readonly [number, number, number];
  /** Colour at the `to` end. Absent means one flat colour along the whole rod. */
  tipColor?: readonly [number, number, number];
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
  /** Cells whose floor is drawn from a different texture. Baked floors author none of these. */
  floorPatches?: readonly RenderFloorPatch[];
  /** Replaces the default ceiling texture for the whole scene. */
  ceilingMaterial?: RenderFloorMaterial;
  /**
   * Ambient light everywhere, before any placed light contributes. Only read under enhanced
   * lighting; without it the renderer's fixed torch model is the only illumination.
   */
  ambient?: readonly [number, number, number];
  sprites: readonly RenderSprite[];
  /** Oriented rods. Baked floors author none of these. */
  beams?: readonly RenderBeam[];
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
      // Artwork is keyed by appearance, which several archetypes share, so the archetype is what
      // the world carries and the appearance is derived here rather than duplicated onto entities.
      const archetype = findEnemyArchetype(entity?.archetypeId);

      if (!archetype) {
        continue;
      }

      sprites.push({
        id: source.id,
        x: source.cell.x + 0.5,
        y: source.cell.y + 0.5,
        placement: "billboard",
        assetId: `enemy.${archetype.appearanceId}.normal`,
        appearanceId: archetype.appearanceId,
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

    if (source.kind === "exit") {
      sprites.push(groundSprite(source.id, source.cell, "presentation.exit", WORLD_SPRITE_PLACEMENTS.exit));
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

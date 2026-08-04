/**
 * An assembled floor, as Three.js geometry.
 *
 * One merged mesh per material rather than one per cell: a floor is a few thousand cells, and a draw
 * call each would answer the atmosphere question with a frame rate instead of a picture. Faces
 * between two walls are dropped, which is most of them in a maze.
 *
 * The grid maps to the scene as `x → x`, `y → z`, up is `+Y`, and one cell is one unit — the same
 * convention the world's own coordinates use, so a body's position needs no translation later.
 */

import * as THREE from "three";

import { tileIndex, type Maze, type Tile } from "@/core/floor/maze";

import type { SceneLighting } from "./scene-lighting";
import type { SceneFloorMaterial, SceneTextureSet, SceneWallMaterial } from "./scene-textures";

/** Cells the interior masonry stands, in cells. Taken from the wall height the scene builder sets. */
export const WALL_HEIGHT = 1;

/**
 * Cells the outer boundary stands above the interior.
 *
 * Three storeys, matching the Canvas scene: under an open sky the interior walls are low enough to
 * see over from anywhere, and without a taller rim the whole floor reads as a hedge maze rather than
 * as somewhere with an outside.
 */
export const BORDER_HEIGHT = 3;

/** How deep a trench is cut below the ground it interrupts. */
const TRENCH_DEPTH = 0.9;

/** One step of damage per hit point lost, so a wall visibly moves towards failing. */
const STONE_LADDER: readonly SceneWallMaterial[] = ["ashlar", "ashlarWorn", "ashlarCracked", "ashlarFailing"];
const WOOD_LADDER: readonly SceneWallMaterial[] = ["wood", "woodCracked", "woodSplintered"];

/** How tall the masonry in this cell stands, or zero where none does. */
function wallHeight(tile: Tile | undefined): number {
  if (!tile) {
    // Off the grid reads as solid, so the boundary never opens onto nothing.
    return BORDER_HEIGHT;
  }

  if (tile.kind === "border") {
    return BORDER_HEIGHT;
  }

  return tile.kind === "stone" || tile.kind === "wood" ? WALL_HEIGHT : 0;
}

/** Which face this cell's masonry wears, or nothing where it stands none. */
function wallMaterial(tile: Tile | undefined): SceneWallMaterial | undefined {
  if (!tile || tile.kind === "border") {
    return "foundation";
  }

  if (tile.kind !== "stone" && tile.kind !== "wood") {
    return undefined;
  }

  const lost = Math.max(0, tile.maxHp - tile.hp);
  const ladder = tile.kind === "wood" ? WOOD_LADDER : STONE_LADDER;
  return ladder[Math.min(lost, ladder.length - 1)] ?? ladder[0];
}

/** What the ground in this cell is made of. Wall cells name one too; it is simply never seen. */
function floorMaterial(tile: Tile | undefined): SceneFloorMaterial {
  if (tile?.kind === "filled") {
    return "carrion";
  }

  if (tile?.kind === "trench") {
    return "trench";
  }

  if (tile?.kind !== "water") {
    return "flagstone";
  }

  return tile.bodies >= 2 ? "waterChoked" : tile.bodies === 1 ? "waterFouled" : "water";
}

/** Accumulates triangles for one material before they are handed to a single buffer geometry. */
type Mesher = {
  positions: number[];
  normals: number[];
  uvs: number[];
};

function mesher(): Mesher {
  return { positions: [], normals: [], uvs: [] };
}

/**
 * One quad, as two triangles, wound counter-clockwise seen from the side the normal points at.
 *
 * The corners arrive in order around the quad, and the caller owns which way round that order runs —
 * getting it wrong shows the face only from inside, which is exactly how a wall goes missing.
 */
function quad(
  into: Mesher,
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
  d: readonly [number, number, number],
  normal: readonly [number, number, number],
  uMax: number,
  vMax: number,
): void {
  into.positions.push(...a, ...b, ...c, ...a, ...c, ...d);

  for (let corner = 0; corner < 6; corner += 1) {
    into.normals.push(...normal);
  }

  into.uvs.push(0, 0, uMax, 0, uMax, vMax, 0, 0, uMax, vMax, 0, vMax);
}

function geometryFrom(built: Mesher): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(built.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(built.normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(built.uvs, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

function textureFrom(source: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(source);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Nearest magnification on purpose: the 64-pixel tiles are drawn to be read as pixels, and
  // smoothing them here would hand the experiment a crispness the game it is judged against has not
  // got. Mipmapped minification stays, because a floor receding to the horizon aliases without it.
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export type FloorMeshes = Readonly<{
  root: THREE.Group;
  dispose(): void;
}>;

/**
 * Builds every mesh an assembled floor needs.
 *
 * Static: the geometry is built once and never rebuilt, because nothing in this child breaks a wall
 * or fills a pool. A child that does will rebuild the affected material rather than the floor.
 */
export function buildFloorMeshes(maze: Maze, textures: SceneTextureSet, lighting: SceneLighting): FloorMeshes {
  const wallBuilders = new Map<SceneWallMaterial, Mesher>();
  const floorBuilders = new Map<SceneFloorMaterial, Mesher>();
  const disposables: { dispose(): void }[] = [];

  const wallInto = (material: SceneWallMaterial): Mesher => {
    const existing = wallBuilders.get(material);

    if (existing) {
      return existing;
    }

    const created = mesher();
    wallBuilders.set(material, created);
    return created;
  };

  const floorInto = (material: SceneFloorMaterial): Mesher => {
    const existing = floorBuilders.get(material);

    if (existing) {
      return existing;
    }

    const created = mesher();
    floorBuilders.set(material, created);
    return created;
  };

  const tileAt = (x: number, y: number): Tile | undefined =>
    x < 0 || y < 0 || x >= maze.width || y >= maze.height ? undefined : maze.tiles[tileIndex(maze, x, y)];

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const tile = tileAt(x, y);
      const height = wallHeight(tile);
      const material = wallMaterial(tile);

      if (height > 0 && material) {
        const built = wallInto(material);
        const west = x;
        const east = x + 1;
        const north = y;
        const south = y + 1;

        // A face is drawn only where the neighbour is shorter, which in a maze drops most of them.
        // The whole face is emitted rather than only the exposed band: the hidden part costs two
        // triangles and buying them back would cost a seam where the two heights meet.
        if (wallHeight(tileAt(x, y - 1)) < height) {
          quad(
            built,
            [east, 0, north],
            [west, 0, north],
            [west, height, north],
            [east, height, north],
            [0, 0, -1],
            1,
            height,
          );
        }

        if (wallHeight(tileAt(x, y + 1)) < height) {
          quad(
            built,
            [west, 0, south],
            [east, 0, south],
            [east, height, south],
            [west, height, south],
            [0, 0, 1],
            1,
            height,
          );
        }

        if (wallHeight(tileAt(x - 1, y)) < height) {
          quad(
            built,
            [west, 0, north],
            [west, 0, south],
            [west, height, south],
            [west, height, north],
            [-1, 0, 0],
            1,
            height,
          );
        }

        if (wallHeight(tileAt(x + 1, y)) < height) {
          quad(
            built,
            [east, 0, south],
            [east, 0, north],
            [east, height, north],
            [east, height, south],
            [1, 0, 0],
            1,
            height,
          );
        }

        quad(
          built,
          [west, height, north],
          [west, height, south],
          [east, height, south],
          [east, height, north],
          [0, 1, 0],
          1,
          1,
        );
        continue;
      }

      // Ground. A trench is cut rather than painted: the Canvas renderer draws it as a floor texture
      // because a column raycaster has no floor depth to give it, and a flat dark square in three
      // dimensions reads as a stain rather than as something to fall into.
      const ground = floorMaterial(tile);
      const sunk = ground === "trench";
      const level = sunk ? -TRENCH_DEPTH : 0;
      const built = floorInto(ground);
      const west = x;
      const east = x + 1;
      const north = y;
      const south = y + 1;
      quad(
        built,
        [west, level, south],
        [east, level, south],
        [east, level, north],
        [west, level, north],
        [0, 1, 0],
        1,
        1,
      );

      if (!sunk) {
        continue;
      }

      // The cut's own sides, drawn only where the neighbour is not itself cut, so a run of trench
      // cells reads as one continuous ditch rather than as a row of separate pits.
      const wallsOfCut = wallInto("foundation");

      if (floorMaterial(tileAt(x, y - 1)) !== "trench") {
        quad(
          wallsOfCut,
          [west, level, north],
          [east, level, north],
          [east, 0, north],
          [west, 0, north],
          [0, 0, 1],
          1,
          TRENCH_DEPTH,
        );
      }

      if (floorMaterial(tileAt(x, y + 1)) !== "trench") {
        quad(
          wallsOfCut,
          [east, level, south],
          [west, level, south],
          [west, 0, south],
          [east, 0, south],
          [0, 0, -1],
          1,
          TRENCH_DEPTH,
        );
      }

      if (floorMaterial(tileAt(x - 1, y)) !== "trench") {
        quad(
          wallsOfCut,
          [west, level, south],
          [west, level, north],
          [west, 0, north],
          [west, 0, south],
          [1, 0, 0],
          1,
          TRENCH_DEPTH,
        );
      }

      if (floorMaterial(tileAt(x + 1, y)) !== "trench") {
        quad(
          wallsOfCut,
          [east, level, north],
          [east, level, south],
          [east, 0, south],
          [east, 0, north],
          [-1, 0, 0],
          1,
          TRENCH_DEPTH,
        );
      }
    }
  }

  const root = new THREE.Group();

  for (const [name, built] of wallBuilders) {
    const geometry = geometryFrom(built);
    const texture = textureFrom(textures.walls[name]);
    const material = lighting.wall(texture);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `wall:${name}`;
    root.add(mesh);
    disposables.push(geometry, material, texture);
  }

  for (const [name, built] of floorBuilders) {
    const geometry = geometryFrom(built);
    const texture = textureFrom(textures.floors[name]);
    const material = lighting.plane(texture);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `floor:${name}`;
    root.add(mesh);
    disposables.push(geometry, material, texture);
  }

  return {
    root,
    dispose() {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    },
  };
}

/** How many triangles the floor came to, for the diagnostics panel. */
export function triangleCount(meshes: FloorMeshes): number {
  let total = 0;

  for (const child of meshes.root.children) {
    if (child instanceof THREE.Mesh) {
      total += child.geometry.getAttribute("position").count / 3;
    }
  }

  return total;
}

/**
 * How bloodied every cell of the floor is, as a grid the ground's own shader reads.
 *
 * This replaces a sheet of flat red laid over the floor, and the sheet was wrong in three ways that
 * all came from being a sheet. It was drawn after the ground, so it covered the warning marks painted
 * into it — a mortar's circle changed colour depending on how much had died on that spot. It took the
 * fog and the torch a second time, on top of what the floor beneath it had already taken, which is
 * what gave a bloodied floor its brown cast. And it was one flat colour per cell, so there was no
 * pooling, no dried edge, and nothing to tell a cell soaked in a long fight from one splashed once.
 *
 * A grid fixes all three at once by putting the blood back where the renderer keeps it: in the texel,
 * before the mark is stamped and before the light is applied. What is left here is the projection —
 * the rules' per-cell amounts, quantised the way the renderer quantises them, in a texture.
 */

import { holdsStains, tileIndex, type Maze } from "@/core/floor/maze";
import type { World } from "@/core/world";

import * as THREE from "three";

/**
 * Depths a cell can be at.
 *
 * The renderer's own count, and it is a count rather than a continuous value for the reason it gives:
 * a quantised amount can be baked once and read like any other floor. Here it costs nothing either
 * way, and the point of keeping it is that the steps are the steps the game has — the ceiling falls
 * out of it. The rules cap a cell at 0.72, which lands on step six of eight, so the deepest ground a
 * fight can produce is three quarters blood and one quarter its own stone.
 */
const STAIN_STEPS = 8;

export type FloorStains = Readonly<{
  texture: THREE.DataTexture;
  /** What a soaked cell is mixed towards, tiling exactly as the stone under it does. */
  blood: THREE.Texture;
  /** True when the grid was rebuilt, so the caller re-points the materials at it. */
  sync(world: World): boolean;
  dispose(): void;
}>;

/** One byte per cell: the quantised depth, as the fraction the shader mixes by. */
function levelsFor(maze: Maze, stains: Float32Array, into: Uint8Array): void {
  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const index = tileIndex(maze, x, y);

      // Checked at draw time as well as when it is written, so a cell some later change opens up
      // never reveals blood that was not visible on it when it was spilled.
      if (!holdsStains(maze, x, y)) {
        into[index] = 0;
        continue;
      }

      const amount = stains[index] ?? 0;
      const step = Math.min(STAIN_STEPS, Math.trunc(amount * STAIN_STEPS + 0.5));
      into[index] = step <= 0 ? 0 : Math.round((step / STAIN_STEPS) * 255);
    }
  }
}

export function createFloorStains(source: HTMLCanvasElement): FloorStains {
  let width = 0;
  let height = 0;
  let levels = new Uint8Array(4);
  let texture = new THREE.DataTexture(levels, 1, 1, THREE.RedFormat);
  let version = -1;

  // The same settings the stone wears, because the two are sampled at the same coordinate and are
  // meant to share their grain: nearest magnification for the deliberate pixels, mipmapped
  // minification so a soaked floor receding to the horizon does not sparkle.
  const blood = new THREE.CanvasTexture(source);
  blood.wrapS = THREE.RepeatWrapping;
  blood.wrapT = THREE.RepeatWrapping;
  blood.magFilter = THREE.NearestFilter;
  blood.minFilter = THREE.LinearMipmapLinearFilter;
  blood.colorSpace = THREE.NoColorSpace;
  blood.anisotropy = 4;

  const rebuild = (maze: Maze): void => {
    texture.dispose();
    width = maze.width;
    height = maze.height;
    levels = new Uint8Array(width * height);
    texture = new THREE.DataTexture(levels, width, height, THREE.RedFormat);
    // Nearest on both, so a cell's edge is the cell's edge rather than a gradient into its neighbour,
    // and clamped so the ground outside the grid does not wrap round to the far side of the floor.
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    // One byte per cell means one byte per row of padding, and the default four would have every
    // row after the first read from the wrong offset on any floor whose width is not a multiple of
    // four — a blood grid sheared diagonally across the map.
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    version = -1;
  };

  return {
    blood,

    get texture() {
      return texture;
    },

    sync(world) {
      const rebuilt = world.maze.width !== width || world.maze.height !== height;

      if (rebuilt) {
        rebuild(world.maze);
      }

      if (world.stainsVersion === version) {
        return rebuilt;
      }

      version = world.stainsVersion;
      levelsFor(world.maze, world.stains, levels);
      texture.needsUpdate = true;
      return rebuilt;
    },

    dispose() {
      texture.dispose();
      blood.dispose();
    },
  };
}

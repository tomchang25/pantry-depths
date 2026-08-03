/**
 * The things built on the floor, as block models.
 *
 * The Canvas renderer draws all of these as stacks of axis-aligned boxes already, so the port is
 * mostly a change of what a box is rather than of what is built — which is the plan's claim about
 * structures, and this module is where it gets tested. The shapes are rebuilt rather than reproduced
 * face for face: a spike asks whether a blocky altar reads as an altar, not whether it matches a
 * raycast one to the tenth of a cell.
 *
 * Rebuilt wholesale whenever anything in it changes, which is cheap because there are a dozen boxes
 * on a floor and none of them moves. What changes is state — an altar broken open, a stair unsealed,
 * a barricade cut down — and a rebuild is simpler than a diff nobody would trust.
 */

import * as THREE from "three";

import { isBarricadeCell, tileIndex, type Room } from "@/core/maze";
import type { World } from "@/core/world";

type Box = Readonly<{
  x: number;
  y: number;
  halfX: number;
  halfY: number;
  bottom: number;
  top: number;
  color: number;
}>;

/** Every light a floor's fittings throw, in the scene builder's own colours and radii. */
export type StructureLight = Readonly<{
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: number;
}>;

const ALTAR_STONE = 0x6a4450;
const ALTAR_SPENT = 0x3d2a33;
const BLESSING_STONE = 0xb9bed2;
const SPRING_STONE = 0x6f8ea0;
const SPRING_WATER = 0x4a86a4;
const EXTRACTION_STONE = 0x7fae6a;
const SEAL_STONE = 0x4a4256;
const SEAL_IRON = 0x2e2836;
const STAIR_STONE = 0x8fa8b6;
const BARRICADE_IRON = 0x6b5b46;
const MORTAR_IRON = 0x5c5462;

/** Half the width of a room's business pad, matching the pad the rules test the player's feet against. */
const PAD_HALF = 1.5;

/** The cursed altar, weathering as it is broken open. */
function altarBoxes(world: World): Box[] {
  const altar = world.altar;
  const damage = Math.max(0, altar.maxHp - altar.hp);
  const spent = altar.hp <= 0;
  const stone = spent ? ALTAR_SPENT : ALTAR_STONE;
  const shaftTop = 0.5 - damage * 0.05;
  const built: Box[] = [
    { x: altar.x, y: altar.y, halfX: 0.34, halfY: 0.34, bottom: 0, top: 0.16, color: stone },
    {
      x: altar.x,
      y: altar.y,
      halfX: 0.24 - damage * 0.02,
      halfY: 0.24 - damage * 0.02,
      bottom: 0.16,
      top: shaftTop,
      color: stone,
    },
  ];

  if (!spent) {
    // The capstone carries most of the damage because it is the part that reads at a distance: it
    // shifts off centre, narrows on the struck side, and settles lower against the shaft.
    const lean = damage * 0.07;
    built.push({
      x: altar.x + lean,
      y: altar.y - lean * 0.6,
      halfX: 0.33 - damage * 0.07,
      halfY: 0.33 - damage * 0.03,
      bottom: shaftTop,
      top: shaftTop + 0.12 - damage * 0.02,
      color: stone,
    });
  }

  return built;
}

/** The blessing altar: a low dais with a post at each corner. */
function blessingBoxes(room: Room): Box[] {
  const x = room.center.x + 0.5;
  const y = room.center.y + 0.5;
  const built: Box[] = [
    { x, y, halfX: PAD_HALF, halfY: PAD_HALF, bottom: 0, top: 0.07, color: BLESSING_STONE },
    { x, y, halfX: 0.66, halfY: 0.66, bottom: 0.07, top: 0.1, color: BLESSING_STONE },
  ];

  for (const cornerX of [-1, 1]) {
    for (const cornerY of [-1, 1]) {
      built.push({
        x: x + cornerX * (PAD_HALF - 0.12),
        y: y + cornerY * (PAD_HALF - 0.12),
        halfX: 0.12,
        halfY: 0.12,
        bottom: 0,
        top: 1.3,
        color: BLESSING_STONE,
      });
    }
  }

  return built;
}

/** The hot spring: a tiered fountain standing in a shallow pool. */
function springBoxes(room: Room): Box[] {
  const x = room.center.x + 0.5;
  const y = room.center.y + 0.5;
  return [
    { x, y, halfX: PAD_HALF, halfY: PAD_HALF, bottom: 0, top: 0.06, color: SPRING_STONE },
    { x, y, halfX: PAD_HALF - 0.12, halfY: PAD_HALF - 0.12, bottom: 0.06, top: 0.12, color: SPRING_WATER },
    { x, y, halfX: 0.5, halfY: 0.5, bottom: 0.12, top: 0.34, color: SPRING_STONE },
    { x, y, halfX: 0.32, halfY: 0.32, bottom: 0.34, top: 0.62, color: SPRING_STONE },
    { x, y, halfX: 0.16, halfY: 0.16, bottom: 0.62, top: 0.86, color: SPRING_WATER },
  ];
}

/** The way out: a pad and a beacon standing on it, which is the one fitting meant to be seen first. */
function extractionBoxes(room: Room): Box[] {
  const x = room.center.x + 0.5;
  const y = room.center.y + 0.5;
  return [
    { x, y, halfX: PAD_HALF, halfY: PAD_HALF, bottom: 0, top: 0.08, color: EXTRACTION_STONE },
    { x, y, halfX: 0.3, halfY: 0.3, bottom: 0.08, top: 1.5, color: EXTRACTION_STONE },
    { x, y, halfX: 0.46, halfY: 0.46, bottom: 1.5, top: 1.86, color: EXTRACTION_STONE },
  ];
}

/**
 * The way down, in its two states.
 *
 * Sealed it is a banded slab throwing no light of its own, so it is found by walking into it like
 * everything else a floor keeps to itself. Open it is a flight of steps cut into the ground.
 */
function stairBoxes(world: World): Box[] {
  const x = world.maze.exit.x + 0.5;
  const y = world.maze.exit.y + 0.5;

  if (!world.maze.progress.main.met) {
    return [
      { x, y, halfX: 0.5, halfY: 0.5, bottom: 0, top: 0.14, color: SEAL_STONE },
      { x, y, halfX: 0.42, halfY: 0.42, bottom: 0.14, top: 0.28, color: SEAL_STONE },
      { x, y, halfX: 0.48, halfY: 0.08, bottom: 0.28, top: 0.34, color: SEAL_IRON },
      { x, y, halfX: 0.08, halfY: 0.48, bottom: 0.28, top: 0.34, color: SEAL_IRON },
    ];
  }

  const built: Box[] = [];

  for (let step = 0; step < 4; step += 1) {
    const share = step / 4;
    built.push({
      x,
      y: y - 0.5 + 0.125 + share,
      halfX: 0.46,
      halfY: 0.125,
      bottom: -0.1 - share * 0.55,
      top: 0.16 - share * 0.55,
      color: STAIR_STONE,
    });
  }

  return built;
}

/** Iron caltrops, sized against the cell they refuse to let anyone walk into. */
function barricadeBoxes(x: number, y: number): Box[] {
  const centreX = x + 0.5;
  const centreY = y + 0.5;
  return [
    { x: centreX, y: centreY, halfX: 0.46, halfY: 0.05, bottom: 0.12, top: 0.2, color: BARRICADE_IRON },
    { x: centreX, y: centreY, halfX: 0.05, halfY: 0.46, bottom: 0.12, top: 0.2, color: BARRICADE_IRON },
    { x: centreX, y: centreY, halfX: 0.05, halfY: 0.05, bottom: 0, top: 0.68, color: BARRICADE_IRON },
  ];
}

/** A squat emplacement on a carriage, which is all a mortar is until it fires. */
function mortarBoxes(x: number, y: number): Box[] {
  const centreX = x + 0.5;
  const centreY = y + 0.5;
  return [
    { x: centreX, y: centreY, halfX: 0.38, halfY: 0.38, bottom: 0, top: 0.2, color: MORTAR_IRON },
    { x: centreX, y: centreY, halfX: 0.22, halfY: 0.22, bottom: 0.2, top: 0.62, color: MORTAR_IRON },
  ];
}

/** A signature of everything a rebuild would change, so the floor is rebuilt exactly when it must be. */
function structureSignature(world: World): string {
  return [
    world.altar.hp,
    world.maze.progress.main.met ? 1 : 0,
    world.terrainVersion,
    world.maze.exit.x,
    world.maze.exit.y,
  ].join(":");
}

export type WorldStructures = Readonly<{
  root: THREE.Group;
  sync(world: World): void;
  lights(world: World, elapsedSeconds: number): readonly StructureLight[];
  dispose(): void;
}>;

export function createWorldStructures(): WorldStructures {
  const root = new THREE.Group();
  let signature = "";
  let owned: { dispose(): void }[] = [];

  const rebuild = (world: World): void => {
    for (const disposable of owned) {
      disposable.dispose();
    }

    owned = [];
    root.clear();

    const byColor = new Map<number, Box[]>();

    const collect = (boxes: readonly Box[]): void => {
      for (const box of boxes) {
        const bucket = byColor.get(box.color) ?? [];
        bucket.push(box);
        byColor.set(box.color, bucket);
      }
    };

    collect(altarBoxes(world));
    collect(stairBoxes(world));

    for (const room of world.maze.rooms) {
      if (room.role === "blessingAltar") {
        collect(blessingBoxes(room));
      }

      if (room.role === "hotSpring") {
        collect(springBoxes(room));
      }

      if (room.role === "extraction") {
        collect(extractionBoxes(room));
      }
    }

    for (let y = 0; y < world.maze.height; y += 1) {
      for (let x = 0; x < world.maze.width; x += 1) {
        if (isBarricadeCell(world.maze, x, y)) {
          collect(barricadeBoxes(x, y));
          continue;
        }

        if (world.maze.tiles[tileIndex(world.maze, x, y)]?.kind === "mortar") {
          collect(mortarBoxes(x, y));
        }
      }
    }

    // One mesh per colour rather than per box: a floor's fittings come to a few hundred boxes once
    // the caltrops are counted, and a draw call each would be most of the frame's calls.
    for (const [color, boxes] of byColor) {
      const geometries: THREE.BufferGeometry[] = [];

      for (const box of boxes) {
        const geometry = new THREE.BoxGeometry(box.halfX * 2, box.top - box.bottom, box.halfY * 2);
        geometry.translate(box.x, (box.bottom + box.top) / 2, box.y);
        geometries.push(geometry);
      }

      const merged = mergeGeometries(geometries);

      for (const geometry of geometries) {
        geometry.dispose();
      }

      const material = new THREE.MeshLambertMaterial({ color });
      const mesh = new THREE.Mesh(merged, material);
      root.add(mesh);
      owned.push(merged, material);
    }
  };

  return {
    root,

    sync(world) {
      const next = structureSignature(world);

      if (next === signature) {
        return;
      }

      signature = next;
      rebuild(world);
    },

    /**
     * What each fitting throws, matching the Canvas scene's own lights.
     *
     * Returned rather than added to the scene, because the runtime owns how many real lights the
     * frame can afford and which of these are close enough to be worth one.
     */
    lights(world, elapsedSeconds) {
      const built: StructureLight[] = [];

      if (world.altar.hp > 0) {
        const left = world.altar.maxHp > 0 ? world.altar.hp / world.altar.maxHp : 1;
        built.push({
          x: world.altar.x,
          y: world.altar.y,
          radius: 3.2 + left * 1.4,
          intensity: (0.85 + Math.sin(elapsedSeconds * 1.6) * 0.15) * (0.55 + left * 0.45),
          color: 0xd63e3a,
        });
      }

      if (world.maze.progress.main.met) {
        built.push({
          x: world.maze.exit.x + 0.5,
          y: world.maze.exit.y + 0.5,
          radius: 5,
          intensity: 0.95,
          color: 0x6ef0ac,
        });
      }

      for (const room of world.maze.rooms) {
        const x = room.center.x + 0.5;
        const y = room.center.y + 0.5;

        if (room.role === "blessingAltar") {
          built.push({ x, y, radius: 2.6, intensity: 0.5, color: 0xf4f6ff });
        }

        if (room.role === "hotSpring") {
          built.push({
            x,
            y,
            radius: 4,
            intensity: 0.7 + Math.sin(elapsedSeconds * 0.9) * 0.08,
            color: 0x7ec4e2,
          });
        }

        if (room.role === "extraction") {
          // Loud, because the way out was the one thing on a floor a player could walk past without
          // noticing, and a room only worth finding has to be recognisable the moment it is found.
          built.push({
            x,
            y,
            radius: 6,
            intensity: 1.05 + Math.sin(elapsedSeconds * 2.4) * 0.2,
            color: 0x82f04a,
          });
        }
      }

      return built;
    },

    dispose() {
      for (const disposable of owned) {
        disposable.dispose();
      }

      owned = [];
      root.clear();
    },
  };
}

/**
 * Merges box geometries sharing one material into a single buffer.
 *
 * Written out rather than pulled from the addon so the experiment carries no import it would have to
 * justify: every geometry here is a box with the same attributes in the same order, which is the one
 * case where concatenating the arrays is the whole of the job.
 */
function mergeGeometries(geometries: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (const geometry of geometries) {
    const indexed = geometry.index ? geometry.toNonIndexed() : geometry;
    positions.push(...Array.from(indexed.getAttribute("position").array));
    normals.push(...Array.from(indexed.getAttribute("normal").array));
    uvs.push(...Array.from(indexed.getAttribute("uv").array));

    if (indexed !== geometry) {
      indexed.dispose();
    }
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.computeBoundingSphere();
  return merged;
}

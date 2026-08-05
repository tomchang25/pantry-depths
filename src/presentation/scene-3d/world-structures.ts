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

import { extractionShare } from "@/core/world/extraction";
import { BARRICADE_HP, isBarricadeCell, MORTAR_HP, tileIndex, type Room, type Tile } from "@/core/floor/maze";
import { BLESSING_HOLD_SECONDS } from "@/core/floor/rooms";
import { MORTAR_LOCK_SECONDS, type World } from "@/core/world";

import type { SceneLighting } from "./scene-lighting";

type Box = Readonly<{
  x: number;
  y: number;
  halfX: number;
  halfY: number;
  bottom: number;
  top: number;
  color: number;
  /** What the upward faces take. Omitted means the flat colour brightened, as the renderer does. */
  topColor?: number;
}>;

/** Packs three 0-255 channels back into the hex the material factory takes. */
function pack(red: number, green: number, blue: number): number {
  const clamp = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
  return (clamp(red) << 16) | (clamp(green) << 8) | clamp(blue);
}

/** The renderer's own `brighten(color, 1.28)`, for a box that authors no top colour of its own. */
function brighten(hex: number): number {
  return pack(((hex >> 16) & 255) * 1.28, ((hex >> 8) & 255) * 1.28, (hex & 255) * 1.28);
}

/** Blends two packed colours channel by channel, for a fitting that changes colour as it is used up. */
function mix(from: number, to: number, amount: number): number {
  const blend = (shift: number): number => {
    const start = (from >> shift) & 255;
    return start + (((to >> shift) & 255) - start) * amount;
  };

  return pack(blend(16), blend(8), blend(0));
}

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

/** Half the width of a room's business pad, matching the pad the rules test the player's feet against. */
const PAD_HALF = 1.5;

/**
 * How high each hold's readout sits, and what it is painted in.
 *
 * Both fixtures cover their own ground with a raised pad, so the readout goes on top of the pad
 * rather than on the floor — which is where the shipped game painted the extraction's, because the
 * shipped extraction was a canister standing on bare stone. The heights clear the tallest thing
 * directly underneath: the blessing's raised inlay reaches 0.1 and the extraction's pad 0.08.
 *
 * The extraction keeps the exact colours and strengths its floor mark used. The blessing had no mark
 * to keep — its dais was told by the lighting — so it takes the colour its own light already throws.
 */
const BLESSING_READOUT_HEIGHT = 0.105;
const EXTRACTION_READOUT_HEIGHT = 0.085;
const BLESSING_READOUT_DIM = 0x565c74;
const BLESSING_READOUT_HOT = 0xf4f6ff;
const EXTRACTION_READOUT_DIM = 0x2e6c28;
const EXTRACTION_READOUT_HOT = 0x94f660;
const READOUT_BASE_OPACITY = 0.5;
const READOUT_FILL_OPACITY = 0.9;

/**
 * How wide the thing standing in the middle of each pad is.
 *
 * A fill growing from nothing would spend its first fifth entirely behind the extraction's beacon and
 * show the player nothing at all while the hold had visibly started. It grows from the beacon's own
 * width instead, so it emerges from behind it on the first frame and reaches the pad's edge at the
 * last. The blessing dais has nothing standing above the height its readout sits at, so it grows from
 * nothing as it looks like it should.
 */
const BLESSING_READOUT_CORE = 0;
const EXTRACTION_READOUT_CORE = 0.6;

/** One room's hold, as the pad it claims and the part of it already earned. */
type HoldReadout = Readonly<{ base: THREE.Mesh; fill: THREE.Mesh }>;

/**
 * Puts one hold's pair on its fixture and sizes the fill to the share, or hides both.
 *
 * Hidden rather than absent, because a floor without the room still has the meshes: building them
 * per floor would mean a rebuild path for something that never changes, and leaving a stale one lit
 * on a floor that has no such room is the failure that path would introduce.
 */
function placeReadout(readout: HoldReadout, room: Room | undefined, height: number, core: number, share: number): void {
  if (!room) {
    readout.base.visible = false;
    readout.fill.visible = false;
    return;
  }

  const x = room.center.x + 0.5;
  const y = room.center.y + 0.5;
  const width = PAD_HALF * 2;
  const filled = core + (width - core) * share;
  readout.base.visible = true;
  readout.base.position.set(x, height, y);
  readout.base.scale.set(width, 1, width);
  readout.fill.visible = share > 0;
  readout.fill.position.set(x, height + 0.002, y);
  readout.fill.scale.set(filled, 1, filled);
}

/**
 * The lit top face an overhead light would leave, for the one fitting that authors its own.
 *
 * Only the altar takes this. The other four are shapes rebuilt for a renderer with real lighting
 * rather than ports of the raycaster's, and giving them a hand-brightened top as well would be
 * paying twice for the same cue.
 */
function litFace(hex: number): number {
  return pack(((hex >> 16) & 255) * 1.58, ((hex >> 8) & 255) * 1.56, (hex & 255) * 1.5);
}

/**
 * Where each piece knocked off the altar comes to rest, in cells from its centre.
 *
 * Fixed rather than rolled. Structure geometry is rebuilt whenever anything on the floor changes, so
 * a random scatter would pick new places for the same rubble every time a wall came down.
 */
const ALTAR_DEBRIS = [
  { x: 0.54, y: -0.28, half: 0.11, top: 0.09 },
  { x: -0.42, y: 0.48, half: 0.09, top: 0.07 },
  { x: 0.08, y: 0.6, half: 0.13, top: 0.11 },
] as const;

/**
 * The cursed altar, one shape per swing it has taken.
 *
 * A plinth that stood identical through two of its three hits and then became rubble told the player
 * nothing until it was over. This is the same ladder the walls and the caltrops already climb: the
 * capstone is knocked further off true and loses more of itself with every blow, the shaft is shorter
 * under it, the stone darkens, and each piece that comes off is still lying on the floor afterwards —
 * so how much of an altar somebody has already spent is legible from across the room and from behind.
 */
function altarBoxes(world: World): Box[] {
  const altar = world.altar;
  const damage = Math.min(altar.maxHp, Math.max(0, altar.maxHp - altar.hp));
  const spent = altar.hp <= 0;
  const stone = mix(ALTAR_STONE, ALTAR_SPENT, altar.maxHp > 0 ? damage / altar.maxHp : 0);
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
      topColor: litFace(stone),
    });
  } else {
    // Spent: the top is gone and what is left is the snapped shaft, too low to be mistaken for one
    // still worth swinging at.
    built.push({
      x: altar.x,
      y: altar.y,
      halfX: 0.27,
      halfY: 0.27,
      bottom: shaftTop,
      top: shaftTop + 0.05,
      color: stone,
      topColor: litFace(stone),
    });
  }

  for (let index = 0; index < damage; index += 1) {
    const piece = ALTAR_DEBRIS[index];

    if (!piece) {
      continue;
    }

    built.push({
      x: altar.x + piece.x,
      y: altar.y + piece.y,
      halfX: piece.half,
      halfY: piece.half * 0.78,
      bottom: 0,
      top: piece.top,
      color: stone,
      topColor: litFace(stone),
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

/** Where the arms cross, and one spike out along each of them. The arm offset is the rail's own. */
const BARRICADE_SPIKES = [
  { alongX: 0, alongY: 0, top: 0.68 },
  { alongX: -0.33, alongY: 0, top: 0.58 },
  { alongX: 0.33, alongY: 0, top: 0.58 },
  { alongX: 0, alongY: -0.33, top: 0.58 },
  { alongX: 0, alongY: 0.33, top: 0.58 },
] as const;

const BARRICADE_REACH = 0.46;
const BARRICADE_RAIL_WIDTH = 0.05;
const BARRICADE_RAIL_TOP = 0.12;
const BARRICADE_SPIKE_WIDTH = 0.05;

/**
 * Iron caltrops: two crossed rails with five spikes standing off them.
 *
 * Wear is not decoration. Eight bare swings is deliberately more than any wall, so a player cutting
 * one down needs to see it going — the iron dulls and the spikes shorten, and both are read from
 * across the room rather than by walking up to it.
 */
function barricadeBoxes(x: number, y: number, wear: number): Box[] {
  const centreX = x + 0.5;
  const centreY = y + 0.5;
  const iron = pack(128 - wear * 44, 132 - wear * 46, 146 - wear * 50);
  const edge = pack(196 - wear * 70, 204 - wear * 74, 220 - wear * 80);
  const built: Box[] = [
    {
      x: centreX,
      y: centreY,
      halfX: BARRICADE_REACH,
      halfY: BARRICADE_RAIL_WIDTH,
      bottom: 0,
      top: BARRICADE_RAIL_TOP,
      color: iron,
      topColor: edge,
    },
    {
      x: centreX,
      y: centreY,
      halfX: BARRICADE_RAIL_WIDTH,
      halfY: BARRICADE_REACH,
      bottom: 0,
      top: BARRICADE_RAIL_TOP,
      color: iron,
      topColor: edge,
    },
  ];

  for (const spike of BARRICADE_SPIKES) {
    built.push({
      x: centreX + spike.alongX,
      y: centreY + spike.alongY,
      halfX: BARRICADE_SPIKE_WIDTH,
      halfY: BARRICADE_SPIKE_WIDTH,
      bottom: BARRICADE_RAIL_TOP,
      top: spike.top - wear * 0.18,
      color: iron,
      topColor: edge,
    });
  }

  return built;
}

const MORTAR_BARREL_RINGS = 4;

/**
 * A squat mortar on a timber carriage, pointing straight up.
 *
 * Vertical for two reasons that agree. Boxes here are axis-aligned and cannot be turned, so an
 * angled barrel is not buildable from them at all — and a weapon that shells every direction around
 * itself has no business being angled anyway.
 *
 * The muzzle takes the charging glow, which is where the shell leaves from and the only cue an
 * emplacement gives about itself: the circle it paints is somewhere else entirely.
 */
function mortarBoxes(x: number, y: number, wear: number, glow: number): Box[] {
  const centreX = x + 0.5;
  const centreY = y + 0.5;
  const dim = 1 - wear * 0.42;
  const built: Box[] = [
    {
      x: centreX,
      y: centreY,
      halfX: 0.4,
      halfY: 0.4,
      bottom: 0,
      top: 0.14,
      color: pack(96 * dim, 64 * dim, 36 * dim),
      topColor: pack(132 * dim, 92 * dim, 54 * dim),
    },
  ];

  for (const side of [-1, 1]) {
    built.push({
      x: centreX + side * 0.3,
      y: centreY,
      halfX: 0.08,
      halfY: 0.34,
      bottom: 0.14,
      top: 0.44,
      color: pack(84 * dim, 56 * dim, 32 * dim),
      topColor: pack(118 * dim, 80 * dim, 46 * dim),
    });
  }

  // Widest at the muzzle, so the silhouette tapers instead of reading as a post.
  for (let ring = 0; ring < MORTAR_BARREL_RINGS; ring += 1) {
    const up = ring / (MORTAR_BARREL_RINGS - 1);
    const half = 0.16 + up * 0.1;
    const heat = glow * up;
    built.push({
      x: centreX,
      y: centreY,
      halfX: half,
      halfY: half,
      bottom: 0.12 + ring * 0.17,
      top: 0.12 + (ring + 1) * 0.17,
      color: pack(62 * dim + heat * 190, 66 * dim + heat * 62, 74 * dim + heat * 40),
      topColor: pack(94 * dim + heat * 160, 98 * dim + heat * 80, 108 * dim + heat * 56),
    });
  }

  return built;
}

/** How hot an emplacement's muzzle is running, from cold between shots to white at launch. */
function mortarGlow(world: World, x: number, y: number): number {
  const mortar = world.mortars.find((entry) => entry.cellX === x && entry.cellY === y);

  if (!mortar || mortar.phase !== "locked") {
    return 0;
  }

  return 1 - mortar.seconds / MORTAR_LOCK_SECONDS;
}

/** How far gone a breakable thing is, as the fraction of its hit points already spent. */
function wearOf(tile: Tile | undefined, maxHp: number): number {
  if (!tile) {
    return 0;
  }

  return Math.min(1, Math.max(0, (maxHp - tile.hp) / Math.max(1, maxHp)));
}

/** A signature of everything a rebuild would change, so the floor is rebuilt exactly when it must be. */
function structureSignature(world: World): string {
  return [
    world.altar.hp,
    world.maze.progress.main.met ? 1 : 0,
    world.terrainVersion,
    world.maze.exit.x,
    world.maze.exit.y,
    // The muzzle glow is state the terrain version knows nothing about, and it moves every frame a
    // shot is being lined up. Quantised, so a rebuild happens a few times a fuse rather than sixty.
    world.mortars.map((mortar) => (mortar.phase === "locked" ? Math.round(mortar.seconds * 6) : -1)).join(","),
  ].join(":");
}

export type WorldStructures = Readonly<{
  root: THREE.Group;
  sync(world: World): void;
  lights(world: World, elapsedSeconds: number): readonly StructureLight[];
  dispose(): void;
}>;

export function createWorldStructures(lighting: SceneLighting): WorldStructures {
  const root = new THREE.Group();
  let signature = "";
  let owned: { dispose(): void }[] = [];

  // One unit square lying flat, shared by all four readout quads and scaled per frame. Kept out of
  // `owned` along with everything else here: that list is emptied on every rebuild, and these outlive
  // every rebuild there is.
  const readoutGeometry = new THREE.PlaneGeometry(1, 1);
  readoutGeometry.rotateX(-Math.PI / 2);
  const readoutMaterials: THREE.ShaderMaterial[] = [];

  const readoutQuad = (color: number, opacity: number, order: number): THREE.Mesh => {
    const material = lighting.mark(color, opacity);
    readoutMaterials.push(material);
    const mesh = new THREE.Mesh(readoutGeometry, material);
    // Stated rather than left to the distance sort: the two quads are two millimetres apart and
    // neither writes depth, so which one covers the other is otherwise a coin toss per frame.
    mesh.renderOrder = order;
    mesh.visible = false;
    return mesh;
  };

  const blessingReadout: HoldReadout = {
    base: readoutQuad(BLESSING_READOUT_DIM, READOUT_BASE_OPACITY, 1),
    fill: readoutQuad(BLESSING_READOUT_HOT, READOUT_FILL_OPACITY, 2),
  };
  const extractionReadout: HoldReadout = {
    base: readoutQuad(EXTRACTION_READOUT_DIM, READOUT_BASE_OPACITY, 1),
    fill: readoutQuad(EXTRACTION_READOUT_HOT, READOUT_FILL_OPACITY, 2),
  };
  const readouts = new THREE.Group();
  readouts.add(blessingReadout.base, blessingReadout.fill, extractionReadout.base, extractionReadout.fill);
  root.add(readouts);

  const rebuild = (world: World): void => {
    for (const disposable of owned) {
      disposable.dispose();
    }

    owned = [];
    root.clear();
    // Put straight back, because the clear above takes the readouts with it and they belong to no
    // floor in particular. Forgetting this loses both holds the first time a wall comes down.
    root.add(readouts);

    // Keyed by the pair rather than by the flat colour: two boxes sharing a side colour and
    // differing at the top are two materials, and merging them would give one of them the other's.
    const byColor = new Map<string, { color: number; topColor: number; boxes: Box[] }>();

    const collect = (boxes: readonly Box[]): void => {
      for (const box of boxes) {
        const topColor = box.topColor ?? brighten(box.color);
        const key = `${box.color}:${topColor}`;
        const bucket = byColor.get(key) ?? { color: box.color, topColor, boxes: [] };
        bucket.boxes.push(box);
        byColor.set(key, bucket);
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
        const tile = world.maze.tiles[tileIndex(world.maze, x, y)];

        if (isBarricadeCell(world.maze, x, y)) {
          collect(barricadeBoxes(x, y, wearOf(tile, BARRICADE_HP)));
          continue;
        }

        if (tile?.kind === "mortar") {
          collect(mortarBoxes(x, y, wearOf(tile, MORTAR_HP), mortarGlow(world, x, y)));
        }
      }
    }

    // One mesh per colour rather than per box: a floor's fittings come to a few hundred boxes once
    // the caltrops are counted, and a draw call each would be most of the frame's calls.
    for (const bucket of byColor.values()) {
      const geometries: THREE.BufferGeometry[] = [];

      for (const box of bucket.boxes) {
        const geometry = new THREE.BoxGeometry(box.halfX * 2, box.top - box.bottom, box.halfY * 2);
        geometry.translate(box.x, (box.bottom + box.top) / 2, box.y);
        geometries.push(geometry);
      }

      const merged = mergeGeometries(geometries);

      for (const geometry of geometries) {
        geometry.dispose();
      }

      const material = lighting.box(bucket.color, bucket.topColor);
      const mesh = new THREE.Mesh(merged, material);
      root.add(mesh);
      owned.push(merged, material);
    }
  };

  return {
    root,

    sync(world) {
      // Ahead of the signature check, deliberately. A hold moves every frame and the geometry it sits
      // on almost never does, so a readout updated only on a rebuild would stop the moment the floor
      // settled — which is the whole of the time somebody is standing on a pad.
      let blessing: Room | undefined;
      let extraction: Room | undefined;

      for (const room of world.maze.rooms) {
        if (room.role === "blessingAltar") {
          blessing = room;
        }

        if (room.role === "extraction") {
          extraction = room;
        }
      }

      const progress = world.maze.progress;
      const held = progress.blessingTaken ? 1 : Math.min(1, progress.heldSeconds / BLESSING_HOLD_SECONDS);
      placeReadout(blessingReadout, blessing, BLESSING_READOUT_HEIGHT, BLESSING_READOUT_CORE, held);
      placeReadout(
        extractionReadout,
        extraction,
        EXTRACTION_READOUT_HEIGHT,
        EXTRACTION_READOUT_CORE,
        extractionShare(world),
      );

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
          // The five-second claim is told here rather than by the posts rising: structure geometry is
          // cached against the floor, so making them move would rebuild every fitting on it every
          // frame. Leaving the pad drops the light back on the next frame, because the hold itself
          // resets — the readout is the state, not a copy of it.
          const held = world.maze.progress.blessingTaken
            ? 1
            : Math.min(1, world.maze.progress.heldSeconds / BLESSING_HOLD_SECONDS);
          built.push({ x, y, radius: 2.6 + held * 3.4, intensity: 0.5 + held * 1.1, color: 0xf4f6ff });
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
          // Louder, wider and faster while the hold runs, which is the only readout it has.
          const holding = extractionShare(world);
          built.push({
            x,
            y,
            radius: 6 + holding * 3,
            intensity: 1.05 + holding * 0.9 + Math.sin(elapsedSeconds * (2.4 + holding * 9)) * (0.2 + holding * 0.2),
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

      for (const material of readoutMaterials) {
        material.dispose();
      }

      readoutGeometry.dispose();
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

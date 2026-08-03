/**
 * Everything transient: what lies on the floor, what flies over it, what it is stained with, and —
 * most of all — the dust.
 *
 * The dust is why this module was rewritten. The first build drew the particle field as a point
 * cloud at a fixed tiny size, and the judging session found the atmosphere gone: in the shipped game
 * a broken wall throws a dozen large translucent discs that hang and swell, an altar breathes
 * embers, a shooter paints a beaded line across the room, and a committed sword draws the arc it is
 * about to sweep. None of that is subtle and none of it was there.
 *
 * So every channel the Canvas projection raises is built here, at the sizes and colours it uses.
 * Pickups are the other correction: they are pictures, not boxes, and the author ruled they stay
 * that way.
 */

import * as THREE from "three";

import propDisplayJson from "@/content/presentation/prop-display.json";
import { parsePropDisplays, propDisplaysByKind } from "@/content/presentation/prop-display-schema";
import { SKELETON_PICKUP_ASSETS, SKELETON_PICKUP_URLS } from "@/content/enemies/skeleton-pickup-definitions";
import { attackReach, MELEE_CUT_HALF_ANGLE } from "@/core/enemy-contract";
import { blocksProjectile } from "@/core/maze";
import type { PropKind } from "@/core/prop-kinds";
import { projectileHeight, type Enemy, type World } from "@/core/world";

import { SceneLighting } from "./scene-lighting";
import { createSceneSprites, WARN_BLADE_STEPS, type SceneSpriteId, type SceneSprites } from "./scene-sprites";

/** Cap the rules stain a cell to. Anything at or above this is as bloody as ground gets. */
const MAX_STAIN = 0.72;

/** Texels per cell in the stain overlay. Coarse on purpose — it is a stain, not a decal sheet. */
const STAIN_RESOLUTION = 8;

/** How many dots a frame can hold, per blend mode. A bomb in a crowd stays under this. */
const PARTICLE_CAPACITY = 900;

/** The colours the projection gives each kind of debris. */
const PARTICLE_COLORS: Readonly<Record<string, readonly [number, number, number]>> = {
  blood: [146, 20, 28],
  stoneChip: [128, 118, 142],
  woodChip: [138, 92, 48],
  dust: [178, 162, 182],
  ember: [255, 172, 78],
  splash: [162, 206, 232],
  bone: [226, 218, 196],
};

/** How far apart the dots of a drawn line sit, and how big each one is at rest. */
const BEAD_SPACING = 0.19;
const BEAD_SIZE = 0.05;
const BEAD_COLOR: readonly [number, number, number] = [255, 96, 88];

/** Height the beads of a shooter's line sit at: where the orb flies, not the floor. */
const SIGHT_LINE_HEIGHT = 0.42;

/** Height a sword is carried at, and how many dots the arc at that height is drawn from. */
const CUT_HEIGHT = 0.62;
const CUT_BEADS = 15;

/** How tall the column at the centre of a landing circle stands, and how many dots it is made of. */
const BEACON_HEIGHT = 1.3;
const BEACON_BEADS = 9;

/**
 * The long weapons that fly point-first, and what each one looks like doing it.
 *
 * Length, width and the two colours are the shipped ones. The gradient matters more than it sounds:
 * the pale end is the end that arrives, and it is most of what tells a javelin from a bar in the air.
 */
const FLYING_RODS: Readonly<
  Partial<Record<PropKind, Readonly<{ length: number; width: number; shaft: number; tip: number }>>>
> = {
  stick: { length: 0.95, width: 0.055, shaft: 0x684224, tip: 0xe8d6b0 },
  skeletonJavelin: { length: 1.3, width: 0.048, shaft: 0xcdbfa2, tip: 0xf4eddc },
  skeletonJavelinCracked: { length: 1.3, width: 0.048, shaft: 0xa89c84, tip: 0xd6cebc },
  crossbowBolt: { length: 0.56, width: 0.038, shaft: 0xe2dac4, tip: 0xf8f4e6 },
};

/**
 * The weapons that turn over end for end on the way.
 *
 * `spin` is radians of tumble per cell travelled: the heavier and clumsier the object the slower it
 * turns, which is most of what separates a blade whipping over from a stock cartwheeling. `guard` is
 * the second bar a sword needs for its crosspiece, held square to the blade so the thing reads as a
 * cross turning rather than as a stick.
 */
type TumblingRod = Readonly<{
  length: number;
  width: number;
  spin: number;
  shaft: number;
  tip: number;
  guard?: Readonly<{ length: number; width: number; shaft: number; tip: number }>;
}>;

const TUMBLING_RODS: Readonly<Partial<Record<PropKind, TumblingRod>>> = {
  hammer: { length: 0.46, width: 0.12, spin: 7.2, shaft: 0x583a20, tip: 0xd6dee8 },
  skeletonSword: {
    length: 0.72,
    width: 0.055,
    spin: 8.4,
    shaft: 0xa2abb6,
    tip: 0xeef2f8,
    guard: { length: 0.2, width: 0.045, shaft: 0x5c3e1c, tip: 0xc49646 },
  },
  crossbowSpent: { length: 0.54, width: 0.09, spin: 5.6, shaft: 0x9a8c74, tip: 0xbac0c8 },
};

/** Radians of tumble per cell travelled, for a prop drawn as a picture rather than as a rod. */
const PROP_TUMBLE = 5.6;

/** Which picture each loose object is drawn from. */
const PROP_SPRITES: Readonly<Record<PropKind, SceneSpriteId | "authored">> = {
  stick: "stick",
  rock: "rock",
  bomb: "bomb",
  hammer: "hammer",
  skeletonSword: "authored",
  skeletonSkull: "authored",
  skeletonFemur: "authored",
  skeletonFemurCracked: "authored",
  skeletonJavelin: "stick",
  skeletonJavelinCracked: "stick",
  crossbow: "hammer",
  crossbowSpent: "hammer",
  crossbowBolt: "stick",
};

/** How each carried object lies where it fell, authored beside how it fills the hand. */
const PROP_DISPLAYS = propDisplaysByKind(parsePropDisplays(propDisplayJson));

type Dot = {
  x: number;
  y: number;
  z: number;
  size: number;
  color: readonly [number, number, number];
  alpha: number;
  additive: boolean;
};

/** One pooled billboard sheet: a quad per instance, its own colour and alpha per instance. */
type DotField = {
  mesh: THREE.InstancedMesh;
  alpha: Float32Array;
  attribute: THREE.InstancedBufferAttribute;
};

export type WorldEffects = Readonly<{
  root: THREE.Group;
  sync(world: World): void;
  dispose(): void;
}>;

export function createWorldEffects(lighting: SceneLighting): WorldEffects {
  const root = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const sprites = createSceneSprites();
  const textures = new Map<SceneSpriteId, THREE.Texture>();

  const textureFor = (id: SceneSpriteId): THREE.Texture => {
    const existing = textures.get(id);

    if (existing) {
      return existing;
    }

    const texture = new THREE.CanvasTexture(sprites[id]);
    texture.colorSpace = THREE.NoColorSpace;
    textures.set(id, texture);
    disposables.push(texture);
    return texture;
  };

  const quad = new THREE.PlaneGeometry(1, 1);
  disposables.push(quad);

  const dotField = (additive: boolean): DotField => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const alpha = new Float32Array(PARTICLE_CAPACITY);
    const attribute = new THREE.InstancedBufferAttribute(alpha, 1);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aAlpha", attribute);
    const material = lighting.particle(additive);
    const mesh = new THREE.InstancedMesh(geometry, material, PARTICLE_CAPACITY);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    // Instance colour has to exist before the first write, or the attribute — and the shader define
    // that reads it — never arrives.
    mesh.setColorAt(0, new THREE.Color(0xffffff));
    root.add(mesh);
    disposables.push(geometry, material, mesh);
    return { mesh, alpha, attribute };
  };

  const plainDots = dotField(false);
  const additiveDots = dotField(true);

  /** Pickups: one camera-facing picture each, at the size the floor authors for it. */
  const propMeshes = new Map<string, THREE.Mesh>();
  const propMaterials = new Map<string, THREE.ShaderMaterial>();
  const authoredTextures = new Map<string, THREE.Texture>();
  const loader = new THREE.TextureLoader();

  for (const [kind, url] of Object.entries(SKELETON_PICKUP_URLS)) {
    const texture = loader.load(url);
    texture.colorSpace = THREE.NoColorSpace;
    authoredTextures.set(kind, texture);
    disposables.push(texture);
  }

  /**
   * Flights: one mesh per thing in the air, pooled by the projectile's own id.
   *
   * Not instanced, because the three ways a thrown thing travels want three different shapes and the
   * count is tiny — a floor holds a handful in the air at once. Pooling by id is what lets a sword
   * keep its crosspiece and a rock keep its picture from frame to frame.
   */
  const rodMaterials = new Map<string, THREE.ShaderMaterial>();
  const flightMeshes = new Map<string, THREE.Mesh>();
  const flightSprites = new Map<string, THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>>();

  /**
   * One unit cube for every rod, sized by the mesh's own scale.
   *
   * Unit-length on purpose: the shaft-to-tip gradient reads the vertex's own z, so a geometry built
   * at its true length would only span the gradient when that length happened to be one — a sword's
   * short crosspiece came out entirely mid-gradient, neither shaft nor tip.
   */
  const rodGeometry = new THREE.BoxGeometry(1, 1, 1);
  disposables.push(rodGeometry);

  const rodMaterial = (shaft: number, tip: number): THREE.ShaderMaterial => {
    const key = `${shaft}:${tip}`;
    const existing = rodMaterials.get(key);

    if (existing) {
      return existing;
    }

    const created = lighting.rod(shaft, tip);
    rodMaterials.set(key, created);
    disposables.push(created);
    return created;
  };

  const orbGeometry = new THREE.PlaneGeometry(1, 1);
  const orbMaterial = lighting.sprite(textureFor("hazardOrb"), { billboard: true });
  const orbs = new THREE.InstancedMesh(orbGeometry, orbMaterial, 32);
  orbs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  orbs.frustumCulled = false;
  orbs.count = 0;
  root.add(orbs);
  disposables.push(orbGeometry, orbMaterial, orbs);

  /** Plumes: the drifting motes a fitting gives off, drawn through the plain dot sheet. */
  let stainMesh: THREE.Mesh | undefined;
  let stainCanvas: HTMLCanvasElement | undefined;
  let stainTexture: THREE.CanvasTexture | undefined;
  let stainMaterial: THREE.ShaderMaterial | undefined;
  let stainVersion = -1;
  let stainExtent = "";

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const along = new THREE.Vector3(0, 0, 1);
  const tint = new THREE.Color();
  const plain: Dot[] = [];
  const additive: Dot[] = [];

  return {
    root,

    sync(world) {
      plain.length = 0;
      additive.length = 0;
      collectParticles(world);
      collectTrails(world);
      collectSightLines(world);
      collectBeacons(world);
      collectPlumes(world);
      writeDots(plainDots, plain);
      writeDots(additiveDots, additive);
      syncProps(world);
      syncFlights(world);
      syncStains(world);
    },

    dispose() {
      for (const disposable of disposables) {
        disposable.dispose();
      }

      for (const mesh of propMeshes.values()) {
        mesh.geometry.dispose();
      }

      for (const material of propMaterials.values()) {
        material.dispose();
      }

      for (const mesh of flightSprites.values()) {
        mesh.material.dispose();
      }

      stainTexture?.dispose();
      stainMaterial?.dispose();
      root.clear();
    },
  };

  function push(dot: Dot): void {
    (dot.additive ? additive : plain).push(dot);
  }

  /**
   * The debris field, at the projection's own sizes.
   *
   * Dust swells as it disperses and fades right out; solid debris keeps its size and simply stops.
   * That difference is most of what tells smoke from stone chips at a glance.
   */
  function collectParticles(world: World): void {
    for (const particle of world.particles.items) {
      const life = Math.min(1, particle.age / Math.max(0.0001, particle.life));
      const dusty = particle.kind === "dust";
      const ember = particle.kind === "ember";
      push({
        x: particle.x,
        y: particle.y,
        z: particle.z,
        size: particle.size * (dusty ? 1 + life * 2.2 : 1 - life * 0.25),
        color: PARTICLE_COLORS[particle.kind] ?? [200, 200, 200],
        alpha: dusty ? 0.42 * (1 - life) : ember ? 1 - life : 1 - life * life * 0.5,
        additive: ember,
      });
    }
  }

  /** A fading ribbon behind anything in flight, from the positions it actually passed through. */
  function collectTrails(world: World): void {
    for (const projectile of world.projectiles) {
      const hot = projectile.kind === "bomb";
      const length = projectile.trail.length;

      projectile.trail.forEach((point, index) => {
        const age = (length - index) / Math.max(1, length);
        push({
          x: point.x,
          y: point.y,
          z: point.z,
          size: (hot ? 0.22 : 0.13) * (1 - age),
          color: hot ? [255, 168, 84] : [186, 176, 190],
          alpha: (1 - age) * (1 - age) * 0.75,
          additive: hot,
        });
      });
    }
  }

  /**
   * What a committed body is about to do, drawn where it will happen.
   *
   * A shooter's line runs to its own shot range and stops at whatever would stop the shot, so cover
   * reads as cover. A swordsman's arc fills from one edge to the other in step with the wind-up.
   */
  function collectSightLines(world: World): void {
    for (const enemy of world.enemies) {
      collectCutArc(world, enemy);

      if (enemy.windupSeconds <= 0 || enemy.intent !== "shoot") {
        continue;
      }

      const dx = enemy.aimX - enemy.x;
      const dy = enemy.aimY - enemy.y;
      const length = Math.hypot(dx, dy);

      if (length < 0.0001) {
        continue;
      }

      const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);
      const range = enemy.archetype.shot?.range ?? 0;
      const reach = Math.min(length, range);
      let index = 0;

      for (let travelled = BEAD_SPACING; travelled <= reach; travelled += BEAD_SPACING) {
        const x = enemy.x + (dx / length) * travelled;
        const y = enemy.y + (dy / length) * travelled;

        if (blocksProjectile(world.maze, Math.floor(x), Math.floor(y))) {
          break;
        }

        const shimmer = 0.82 + 0.18 * Math.sin(world.elapsedSeconds * 15 + index * 1.7);
        push({
          x,
          y,
          z: SIGHT_LINE_HEIGHT,
          size: BEAD_SIZE * (0.8 + progress * 0.5),
          color: BEAD_COLOR,
          alpha: (0.24 + progress * 0.66) * shimmer,
          additive: true,
        });
        index += 1;
      }
    }
  }

  function collectCutArc(world: World, enemy: Enemy): void {
    if (enemy.windupSeconds <= 0 || enemy.intent !== "melee") {
      return;
    }

    const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);
    const reach = attackReach(enemy.archetype);

    for (let index = 0; index < CUT_BEADS; index += 1) {
      const across = index / (CUT_BEADS - 1);
      const angle = enemy.facingAngle + (across * 2 - 1) * MELEE_CUT_HALF_ANGLE;
      const shimmer = 0.84 + 0.16 * Math.sin(world.elapsedSeconds * 18 + index * 1.3);
      const behind = progress - across;
      const lit = behind < 0 ? 0.12 : 0.5 + 0.5 * Math.max(0, 1 - behind * 5);
      push({
        x: enemy.x + Math.cos(angle) * reach,
        y: enemy.y + Math.sin(angle) * reach,
        z: CUT_HEIGHT,
        size: 0.05 + lit * 0.05,
        color: [255, 138, 112],
        alpha: lit * shimmer,
        additive: true,
      });
    }
  }

  /** A column of light standing where a shell is going to land. */
  function collectBeacons(world: World): void {
    const columns: { x: number; y: number; closing: number }[] = [];

    for (const mortar of world.mortars) {
      if (mortar.phase === "locked") {
        columns.push({ x: mortar.aimX, y: mortar.aimY, closing: 0.5 });
      }
    }

    for (const hazard of world.hazards) {
      if (hazard.kind !== "shell") {
        continue;
      }

      const left = hazard.range - hazard.travelled;
      columns.push({
        x: hazard.x + hazard.directionX * left,
        y: hazard.y + hazard.directionY * left,
        closing: Math.min(1, hazard.travelled / Math.max(0.0001, hazard.range)),
      });
    }

    for (const column of columns) {
      for (let bead = 0; bead < BEACON_BEADS; bead += 1) {
        const up = bead / (BEACON_BEADS - 1);
        const shimmer = 0.8 + 0.2 * Math.sin(world.elapsedSeconds * 12 - up * 6);
        push({
          x: column.x,
          y: column.y,
          z: up * BEACON_HEIGHT,
          size: 0.07 * (1 - up * 0.45),
          color: [255, 104, 78],
          alpha: (0.3 + column.closing * 0.6) * (1 - up * 0.55) * shimmer,
          additive: true,
        });
      }
    }
  }

  /**
   * The plumes a floor's fittings give off.
   *
   * Steam from the spring and the way out, embers off the altar, and steam off anything going under.
   * Drawn as motes rising through a column above the source, which is the world-space reading of
   * what the renderer does in screen space.
   */
  function collectPlumes(world: World): void {
    const columns: {
      x: number;
      y: number;
      steam: boolean;
      density: number;
      color: readonly [number, number, number];
    }[] = [];

    for (const enemy of world.enemies) {
      if (enemy.drowningSeconds > 0) {
        columns.push({ x: enemy.x, y: enemy.y, steam: true, density: 9, color: [225, 210, 222] });
      }
    }

    if (world.maze.progress.main.met) {
      columns.push({
        x: world.maze.exit.x + 0.5,
        y: world.maze.exit.y + 0.5,
        steam: true,
        density: 6,
        color: [225, 210, 222],
      });
    }

    if (world.altar.hp > 0) {
      const left = world.altar.maxHp > 0 ? world.altar.hp / world.altar.maxHp : 1;
      columns.push({
        x: world.altar.x,
        y: world.altar.y,
        steam: false,
        density: Math.max(2, Math.round(left * 7)),
        color: [236, 74, 66],
      });
    }

    for (const room of world.maze.rooms) {
      const x = room.center.x + 0.5;
      const y = room.center.y + 0.5;

      if (room.role === "hotSpring") {
        columns.push({ x, y, steam: true, density: 10, color: [225, 210, 222] });
      }

      if (room.role === "extraction") {
        columns.push({ x, y, steam: true, density: 20, color: [136, 238, 78] });

        for (const cornerX of [-1, 1]) {
          for (const cornerY of [-1, 1]) {
            columns.push({
              x: x + cornerX * 1.5,
              y: y + cornerY * 1.5,
              steam: true,
              density: 10,
              color: [136, 238, 78],
            });
          }
        }
      }
    }

    for (const column of columns) {
      const rise = column.steam ? 1.6 : 0.8;
      const opacity = column.steam ? 0.18 : 0.68;

      for (let index = 0; index < column.density; index += 1) {
        const phase = (world.elapsedSeconds * 0.17 + index * 0.19) % 1;
        const wobble = Math.sin(index * 8.3 + world.elapsedSeconds * 1.8);
        push({
          x: column.x + wobble * 0.22,
          y: column.y + Math.cos(index * 4.1) * 0.14,
          z: 0.1 + phase * rise,
          size: 0.08 + phase * 0.22,
          color: column.color,
          alpha: opacity * (1 - phase),
          additive: !column.steam,
        });
      }
    }
  }

  /** Writes a collected list into its instanced sheet, oldest first so overlap reads as depth. */
  function writeDots(field: DotField, dots: readonly Dot[]): void {
    const count = Math.min(dots.length, PARTICLE_CAPACITY);

    for (let index = 0; index < count; index += 1) {
      const dot = dots[index]!;
      position.set(dot.x, dot.z, dot.y);
      scale.setScalar(Math.max(0.001, dot.size));
      field.mesh.setMatrixAt(index, matrix.compose(position, quaternion.identity(), scale));
      tint.setRGB(dot.color[0] / 255, dot.color[1] / 255, dot.color[2] / 255);
      field.mesh.setColorAt(index, tint);
      field.alpha[index] = Math.max(0, Math.min(1, dot.alpha));
    }

    field.mesh.count = count;
    field.mesh.instanceMatrix.needsUpdate = true;
    field.attribute.needsUpdate = true;

    if (field.mesh.instanceColor) {
      field.mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Pickups, as pictures standing on the floor.
   *
   * One mesh per kind on the floor rather than one instanced sheet, because each kind is a different
   * picture and the count is small — a floor holds a dozen. A stack of three draws the same picture
   * three times, fanned, which is how the projection says how many are there.
   */
  function syncProps(world: World): void {
    const seen = new Set<string>();

    for (const prop of world.props) {
      seen.add(prop.id);
      let mesh = propMeshes.get(prop.id);

      if (!mesh) {
        const sprite = PROP_SPRITES[prop.kind];
        const authored = SKELETON_PICKUP_ASSETS[prop.kind as keyof typeof SKELETON_PICKUP_ASSETS];
        const texture =
          sprite === "authored" && authored ? authoredTextures.get(prop.kind) : textureFor(sprite as SceneSpriteId);

        if (!texture) {
          continue;
        }

        const material = lighting.sprite(texture, { billboard: true });
        mesh = new THREE.Mesh(quad, material);
        mesh.frustumCulled = false;
        propMaterials.set(prop.id, material);
        propMeshes.set(prop.id, mesh);
        root.add(mesh);
      }

      const display = PROP_DISPLAYS[prop.kind];
      const size = display?.floorScale ?? 0.4;
      mesh.position.set(prop.x, size / 2 + (display?.floorAnchor ?? 0), prop.y);
      mesh.scale.setScalar(size);
    }

    for (const [id, mesh] of propMeshes) {
      if (seen.has(id)) {
        continue;
      }

      root.remove(mesh);
      propMaterials.get(id)?.dispose();
      propMaterials.delete(id);
      propMeshes.delete(id);
    }
  }

  /**
   * Everything in the air, in the three ways the projection says a thing can travel.
   *
   * A rod that flies point-first takes the pitch of its own launch line, so an upward throw reads as
   * flying up; a rod that tumbles turns end over end at its own rate; anything else is its own
   * picture, spinning. The first build drew one beige bar for all of them, level, and a fifth of a
   * cell too high — which is why every throw looked like the same wrong throw.
   */
  function syncFlights(world: World): void {
    const live = new Set<string>();

    for (const projectile of world.projectiles) {
      const height = projectileHeight(projectile);
      const flying = FLYING_RODS[projectile.kind as PropKind];

      if (flying) {
        live.add(projectile.id);
        // The shaft points along its own flight line, which is the aim line it left the hand on.
        const slope = projectile.arc / Math.max(0.0001, projectile.range);
        placeRod(projectile.id, projectile, Math.atan(slope), height, flying);
        continue;
      }

      const tumbling = TUMBLING_RODS[projectile.kind as PropKind];

      if (tumbling) {
        live.add(projectile.id);
        const spin = projectile.travelled * tumbling.spin;
        placeRod(projectile.id, projectile, spin, height, tumbling);

        if (tumbling.guard) {
          // Square to the blade and turning with it, which is what makes a sword read as a sword
          // rather than as one more bar in the air.
          const guardId = `${projectile.id}-guard`;
          live.add(guardId);
          placeRod(guardId, projectile, spin + Math.PI / 2, height, tumbling.guard);
        }

        continue;
      }

      // Everything else is a picture of itself, turning over as it goes.
      const sprite = PROP_SPRITES[projectile.kind as PropKind];

      if (!sprite) {
        continue;
      }

      live.add(projectile.id);
      placeFlyingSprite(projectile.id, projectile, height, projectile.travelled * PROP_TUMBLE);
    }

    for (const [id, mesh] of flightMeshes) {
      if (live.has(id)) {
        continue;
      }

      root.remove(mesh);
      flightMeshes.delete(id);
    }

    for (const [id, mesh] of flightSprites) {
      if (live.has(id)) {
        continue;
      }

      root.remove(mesh);
      mesh.material.dispose();
      flightSprites.delete(id);
    }

    let incoming = 0;

    for (const hazard of world.hazards) {
      if (incoming >= orbs.instanceMatrix.count) {
        break;
      }

      const share = hazard.range > 0 ? Math.min(1, hazard.travelled / hazard.range) : 0;
      const rise = hazard.arc * share - hazard.fall * share * share;
      position.set(hazard.x, 0.55 + rise, hazard.y);
      scale.setScalar(hazard.kind === "shell" ? 0.5 : 0.32);
      orbs.setMatrixAt(incoming, matrix.compose(position, quaternion.identity(), scale));
      incoming += 1;
    }

    orbs.count = incoming;
    orbs.instanceMatrix.needsUpdate = true;
  }

  /**
   * One rod, at a pitch, centred on its own flight height.
   *
   * `pitch` is what the two kinds disagree about and nothing else does: a flying rod takes the slope
   * of its launch line and holds it, a tumbling one takes an angle that grows with distance covered.
   */
  function placeRod(
    id: string,
    projectile: World["projectiles"][number],
    pitch: number,
    height: number,
    rod: Readonly<{ length: number; width: number; shaft: number; tip: number }>,
  ): void {
    let mesh = flightMeshes.get(id);

    if (!mesh) {
      mesh = new THREE.Mesh(rodGeometry, rodMaterial(rod.shaft, rod.tip));
      mesh.frustumCulled = false;
      flightMeshes.set(id, mesh);
      root.add(mesh);
    }

    mesh.scale.set(rod.width, rod.width, rod.length);

    const flat = Math.hypot(projectile.directionX, projectile.directionY) || 1;
    const alongPitch = Math.cos(pitch);
    forward
      .set((projectile.directionX / flat) * alongPitch, Math.sin(pitch), (projectile.directionY / flat) * alongPitch)
      .normalize();
    mesh.position.set(projectile.x, height, projectile.y);
    mesh.quaternion.setFromUnitVectors(along, forward);
  }

  /** A thrown object that is a picture rather than a bar, turning over as it flies. */
  function placeFlyingSprite(id: string, projectile: World["projectiles"][number], height: number, spin: number): void {
    let mesh = flightSprites.get(id);

    if (!mesh) {
      const kind = projectile.kind as PropKind;
      const sprite = PROP_SPRITES[kind];
      const authored = SKELETON_PICKUP_ASSETS[kind as keyof typeof SKELETON_PICKUP_ASSETS];
      const texture =
        sprite === "authored" && authored ? authoredTextures.get(kind) : textureFor(sprite as SceneSpriteId);

      if (!texture) {
        return;
      }

      const material = lighting.sprite(texture, { billboard: true });
      mesh = new THREE.Mesh(quad, material);
      mesh.frustumCulled = false;
      flightSprites.set(id, mesh);
      root.add(mesh);
    }

    const size = PROP_DISPLAYS[projectile.kind as PropKind]?.floorScale ?? 0.4;
    mesh.position.set(projectile.x, height, projectile.y);
    mesh.scale.setScalar(size);
    // Turned in the plane of the picture, since a billboard has no other axis to turn about.
    mesh.rotation.z = spin;
  }

  /**
   * The floor's staining, as one texture over the whole grid.
   *
   * Redrawn only when the rules bump their own version, which is what makes a per-texel overlay
   * affordable: a floor is stained a few times a fight and read every frame.
   */
  function syncStains(world: World): void {
    const extent = `${world.maze.width}x${world.maze.height}`;

    if (extent !== stainExtent) {
      stainExtent = extent;
      stainVersion = -1;

      if (stainMesh) {
        root.remove(stainMesh);
        stainMesh.geometry.dispose();
      }

      stainTexture?.dispose();
      stainMaterial?.dispose();
      stainCanvas = document.createElement("canvas");
      stainCanvas.width = world.maze.width * STAIN_RESOLUTION;
      stainCanvas.height = world.maze.height * STAIN_RESOLUTION;
      stainTexture = new THREE.CanvasTexture(stainCanvas);
      stainTexture.colorSpace = THREE.SRGBColorSpace;
      const geometry = new THREE.PlaneGeometry(world.maze.width, world.maze.height);
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(world.maze.width / 2, 0.006, world.maze.height / 2);
      stainMaterial = lighting.sprite(stainTexture);
      stainMesh = new THREE.Mesh(geometry, stainMaterial);
      // Just above the ground and drawn after it, which keeps a stain out of the depth fight it
      // would otherwise have with the flagstones it is lying on.
      stainMesh.renderOrder = 1;
      root.add(stainMesh);
    }

    if (!stainCanvas || !stainTexture || world.stainsVersion === stainVersion) {
      return;
    }

    stainVersion = world.stainsVersion;
    const context = stainCanvas.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(0, 0, stainCanvas.width, stainCanvas.height);

    for (let y = 0; y < world.maze.height; y += 1) {
      for (let x = 0; x < world.maze.width; x += 1) {
        const amount = world.stains[y * world.maze.width + x] ?? 0;

        if (amount <= 0) {
          continue;
        }

        context.fillStyle = `rgba(96, 12, 18, ${Math.min(1, amount / MAX_STAIN) * 0.85})`;
        context.fillRect(x * STAIN_RESOLUTION, y * STAIN_RESOLUTION, STAIN_RESOLUTION, STAIN_RESOLUTION);
      }
    }

    stainTexture.needsUpdate = true;
  }
}

/** Which cell of the sword marker's strip says how far a wind-up has charged. */
export function bladeFrame(progress: number): number {
  return Math.min(WARN_BLADE_STEPS - 1, Math.max(0, Math.floor(progress * WARN_BLADE_STEPS)));
}

/** The pictures a marker over a committed body is drawn from, shared with the bodies module. */
export type MarkerSprites = SceneSprites;

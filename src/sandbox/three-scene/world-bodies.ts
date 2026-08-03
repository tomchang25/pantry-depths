/**
 * The bodies standing on the floor.
 *
 * Two kinds, because the rules have two. A boned body is the blocky skeleton — one glTF, cloned per
 * enemy, playing the same table-driven clips the block experiment judged; the sprite bake it replaces
 * has no part in this. A soft body is a low-poly blob deformed by whatever it is doing, which is the
 * plan's declared reinterpretation of the screen-space blobs the Canvas renderer draws.
 *
 * The clip a skeleton plays is chosen from simulation state by the same ladder the Canvas projection
 * uses — drowning, hurt, stunned, wind-up, strike, recovery, then walk or idle — so a body caught
 * mid-anything reads the same way through either renderer.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

import entityDisplayJson from "@/content/enemies/entity-display.json";
import { entityDisplaysByAppearance, parseEntityDisplays } from "@/content/enemies/entity-display-schema";
import { attackCooldown, isBoned, STRIKE_SECONDS, type EnemyAppearanceId } from "@/core/enemy-contract";
import { bodyFootprint, type Death, type Enemy, type World } from "@/core/world";

import type { SceneLighting } from "./scene-lighting";
import { createSceneSprites, WARN_BLADE_STEPS, type SceneSpriteId } from "./scene-sprites";

import blockUrl from "./assets/skeleton-blocky.glb?url";
import { HOLDING_CLIPS, type BlockClip, type BlockWeapon } from "./block-clips";

/** Which weapon each skeleton carries, and therefore which mesh is left visible in its hand. */
const APPEARANCE_WEAPONS: Readonly<Partial<Record<EnemyAppearanceId, BlockWeapon>>> = {
  skeletonSwordsman: "sword",
  skeletonHammerman: "hammer",
  skeletonJavelineer: "javelin",
  skeletonCrossbowman: "crossbow",
};

/**
 * How tall each body stands, in cells, as authored.
 *
 * The same table the Canvas projection reads, and the reason a skeleton here is the height it is in
 * play rather than the height the armature happens to have been modelled at: the glTF is about two
 * cells tall in its own space, and a body twice the height of the walls around it is the single
 * loudest way a port can look wrong.
 */
const DISPLAYS = entityDisplaysByAppearance(parseEntityDisplays(entityDisplayJson));

/**
 * What colour each soft body is.
 *
 * Monotonic with the authored heights beside them: the colour tells the player the size and the size
 * tells them the health. Only the colour lives here — the height is authored above and the width is
 * the archetype's footprint, which is also the shove the body gives and the target a throw has to
 * hit. A second copy of either is how the drawn body and the bumped body drift apart.
 */
const SLIME_COLORS: Readonly<Partial<Record<EnemyAppearanceId, number>>> = {
  greenSlime: 0x76c65c,
  yellowSlime: 0xd8c85c,
  blueSlime: 0x6098da,
  redSlime: 0xd85c56,
  purpleSlime: 0xa96cd8,
};

const FALLBACK_SLIME_COLOR = 0xa0a0a0;

function slimeProfile(appearance: EnemyAppearanceId): Readonly<{ height: number; color: number }> {
  return {
    height: DISPLAYS[appearance]?.bodyScale ?? 0.46,
    color: SLIME_COLORS[appearance] ?? FALLBACK_SLIME_COLOR,
  };
}

/** How long a wind-up or recovery takes to reach its final pose, whatever the state's own length. */
const ATTACK_EASE_SECONDS = 0.45;

/** Stable per-body phase, so a crowd does not move in lockstep. */
function bodyPhase(id: string): number {
  let hash = 0;

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 997;
  }

  return hash * 0.35;
}

/** Progress into a clip that reaches its end in a fixed time and then holds there. */
function easeThenHold(elapsedSeconds: number): number {
  return Math.min(0.999, elapsedSeconds / ATTACK_EASE_SECONDS);
}

/** Which clip a body is playing, and how far into it, given only what the rules already track. */
function clipFor(enemy: Enemy, weapon: BlockWeapon): Readonly<{ clip: BlockClip; progress: number }> {
  const aiming = weapon === "crossbow";

  if (enemy.drowningSeconds > 0 || enemy.stunSeconds > 0 || enemy.hurtSeconds > 0) {
    // None of the three has a clip in this armature — the blocky skeleton carries seven, and going
    // under, being clubbed and being cut are all told by the body's transform and its colour instead.
    return { clip: "idle", progress: 0 };
  }

  if (enemy.windupSeconds > 0) {
    return {
      clip: aiming ? "crossbowAim" : "windup",
      progress: easeThenHold(enemy.windupTotal - enemy.windupSeconds),
    };
  }

  if (enemy.attackPoseSeconds > 0) {
    return {
      clip: aiming ? "crossbowAim" : "strike",
      progress: 1 - enemy.attackPoseSeconds / STRIKE_SECONDS,
    };
  }

  if (enemy.attackCooldown > 0 && !enemy.moving) {
    const spent = attackCooldown(enemy.archetype) - enemy.attackCooldown;
    return { clip: aiming ? "crossbowReload" : "recovery", progress: easeThenHold(spent) };
  }

  return { clip: enemy.moving ? "walk" : "idle", progress: 0 };
}

/** One skeleton standing on the floor: its own copy of the armature and its own mixer. */
type BonedBody = {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  action: THREE.AnimationAction | undefined;
  clip: BlockClip | undefined;
  weapon: BlockWeapon;
  weaponParts: Map<string, THREE.Object3D[]>;
  materials: THREE.ShaderMaterial[];
};

type SoftBody = {
  mesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.ShaderMaterial>;
  appearance: EnemyAppearanceId;
};

export type WorldBodies = Readonly<{
  root: THREE.Group;
  /** Resolves once the armature has arrived; until then the floor simply has no skeletons on it. */
  ready: Promise<void>;
  sync(world: World, elapsedSeconds: number, deltaSeconds: number): void;
  dispose(): void;
}>;

/** How many stars orbit a stunned head, how far out, and how big each one is. */
const STUN_STARS = 3;
const STUN_ORBIT_RADIUS = 0.32;
const STUN_STAR_SCALE = 0.3;

export function createWorldBodies(lighting: SceneLighting): WorldBodies {
  const root = new THREE.Group();
  const boned = new Map<string, BonedBody>();
  const soft = new Map<string, SoftBody>();
  const corpses = new Map<string, THREE.Object3D>();
  const clips = new Map<string, THREE.AnimationClip>();
  const disposables: { dispose(): void }[] = [];
  const sprites = createSceneSprites();
  const markerTextures = new Map<SceneSpriteId, THREE.Texture>();
  const markers = new Map<string, THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>>();
  const markerQuad = new THREE.PlaneGeometry(1, 1);
  disposables.push(markerQuad);

  const markerTexture = (id: SceneSpriteId): THREE.Texture => {
    const existing = markerTextures.get(id);

    if (existing) {
      return existing;
    }

    const texture = new THREE.CanvasTexture(sprites[id]);
    texture.colorSpace = THREE.NoColorSpace;
    markerTextures.set(id, texture);
    disposables.push(texture);
    return texture;
  };
  let template: THREE.Object3D | undefined;
  /** The armature's own height, measured rather than assumed, so the authored scale lands right. */
  let templateHeight = 1;

  const ready = new GLTFLoader().loadAsync(blockUrl).then((gltf) => {
    // Half a turn: glTF is Y-up and Blender is Z-up, so the conversion sends the body's own forward
    // to −Z. The turn is baked into a wrapper rather than into every clone's rotation, so a body's
    // own rotation stays free to carry its heading.
    const wrapper = new THREE.Group();
    gltf.scene.rotation.y = Math.PI;
    wrapper.add(gltf.scene);
    template = wrapper;
    wrapper.updateMatrixWorld(true);
    templateHeight = Math.max(0.001, new THREE.Box3().setFromObject(wrapper).getSize(new THREE.Vector3()).y);

    for (const clip of gltf.animations) {
      clips.set(clip.name, clip);
    }
  });

  const spawnBoned = (enemy: Enemy): BonedBody | undefined => {
    if (!template) {
      return undefined;
    }

    const instance = cloneSkinned(template);
    const weapon = APPEARANCE_WEAPONS[enemy.appearance] ?? "sword";
    const weaponParts = new Map<string, THREE.Object3D[]>();
    const materials: THREE.ShaderMaterial[] = [];
    instance.traverse((object) => {
      const carried = /^Weapon_([a-z]+)_/.exec(object.name)?.[1];

      if (carried) {
        const parts = weaponParts.get(carried) ?? [];
        parts.push(object);
        weaponParts.set(carried, parts);
      }

      if (object instanceof THREE.Mesh) {
        // The armature's own colours, run through the shipped body formula: the glTF's material is
        // read once for its base colour and then replaced, because what shades a body here is
        // distance and the light list rather than anything the file was exported with.
        const source = object.material;
        const authored = Array.isArray(source) ? source[0] : source;
        const base =
          authored instanceof THREE.MeshStandardMaterial || authored instanceof THREE.MeshBasicMaterial
            ? authored.color.getHex()
            : 0xd9c9a8;
        // One material per mesh per body, so a hit whitens one skeleton rather than the whole floor.
        const own = lighting.body(base);
        object.material = own;
        materials.push(own);
        disposables.push(own);
      }
    });

    for (const [name, parts] of weaponParts) {
      for (const part of parts) {
        part.visible = name === weapon;
      }
    }

    instance.scale.setScalar((DISPLAYS[enemy.appearance]?.bodyScale ?? 0.755) / templateHeight);

    const body: BonedBody = {
      root: instance,
      mixer: new THREE.AnimationMixer(instance),
      action: undefined,
      clip: undefined,
      weapon,
      weaponParts,
      materials,
    };
    root.add(instance);
    return body;
  };

  const spawnSoft = (enemy: Enemy): SoftBody => {
    const profile = slimeProfile(enemy.appearance);
    // Two subdivisions: enough to read as a body rather than a die, few enough to stay low-poly,
    // which is the look this whole experiment is testing.
    const geometry = new THREE.IcosahedronGeometry(0.5, 2);
    const material = lighting.body(profile.color, false);
    const mesh = new THREE.Mesh(geometry, material);
    disposables.push(geometry, material);
    root.add(mesh);
    return { mesh, appearance: enemy.appearance };
  };

  const playClip = (body: BonedBody, name: BlockClip, progress: number, deltaSeconds: number): void => {
    const clip = clips.get(name);

    if (!clip) {
      return;
    }

    if (body.clip !== name) {
      body.action?.stop();
      const action = body.mixer.clipAction(clip);
      action.reset();
      const holds = HOLDING_CLIPS.has(name);
      action.setLoop(holds ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = holds;
      action.play();
      body.action = action;
      body.clip = name;
    }

    if (!body.action) {
      return;
    }

    if (HOLDING_CLIPS.has(name)) {
      // Driven, not ticked: the simulation owns how long a telegraph lasts, so the clip is placed on
      // the fraction the rules report rather than advanced by the frame's own time.
      body.action.time = clip.duration * Math.min(0.999, Math.max(0, progress));
      body.mixer.update(0);
      return;
    }

    body.mixer.update(deltaSeconds);
  };

  return {
    root,
    ready,

    sync(world, elapsedSeconds, deltaSeconds) {
      const livingBoned = new Set<string>();
      const livingSoft = new Set<string>();

      for (const enemy of world.enemies) {
        if (isBoned(enemy.archetype)) {
          livingBoned.add(enemy.id);
          let body = boned.get(enemy.id);

          if (!body) {
            body = spawnBoned(enemy);

            if (!body) {
              continue;
            }

            boned.set(enemy.id, body);
          }

          // Going under is the one state with no clip: the body keeps whatever it was playing and
          // sinks, which is what the rules describe happening to it.
          const sink = enemy.drowningSeconds > 0 ? Math.min(1, 1 - enemy.drowningSeconds / 1.6) * 1.2 : 0;
          body.root.position.set(enemy.x, -sink, enemy.y);
          // Half a turn away from the camera's own formula, and that distinction was a real defect:
          // the camera looks down its local −Z while this armature was turned to face +Z, so reusing
          // the yaw the camera uses pointed every body exactly backwards.
          body.root.rotation.y = Math.PI / 2 - enemy.facingAngle;
          const stagger = enemy.stunSeconds > 0 ? Math.sin(elapsedSeconds * 9 + bodyPhase(enemy.id)) * 0.12 : 0;
          body.root.rotation.z = stagger;

          const chosen = clipFor(enemy, body.weapon);
          playClip(body, chosen.clip, chosen.progress, deltaSeconds);

          // A javelin leaves the hand at the throw, so it is hidden from the release onward rather
          // than for the whole clip: the wind-up is the frame that says what is coming.
          const thrown =
            body.weapon === "javelin" &&
            ((chosen.clip === "strike" && chosen.progress >= 0.45) || chosen.clip === "recovery");

          for (const [name, parts] of body.weaponParts) {
            for (const part of parts) {
              part.visible = name === body.weapon && !thrown;
            }
          }

          const flash = enemy.hurtSeconds > 0 ? Math.min(1, enemy.hurtSeconds / 0.16) : 0;

          for (const material of body.materials) {
            material.uniforms.uFlash!.value = flash;
          }

          continue;
        }

        livingSoft.add(enemy.id);
        let blob = soft.get(enemy.id);

        if (!blob) {
          blob = spawnSoft(enemy);
          soft.set(enemy.id, blob);
        }

        const profile = slimeProfile(enemy.appearance);
        const footprint = bodyFootprint(enemy.archetype);
        const phase = bodyPhase(enemy.id);
        const acting = enemy.stunSeconds > 0 || enemy.windupSeconds > 0 || enemy.attackPoseSeconds > 0;
        // Gait: a bounce in time with the body's own speed, landing squashed and leaving stretched.
        let squash = acting ? 1 : 1 + Math.sin(elapsedSeconds * (5.5 + enemy.archetype.speed * 2.2) + phase) * 0.08;

        if (enemy.stunSeconds > 0) {
          squash = 0.85;
        }

        if (enemy.windupSeconds > 0) {
          squash = 1.18;
        }

        if (enemy.hurtSeconds > 0) {
          squash = 0.78;
        }

        const sink = enemy.drowningSeconds > 0 ? Math.min(1, 1 - enemy.drowningSeconds / 1.6) : 0;
        const height = profile.height * squash;
        blob.mesh.position.set(enemy.x, height / 2 - sink * (height + 0.1), enemy.y);
        blob.mesh.scale.set(footprint * 2, height, footprint * 2);
        const flash = enemy.hurtSeconds > 0 ? Math.min(1, enemy.hurtSeconds / 0.16) : 0;
        blob.mesh.material.uniforms.uFlash!.value = flash;
      }

      for (const [id, body] of boned) {
        if (livingBoned.has(id)) {
          continue;
        }

        body.mixer.stopAllAction();
        root.remove(body.root);
        boned.delete(id);
      }

      for (const [id, blob] of soft) {
        if (livingSoft.has(id)) {
          continue;
        }

        root.remove(blob.mesh);
        soft.delete(id);
      }

      syncCorpses(world);
      syncMarkers(world, elapsedSeconds);
    },

    dispose() {
      for (const body of boned.values()) {
        body.mixer.stopAllAction();
      }

      for (const disposable of disposables) {
        disposable.dispose();
      }

      for (const marker of markers.values()) {
        marker.material.dispose();
      }

      boned.clear();
      soft.clear();
      corpses.clear();
      markers.clear();
      root.clear();
    },
  };

  /**
   * The mark over a committed body, and the stars over a clubbed one.
   *
   * Both float at the body's own crown, which is the authored height rather than a constant: a green
   * slime and a skeleton wear their marks in very different places, and one number could only ever be
   * right for whichever was authored first. The sword marker fills as it charges by choosing a cell
   * of its strip; the other two swell, which is the same statement made with size.
   */
  function syncMarkers(world: World, elapsedSeconds: number): void {
    const present = new Set<string>();

    for (const enemy of world.enemies) {
      const display = DISPLAYS[enemy.appearance];
      const crown = isBoned(enemy.archetype) ? (display?.bodyScale ?? 0.755) : slimeProfile(enemy.appearance).height;

      if (enemy.stunSeconds > 0) {
        for (let index = 0; index < STUN_STARS; index += 1) {
          const id = `${enemy.id}-stun-${index}`;
          present.add(id);
          const angle = elapsedSeconds * 3.4 + (index / STUN_STARS) * Math.PI * 2;
          const star = markerAt(id, "stunStar");
          star.position.set(
            enemy.x + Math.cos(angle) * STUN_ORBIT_RADIUS,
            crown + 0.12,
            enemy.y + Math.sin(angle) * STUN_ORBIT_RADIUS,
          );
          star.scale.setScalar(STUN_STAR_SCALE);
        }
      }

      if (enemy.windupSeconds <= 0 || enemy.intent === "none") {
        continue;
      }

      const id = `${enemy.id}-warn`;
      present.add(id);
      const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);
      const scale = (display?.markerScale ?? 0.2) + progress * (display?.markerSwell ?? 0.065);
      const shape: SceneSpriteId =
        enemy.intent === "shoot" ? "warnShoot" : enemy.intent === "charge" ? "warnCharge" : "warnMelee";
      const marker = markerAt(id, shape);
      marker.position.set(enemy.x, crown + (display?.markerOffset ?? 0) + scale / 2, enemy.y);
      marker.scale.setScalar(scale);

      if (shape === "warnMelee") {
        const column = Math.min(WARN_BLADE_STEPS - 1, Math.floor(progress * WARN_BLADE_STEPS));
        marker.material.uniforms.uUvRect!.value.set(column / WARN_BLADE_STEPS, 0, 1 / WARN_BLADE_STEPS, 1);
      }
    }

    for (const [id, mesh] of markers) {
      if (present.has(id)) {
        continue;
      }

      root.remove(mesh);
      mesh.material.dispose();
      markers.delete(id);
    }
  }

  /** The billboard for one marker, made on first sight and kept while its body is committed. */
  function markerAt(id: string, shape: SceneSpriteId): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
    const existing = markers.get(id);

    if (existing) {
      return existing;
    }

    const material = lighting.sprite(markerTexture(shape), { billboard: true });
    const mesh = new THREE.Mesh(markerQuad, material);
    mesh.frustumCulled = false;
    markers.set(id, mesh);
    root.add(mesh);
    return mesh;
  }

  /**
   * What is left where a body fell.
   *
   * Deliberately the crudest thing in this module: a flattening lump that settles and goes. The
   * Canvas renderer has six deaths with their own animations, and reproducing them is not what the
   * atmosphere question turns on — what it turns on is whether the floor still says a body died here.
   */
  function syncCorpses(world: World): void {
    const present = new Set<string>();

    for (const death of world.deaths) {
      present.add(death.id);
      let mark = corpses.get(death.id);

      if (!mark) {
        mark = createCorpse(death);
        corpses.set(death.id, mark);
        root.add(mark);
      }

      const settled = Math.min(1, Math.max(0, death.progress));
      mark.position.set(death.x, 0.02, death.y);
      mark.scale.set(1 + settled * 0.5, Math.max(0.05, 1 - settled), 1 + settled * 0.5);
    }

    for (const [id, mark] of corpses) {
      if (present.has(id)) {
        continue;
      }

      root.remove(mark);
      corpses.delete(id);
    }
  }

  function createCorpse(death: Death): THREE.Object3D {
    const geometry = new THREE.IcosahedronGeometry(0.32, 1);
    const profile = slimeProfile(death.appearance);
    const material = lighting.body(profile.color, false);
    disposables.push(geometry, material);
    return new THREE.Mesh(geometry, material);
  }
}

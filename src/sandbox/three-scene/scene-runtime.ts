/**
 * The floor, drawn and played.
 *
 * Everything atmospheric in this experiment is decided here: the field of view, the fog, the torch,
 * and the night the two of them are read against. The numbers come from the Canvas scene builder
 * rather than from taste, because the question this experiment answers is whether the same floor
 * under the same light reads the same way through a different renderer.
 *
 * The world is the game's own. It is created and stepped exactly as the play surface steps it, and
 * nothing here writes to it except the player's input — so what is on screen is the real simulation
 * with a different pair of eyes on it, which is the only arrangement in which the comparison means
 * anything.
 */

import * as THREE from "three";

import { GAME_CATALOG } from "@/content/catalog";
import { grabAction, primaryAction } from "@/core/actions";
import {
  createWorld,
  crowdHere,
  flattenFloorForTesting,
  killEnemy,
  spawnReinforcement,
  type World,
} from "@/core/world";
import { stepWorld } from "@/core/simulation";
import type { ResolvedMap } from "@/core/map-contract";

import { buildFloorMeshes, triangleCount, type FloorMeshes } from "./floor-meshes";
import { buildSky, type Sky } from "./sky";
import { createSceneTextures, type SceneTextureSet } from "./scene-textures";
import { createWorldBodies, type WorldBodies } from "./world-bodies";
import { createWorldEffects, type WorldEffects } from "./world-effects";
import { createWorldStructures, type WorldStructures } from "./world-structures";
import { createViewmodel, type Viewmodel, type ViewmodelKind } from "./viewmodel";

/**
 * Vertical field of view, derived rather than chosen.
 *
 * The Canvas raycaster projects every height as `canvasHeight / depth`, which pins its vertical
 * half-angle at `atan(0.5)` and leaves it unauthored. A spike framed any wider would be judged
 * against the shipped renderer on framing instead of on light, so the angle is taken rather than set.
 */
const VERTICAL_FOV_DEGREES = (2 * Math.atan(0.5) * 180) / Math.PI;

/** Where the eye sits, in cells off the ground. Half a cell, as the scene builder has it. */
const EYE_HEIGHT = 0.5;

/** Just enough ambient that an unlit corridor is a silhouette rather than a black rectangle. */
const AMBIENT: readonly [number, number, number] = [0.16, 0.14, 0.24];

/** The torch the player carries, as an actual light in the world. */
const TORCH_RADIUS = 8.5;
const TORCH_COLOR = 0xffb068;
const TORCH_INTENSITY = 1.35;

/** How thick the dark is. The one number here with no counterpart in the Canvas renderer. */
const FOG_DENSITY = 0.055;

/**
 * How many of a floor's fittings get a real light at once.
 *
 * The Canvas renderer accumulates every light per pixel and pays only arithmetic for it; a forward
 * WebGL renderer recompiles its shaders per light count and pays for each one on every fragment. So
 * the nearest few win and the rest go dark, which is a limitation worth seeing rather than hiding.
 */
const FITTING_LIGHTS = 4;

const MOUSE_SENSITIVITY = 0.0026;
const MAX_PITCH = 1.45;

/** The colour the way down is picked out in once it opens, seen through whatever stands in front. */
const EXIT_MARKER_COLOR = 0x8affbe;

const MOVEMENT_KEYS: Readonly<Record<string, "forward" | "backward" | "strafeLeft" | "strafeRight">> = {
  w: "forward",
  s: "backward",
  a: "strafeLeft",
  d: "strafeRight",
};

export type SceneStatus = Readonly<{
  cell: string;
  fps: number;
  triangles: number;
  drawCalls: number;
  bodies: number;
  hp: string;
}>;

type RuntimeCallbacks = Readonly<{
  onStatus(status: SceneStatus): void;
}>;

export class SceneRuntime {
  private animationFrame = 0;
  private readonly ambient: THREE.AmbientLight;
  private readonly bodies: WorldBodies;
  private readonly camera: THREE.PerspectiveCamera;
  private disposed = false;
  private readonly effects: WorldEffects;
  private readonly fittings: THREE.PointLight[] = [];
  private floor: FloorMeshes;
  private frameCount = 0;
  private readonly input = { forward: false, backward: false, strafeLeft: false, strafeRight: false };
  private lastFrameTime = performance.now();
  private metricsElapsed = 0;
  private paused = false;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;
  private readonly scene = new THREE.Scene();
  private readonly sky: Sky;
  private readonly structures: WorldStructures;
  private readonly textures: SceneTextureSet;
  private readonly exitMarker: THREE.Mesh;
  private terrainVersion = -1;
  private readonly torch: THREE.PointLight;
  private torchEnabled = true;
  private readonly viewmodel: Viewmodel;
  private world: World;

  constructor(
    private readonly viewport: HTMLElement,
    private map: ResolvedMap,
    private readonly callbacks: RuntimeCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Tone mapped, and this is not a stylistic choice. A point light falls off with the square of
    // distance, so a torch carried at the eye puts an enormous value on any wall the player stands
    // against — and without a curve to roll it off, walking up to masonry turns the screen white.
    // The Canvas renderer never had the problem because it clamps its light accumulation per pixel;
    // this is the equivalent, and it is the difference between a floor that can be approached and one
    // that can only be looked at from the middle of a room.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.className = "three-scene__canvas";
    this.viewport.append(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(VERTICAL_FOV_DEGREES, 1, 0.02, 400);
    this.camera.rotation.order = "YXZ";

    this.textures = createSceneTextures();
    this.sky = buildSky();
    this.scene.add(this.sky.root);
    // Exponential rather than linear: the Canvas renderer's distance falloff comes from a point
    // light, which dies off with the square of distance, and a linear ramp against that reads as a
    // grey curtain hung at a fixed range.
    this.scene.fog = new THREE.FogExp2(this.sky.horizonColor.getHex(), FOG_DENSITY);

    this.ambient = new THREE.AmbientLight(new THREE.Color(AMBIENT[0], AMBIENT[1], AMBIENT[2]).getHex(), Math.PI);
    this.scene.add(this.ambient);

    this.torch = new THREE.PointLight(TORCH_COLOR, TORCH_INTENSITY, TORCH_RADIUS, 1.6);
    this.scene.add(this.torch);

    for (let index = 0; index < FITTING_LIGHTS; index += 1) {
      const light = new THREE.PointLight(0xffffff, 0, 1, 1.6);
      this.scene.add(light);
      this.fittings.push(light);
    }

    this.world = createWorld(map, GAME_CATALOG);
    this.floor = buildFloorMeshes(this.world.maze, this.textures);
    this.terrainVersion = this.world.terrainVersion;
    this.scene.add(this.floor.root);

    this.bodies = createWorldBodies();
    this.structures = createWorldStructures();
    this.effects = createWorldEffects();
    this.scene.add(this.bodies.root, this.structures.root, this.effects.root);

    this.viewmodel = createViewmodel();
    // The camera joins the scene graph so anything parented to it is drawn; a camera outside the
    // graph still renders the world and silently drops its own children.
    this.camera.add(this.viewmodel.meshRoot);
    this.scene.add(this.camera);
    this.viewport.append(this.viewmodel.overlay);
    this.viewmodel.setKind("mesh");

    this.exitMarker = createExitMarker();
    this.scene.add(this.exitMarker);
    this.faceOpenGround();

    // Development-only handle, the same arrangement the block preview and the play surface both use:
    // a picture taken from wherever the mouse happened to be left is not comparable with the last
    // one, and judging a floor means standing in the same spot twice.
    (window as unknown as Record<string, unknown>).__sceneRuntime = this;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.resize();
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  /** The world the floor is running, so a development session can pose it and look at the result. */
  get inspected(): World {
    return this.world;
  }

  /** Stands the eye somewhere and points it, for a picture taken from a chosen place. */
  stand(x: number, y: number, angle: number, pitch = 0): void {
    this.world.player.x = x;
    this.world.player.y = y;
    this.world.player.angle = angle;
    this.world.player.pitch = pitch;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.bodies.dispose();
    this.structures.dispose();
    this.effects.dispose();
    this.viewmodel.dispose();
    this.exitMarker.geometry.dispose();
    (this.exitMarker.material as THREE.Material).dispose();
    this.floor.dispose();
    this.sky.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Starts the map again from its arrival, which is also how another map is opened. */
  restart(map: ResolvedMap = this.map): void {
    this.map = map;
    this.world = createWorld(map, GAME_CATALOG);
    this.rebuildFloor();
    this.faceOpenGround();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.releaseKeys();
  }

  /** Which pair of hands is on screen, or neither. */
  setViewmodel(kind: ViewmodelKind): void {
    this.viewmodel.setKind(kind);
  }

  setTorchEnabled(enabled: boolean): void {
    this.torchEnabled = enabled;
    this.torch.visible = enabled;
  }

  setFogEnabled(enabled: boolean): void {
    this.scene.fog = enabled ? new THREE.FogExp2(this.sky.horizonColor.getHex(), FOG_DENSITY) : null;
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.Material) {
        object.material.needsUpdate = true;
      }
    });
  }

  /** Empties the floor through the ordinary exit, so every death happens exactly as it does in play. */
  killEverything(): void {
    for (const enemy of this.world.enemies.slice()) {
      killEnemy(this.world, enemy);
    }
  }

  /**
   * Takes the masonry down, which is the game's own arena key.
   *
   * The frame-rate worst case and the body-judging case at once: nothing occludes anything, so a
   * crowd is all visible at the distance a fight happens at rather than one body at a time round a
   * corner.
   */
  flatten(): void {
    flattenFloorForTesting(this.world);
  }

  /** Refills the floor to the cap it fills itself to, without waiting out the reinforcement timer. */
  fillCrowd(): void {
    while (this.world.enemies.length < crowdHere(this.world).cap) {
      if (!spawnReinforcement(this.world)) {
        break;
      }
    }
  }

  holdKey(key: string, held: boolean): void {
    const binding = MOVEMENT_KEYS[key];

    if (binding) {
      this.input[binding] = held;
    }
  }

  releaseKeys(): void {
    this.input.forward = false;
    this.input.backward = false;
    this.input.strafeLeft = false;
    this.input.strafeRight = false;
  }

  look(movementX: number, movementY: number): void {
    const player = this.world.player;
    const turned = player.angle + movementX * MOUSE_SENSITIVITY;
    player.angle = turned - Math.PI * 2 * Math.floor(turned / (Math.PI * 2));
    // A real camera pitch rather than the raycaster's screen shear, which is the one thing a
    // perspective projection gets for free and the column renderer can never have.
    player.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, player.pitch - movementY * MOUSE_SENSITIVITY));
  }

  strike(): void {
    primaryAction(this.world);
  }

  grab(): void {
    grabAction(this.world);
  }

  private rebuildFloor(): void {
    this.scene.remove(this.floor.root);
    this.floor.dispose();
    this.floor = buildFloorMeshes(this.world.maze, this.textures);
    this.terrainVersion = this.world.terrainVersion;
    this.scene.add(this.floor.root);
  }

  /**
   * Turns the arrival to face whichever way sees furthest.
   *
   * The position is the game's own — the rules put the player on the entrance. The heading is not,
   * because the game has no opening heading and an arbitrary one lands against masonry about as often
   * as not: an experiment whose first frame is a wall face at arm's length reads as a broken renderer
   * for the second it takes to turn around, and this one is opened to be looked at.
   */
  private faceOpenGround(): void {
    const maze = this.world.maze;
    const player = this.world.player;
    let bestAngle = player.angle;
    let bestRun = -1;

    for (let step = 0; step < 32; step += 1) {
      const angle = (step / 32) * Math.PI * 2;
      const stepX = Math.cos(angle);
      const stepY = Math.sin(angle);
      let run = 0;

      while (run < 24) {
        const cellX = Math.floor(player.x + stepX * (run + 0.5));
        const cellY = Math.floor(player.y + stepY * (run + 0.5));
        const tile = maze.tiles[cellY * maze.width + cellX];

        if (!tile || (tile.kind !== "open" && tile.kind !== "filled")) {
          break;
        }

        run += 0.5;
      }

      if (run > bestRun) {
        bestRun = run;
        bestAngle = angle;
      }
    }

    player.angle = bestAngle;
    player.pitch = 0;
  }

  /** Hands the nearest fittings the few real lights the frame can afford. */
  private aimFittingLights(elapsedSeconds: number): void {
    const player = this.world.player;
    const wanted = this.structures
      .lights(this.world, elapsedSeconds)
      .map((light) => ({ light, distance: Math.hypot(light.x - player.x, light.y - player.y) }))
      // Sorted in place, which the linter warns about and is right to in general: here the array was
      // created by the `map` on the line above and nothing else can see it. `toSorted` is not
      // available at this project's compile target.
      .sort((left, right) => left.distance - right.distance)
      .slice(0, this.fittings.length);

    this.fittings.forEach((light, index) => {
      const chosen = wanted[index];

      if (!chosen) {
        light.intensity = 0;
        return;
      }

      light.position.set(chosen.light.x, 0.7, chosen.light.y);
      light.color.setHex(chosen.light.color);
      light.distance = chosen.light.radius;
      light.intensity = chosen.light.intensity * Math.PI;
    });
  }

  private readonly frame = (time: number): void => {
    if (this.disposed) {
      return;
    }

    const delta = Math.min((time - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = time;

    if (!this.paused) {
      stepWorld(this.world, this.input, delta);
    }

    // Cues are drained rather than played: this experiment carries no audio, and leaving them to
    // accumulate would grow an array nobody empties for as long as the tab is open.
    this.world.sfxCues.length = 0;

    if (this.world.terrainVersion !== this.terrainVersion) {
      // A wall came down or a pool closed over, and the floor's geometry is stale. Rebuilt whole,
      // because it takes about a millisecond and happens a dozen times a floor.
      this.rebuildFloor();
    }

    const player = this.world.player;
    const elapsed = this.world.elapsedSeconds;
    // Every camera hitch the rules raise, in the same terms the Canvas scene builder reads them: a
    // detonation nearby, the weight of something thrown or landed, and the tap of a connected swing.
    // Applied as a real pitch here rather than as the horizon shear a column raycaster is limited to.
    const kick = blastKick(this.world) + weightKick(this.world) + meleeImpactPitch(this.world.impact);
    this.camera.position.set(player.x, EYE_HEIGHT, player.y);
    this.camera.rotation.set(player.pitch + kick, -player.angle - Math.PI / 2, 0);

    // The same two-term flicker the scene builder gives the torch: one fast, one slow, so it never
    // settles into a readable pulse.
    const flicker = 0.9 + Math.sin(elapsed * 11.3) * 0.06 + Math.sin(elapsed * 4.1) * 0.04;
    this.torch.position.set(player.x, EYE_HEIGHT, player.y);
    this.torch.intensity = this.torchEnabled ? TORCH_INTENSITY * flicker * Math.PI : 0;
    this.sky.root.position.set(player.x, 0, player.y);

    this.bodies.sync(this.world, elapsed, this.paused ? 0 : delta);
    this.structures.sync(this.world);
    this.effects.sync(this.world);
    this.viewmodel.sync(this.world);
    this.aimFittingLights(elapsed);

    // The one thing on a floor still drawn through a wall, and only once the descent is unlocked.
    this.exitMarker.visible = this.world.maze.progress.main.met;
    this.exitMarker.position.set(this.world.maze.exit.x + 0.5, 1.2, this.world.maze.exit.y + 0.5);
    this.exitMarker.rotation.y = elapsed * 0.9;

    this.renderer.render(this.scene, this.camera);

    this.frameCount += 1;
    this.metricsElapsed += delta;

    if (this.metricsElapsed >= 0.4) {
      this.callbacks.onStatus({
        bodies: this.world.enemies.length,
        cell: `${Math.floor(player.x)}, ${Math.floor(player.y)}`,
        drawCalls: this.renderer.info.render.calls,
        fps: Math.round(this.frameCount / this.metricsElapsed),
        hp: `${Math.max(0, Math.round(player.hp))} / ${player.maxHp}`,
        triangles: triangleCount(this.floor),
      });
      this.metricsElapsed = 0;
      this.frameCount = 0;
    }

    this.animationFrame = requestAnimationFrame(this.frame);
  };

  private resize(): void {
    const width = Math.max(1, this.viewport.clientWidth);
    const height = Math.max(1, this.viewport.clientHeight);
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.viewmodel.resize(width, height);
  }
}

/**
 * The way down, picked out through whatever stands in front of it.
 *
 * Depth testing off and drawn last, which is the whole trick: the Canvas renderer has an x-ray list
 * its column pass consults, and this is the equivalent a depth-buffered renderer already has for
 * free. Kept small and unlit so it reads as a mark on the screen rather than as an object in a room.
 */
function createExitMarker(): THREE.Mesh {
  const geometry = new THREE.OctahedronGeometry(0.22);
  const material = new THREE.MeshBasicMaterial({
    color: EXIT_MARKER_COLOR,
    depthTest: false,
    depthWrite: false,
    fog: false,
    transparent: true,
    opacity: 0.95,
  });
  const marker = new THREE.Mesh(geometry, material);
  marker.renderOrder = 20;
  marker.visible = false;
  return marker;
}

/**
 * A shake for every detonation still burning, loudest close by.
 *
 * Summed rather than taken from the nearest, because two going off at once is twice the event.
 */
function blastKick(world: World): number {
  let kick = 0;

  for (const effect of world.vfx) {
    if (effect.kind !== "blast") {
      continue;
    }

    const life = Math.min(1, effect.age / effect.life);
    const distance = Math.max(1, Math.hypot(effect.x - world.player.x, effect.y - world.player.y));
    kick += (Math.sin(effect.age * 46) * 0.035 * (1 - life) ** 2) / distance;
  }

  return kick;
}

/**
 * The same kick, for weight rather than for explosions: heaving a body out of your hands, and a body
 * coming down near you. Kept to a tap, because this fires on every throw and every landing.
 */
function weightKick(world: World): number {
  return Math.sin(world.elapsedSeconds * 52) * world.shake * 0.014;
}

/**
 * A short downward hitch while a melee impact decays.
 *
 * Small on purpose: this fires on every connected swing, which in a room worth clearing is most of
 * the seconds the player is alive for.
 */
function meleeImpactPitch(impact: number): number {
  const strength = Math.max(0, Math.min(1, impact));
  return -Math.sin((1 - strength) * Math.PI) * strength * 0.011;
}

/**
 * The floor, drawn and played.
 *
 * Everything atmospheric is decided here and in `scene-lighting.ts`: the field of view, the light
 * list, the pixel grain, and the camera's own reactions. What this file no longer holds is a
 * lighting model — the first build had an ambient term, a point light and a tone curve, the judging
 * session found the result too dark and too cold, and the answer turned out to be that the shipped
 * renderer has no physical model to approximate. It has analytic formulas, and they are shaders now.
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

import { collectFloorDecals } from "./floor-decals";
import { buildFloorMeshes, triangleCount, type FloorMeshes } from "./floor-meshes";
import { buildSky, type Sky } from "./sky";
import { createSceneTextures, type SceneTextureSet } from "./scene-textures";
import { createWorldBodies, type WorldBodies } from "./world-bodies";
import { createWorldEffects, type WorldEffects } from "./world-effects";
import { createWorldStructures, type WorldStructures } from "./world-structures";
import { SceneLighting, type SceneLight } from "./scene-lighting";
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

/**
 * The torch the player carries, as an entry in the light list rather than as a renderer light.
 *
 * The distinction is most of this child. A real point light falls off with the square of distance
 * and blows out whatever is close; the list is read by the shipped renderer's own formula, which is
 * a gentle linear reach ending flat at its radius.
 */
const TORCH_RADIUS = 8.5;
const TORCH_COLOR: readonly [number, number, number] = [255, 176, 104];
const TORCH_INTENSITY = 1.35;

/**
 * How coarse the picture is, as a fraction of the CSS size.
 *
 * The shipped renderer halves its plane resolution on both axes, so the game's image carries a
 * visible grain a clean WebGL frame does not. Comparing a crisp render against a grainy one judges
 * the wrong thing, so the frame is drawn small and blown up with nearest-neighbour.
 */
const GRAIN_SCALE = 0.5;

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
  private readonly bodies: WorldBodies;
  private readonly camera: THREE.PerspectiveCamera;
  private disposed = false;
  private readonly effects: WorldEffects;
  private floor: FloorMeshes;
  private grain = true;
  private frameCount = 0;
  private readonly input = { forward: false, backward: false, strafeLeft: false, strafeRight: false };
  private lastFrameTime = performance.now();
  private metricsElapsed = 0;
  private paused = false;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;
  private readonly scene = new THREE.Scene();
  private readonly lighting = new SceneLighting();
  private readonly lights: SceneLight[] = [];
  private readonly sky: Sky;
  private readonly structures: WorldStructures;
  private readonly textures: SceneTextureSet;
  private readonly exitMarker: THREE.Mesh;
  private terrainVersion = -1;
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
    // No tone mapping, and its absence is deliberate: the shipped formulas clamp where they mean to,
    // and a curve laid over them would be a second opinion about the same pixels.
    this.renderer.domElement.className = "three-scene__canvas";
    this.viewport.append(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(VERTICAL_FOV_DEGREES, 1, 0.02, 400);
    this.camera.rotation.order = "YXZ";

    this.textures = createSceneTextures();
    this.sky = buildSky();
    this.scene.add(this.sky.root);
    // No scene fog either. Distance darkening lives inside each formula and is tinted per surface
    // class, so a fog laid over the top would darken the sky and the fittings along with the walls.

    this.world = createWorld(map, GAME_CATALOG);
    this.floor = buildFloorMeshes(this.world.maze, this.textures, this.lighting);
    this.terrainVersion = this.world.terrainVersion;
    this.scene.add(this.floor.root);

    this.bodies = createWorldBodies(this.lighting);
    this.structures = createWorldStructures(this.lighting);
    this.effects = createWorldEffects(this.lighting);
    this.scene.add(this.bodies.root, this.structures.root, this.effects.root);

    this.viewmodel = createViewmodel();
    this.viewport.append(this.viewmodel.overlay);
    this.viewmodel.setKind("authored");

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
  }

  /** Coarse or clean. Coarse is the default, because coarse is what the game looks like. */
  setGrain(enabled: boolean): void {
    this.grain = enabled;
    this.renderer.domElement.style.imageRendering = enabled ? "pixelated" : "auto";
    this.resize();
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
    this.floor = buildFloorMeshes(this.world.maze, this.textures, this.lighting);
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

  /**
   * This frame's light list: the torch first, then everything the floor's fittings are throwing.
   *
   * All of them, every frame. The first build could afford four because each was a real renderer
   * light costing a shader recompile and a pass over every fragment; these are four floats in a
   * uniform array read by a loop, so the limit is gone and with it the bodies that went dark as the
   * player walked away from a lamp.
   */
  private collectLights(elapsedSeconds: number): readonly SceneLight[] {
    this.lights.length = 0;
    const player = this.world.player;

    if (this.torchEnabled) {
      // The torch's own tremor: one fast term and one slow, so it never settles into a readable pulse.
      const flicker = 0.9 + Math.sin(elapsedSeconds * 11.3) * 0.06 + Math.sin(elapsedSeconds * 4.1) * 0.04;
      this.lights.push({
        x: player.x,
        y: player.y,
        radius: TORCH_RADIUS,
        intensity: TORCH_INTENSITY * flicker,
        color: TORCH_COLOR,
      });
    }

    for (const light of this.structures.lights(this.world, elapsedSeconds)) {
      this.lights.push({
        x: light.x,
        y: light.y,
        radius: light.radius,
        intensity: light.intensity,
        color: [(light.color >> 16) & 255, (light.color >> 8) & 255, light.color & 255],
      });
    }

    // What is currently dangerous also lights the room: a shell in the air, and an emplacement's
    // muzzle coming up to heat. Both are cues a player learns to read from the light alone.
    for (const hazard of this.world.hazards) {
      this.lights.push({ x: hazard.x, y: hazard.y, radius: 2.6, intensity: 0.8, color: [255, 96, 72] });
    }

    for (const mortar of this.world.mortars) {
      if (mortar.phase !== "locked") {
        continue;
      }

      this.lights.push({
        x: mortar.cellX + 0.5,
        y: mortar.cellY + 0.5,
        radius: 2.4,
        intensity: 0.9,
        color: [255, 138, 74],
      });
    }

    this.collectWindupLights(elapsedSeconds);
    this.collectVfxLights();
    return this.lights;
  }

  /**
   * The light a body throws while it is committed to something, one class per intent.
   *
   * Three lights rather than one in three colours, because the three say different things and want
   * different reach. A shot gathers inside the body and lights the ground it is standing on — enough
   * to catch the eye off to one side of the view without competing with the torch. A sword has a full
   * second to carry across a crowded room, so it pulses, on the same clock as the mark over its head
   * and the wedge on the ground. A charge is the loudest thing in the room besides the torch: it
   * holds still for three seconds, which is long enough to miss entirely, so it lights the walls and a
   * charge being stoked behind you becomes something the room tells you about.
   */
  private collectWindupLights(elapsedSeconds: number): void {
    for (const enemy of this.world.enemies) {
      if (enemy.windupSeconds <= 0) {
        continue;
      }

      const progress = 1 - enemy.windupSeconds / Math.max(0.0001, enemy.windupTotal);

      if (enemy.intent === "shoot") {
        this.lights.push({
          x: enemy.x,
          y: enemy.y,
          radius: 1.4 + progress * 1.1,
          intensity: 0.35 + progress * 0.75,
          color: [255, 108, 96],
        });
        continue;
      }

      if (enemy.intent === "melee") {
        this.lights.push({
          x: enemy.x,
          y: enemy.y,
          radius: 1.6 + progress * 1.8,
          intensity: (0.3 + progress * 1.05) * (0.88 + Math.sin(elapsedSeconds * (8 + progress * 16)) * 0.12),
          color: [255, 146, 112],
        });
        continue;
      }

      if (enemy.intent === "charge") {
        this.lights.push({
          x: enemy.x,
          y: enemy.y,
          radius: 2 + progress * 3,
          intensity: (0.4 + progress * 1.5) * (0.9 + Math.sin(elapsedSeconds * (7 + progress * 12)) * 0.1),
          color: [255, 96, 48],
        });
      }
    }
  }

  /** What a detonation and a lightning arc throw onto everything around them while they last. */
  private collectVfxLights(): void {
    for (const effect of this.world.vfx) {
      const life = Math.min(1, effect.age / effect.life);

      if (effect.kind === "blast") {
        this.lights.push({
          x: effect.x,
          y: effect.y,
          radius: effect.radius * (1.6 + life * 1.6),
          intensity: 1.6 * (1 - life),
          color: [255, 176, 84],
        });
        continue;
      }

      this.lights.push({
        x: (effect.fromX + effect.toX) / 2,
        y: (effect.fromY + effect.toY) / 2,
        radius: 3.4,
        intensity: 1.2 * (1 - life),
        color: [150, 214, 255],
      });
    }
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

    this.sky.root.position.set(player.x, 0, player.y);
    this.lighting.update(elapsed, this.collectLights(elapsed));
    this.lighting.updateDecals(collectFloorDecals(this.world));

    this.bodies.sync(this.world, elapsed, this.paused ? 0 : delta);
    this.structures.sync(this.world);
    this.effects.sync(this.world);
    this.viewmodel.sync(this.world);

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
    // The backing store is the small one; the element keeps its full CSS size and the browser
    // blows the pixels up. That is what makes the grain honest — the pixels really are that big.
    const scale = this.grain ? GRAIN_SCALE : 1;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(Math.round(width * scale), Math.round(height * scale), false);
    const element = this.renderer.domElement;
    element.style.width = "100%";
    element.style.height = "100%";
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // The arm is drawn at full size whatever the frame behind it is: it is a 2D layer over the
    // picture rather than part of it, exactly as the shipped one is.
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

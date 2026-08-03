/**
 * The floor, drawn.
 *
 * Everything atmospheric is decided here and in `scene-lighting.ts`: the field of view, the light
 * list, the pixel grain, and the camera's own reactions. What this file no longer holds is a
 * lighting model — the first build had an ambient term, a point light and a tone curve, the judging
 * session found the result too dark and too cold, and the answer turned out to be that the shipped
 * renderer has no physical model to approximate. It has analytic formulas, and they are shaders now.
 *
 * What it also no longer holds is the game. It once created a world, stepped it, read the keyboard
 * and drove itself off the frame clock, because a debug tool has nobody to hand those to. It is
 * handed a world and a time step now and draws them, which is the shape the play surface already
 * knows how to talk to — and it keeps no reference to that world between calls, because a second
 * authority over the same state is a bug that only shows up on the frame the two disagree.
 */

import * as THREE from "three";

import type { World } from "@/core/world";

import { createFinishingPass, type FinishingPass } from "./finishing-pass";
import { collectFloorDecals } from "./floor-decals";
import { buildFloorMeshes, triangleCount, type FloorMeshes } from "./floor-meshes";
import { createFloorStains, type FloorStains } from "./floor-stains";
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

/** Scratch for the screen projection, so asking where a point landed allocates nothing. */
const PROJECTED = new THREE.Vector3();

/** The colour the way down is picked out in once it opens, seen through whatever stands in front. */
const EXIT_MARKER_COLOR = 0x8affbe;

/**
 * What a frame needs that cannot be read off the world.
 *
 * Both are the caller's because both are properties of how the picture is being driven rather than of
 * what is being drawn: how much time this frame covers, and how hard the hands are turning the view.
 */
export type SceneFrame = Readonly<{
  /** Seconds to advance animation that runs on its own clock. Zero holds every such animation still. */
  deltaSeconds: number;
  /** How hard the view is turning, from nothing to a full-speed sweep, for the comfort vignette. */
  turnRate: number;
}>;

/** What the renderer cost to draw the last frame, for whoever is showing a diagnostic readout. */
export type SceneMetrics = Readonly<{ drawCalls: number; triangles: number }>;

/** Where a world point landed on screen, in the canvas's own pixels. */
export type ScenePoint = Readonly<{ screenX: number; screenY: number }>;

export class SceneRenderer {
  private readonly bodies: WorldBodies;
  private readonly camera: THREE.PerspectiveCamera;
  private disposed = false;
  private readonly effects: WorldEffects;
  private floor: FloorMeshes | undefined;
  private readonly floorStains: FloorStains;
  private grain = true;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;
  private readonly scene = new THREE.Scene();
  private readonly lighting = new SceneLighting();
  private readonly lights: SceneLight[] = [];
  private readonly sky: Sky;
  private readonly structures: WorldStructures;
  private readonly textures: SceneTextureSet;
  private readonly exitMarker: THREE.Mesh;
  private readonly finishing: FinishingPass;
  /** What the floor's geometry was built from, so it is rebuilt when the rules change either. */
  private terrainVersion = -1;
  private floorExtent = "";
  private torchEnabled = true;
  private readonly viewmodel: Viewmodel;

  constructor(private readonly viewport: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // No tone mapping, and its absence is deliberate: the shipped formulas clamp where they mean to,
    // and a curve laid over them would be a second opinion about the same pixels.
    this.renderer.domElement.className = "three-scene__canvas";
    this.viewport.append(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(VERTICAL_FOV_DEGREES, 1, 0.02, 400);
    this.camera.rotation.order = "YXZ";

    this.textures = createSceneTextures();
    this.floorStains = createFloorStains(this.textures.blood);
    this.sky = buildSky();
    this.scene.add(this.sky.root);
    // No scene fog either. Distance darkening lives inside each formula and is tinted per surface
    // class, so a fog laid over the top would darken the sky and the fittings along with the walls.

    this.bodies = createWorldBodies(this.lighting);
    this.structures = createWorldStructures(this.lighting);
    this.effects = createWorldEffects(this.lighting);
    this.scene.add(this.bodies.root, this.structures.root, this.effects.root);

    // Before the arm, so the arm is drawn over the grade and over the red a hit leaves — which is the
    // shipped stacking, where both happen inside the renderer and the viewmodel lands after it.
    this.finishing = createFinishingPass();
    this.viewport.append(this.finishing.overlay);

    this.viewmodel = createViewmodel();
    this.viewport.append(this.viewmodel.overlay);
    this.viewmodel.setKind("authored");

    this.exitMarker = createExitMarker();
    this.scene.add(this.exitMarker);

    // Nothing here reads a world, and nothing may: this is built before any world exists. The floor
    // arrives on the first render, keyed on what that world's own counters say it should be.
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.resize();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.resizeObserver.disconnect();
    this.bodies.dispose();
    this.structures.dispose();
    this.effects.dispose();
    this.finishing.dispose();
    this.viewmodel.dispose();
    this.exitMarker.geometry.dispose();
    (this.exitMarker.material as THREE.Material).dispose();
    this.floor?.dispose();
    this.floorStains.dispose();
    this.sky.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  get metrics(): SceneMetrics {
    return { drawCalls: this.renderer.info.render.calls, triangles: this.floor ? triangleCount(this.floor) : 0 };
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

  /**
   * Where a point in the world lands on screen, or nothing when it is behind the eye.
   *
   * Answered from the camera the last frame left in place, so a caller asks after rendering rather
   * than before. The one thing that wants this is the first-person layer, which aims the arc of a
   * swing at the point the swing actually reached.
   */
  project(point: Readonly<{ x: number; y: number; z: number }>): ScenePoint | undefined {
    PROJECTED.set(point.x, point.z, point.y).project(this.camera);

    if (PROJECTED.z > 1) {
      return undefined;
    }

    return {
      screenX: (PROJECTED.x * 0.5 + 0.5) * this.renderer.domElement.width,
      screenY: (-PROJECTED.y * 0.5 + 0.5) * this.renderer.domElement.height,
    };
  }

  /**
   * Draws one frame of a world somebody else owns and somebody else stepped.
   *
   * Nothing here writes to the world. Everything derived from it — the floor's geometry, the blood
   * grid, the light list, the marks on the ground — is read fresh or rebuilt against the world's own
   * version counters, so handing over a different world than last frame is answered correctly rather
   * than quietly.
   */
  render(world: World, frame: SceneFrame): void {
    if (this.disposed) {
      return;
    }

    this.syncStains(world);

    const extent = `${world.maze.width}x${world.maze.height}`;

    if (!this.floor || world.terrainVersion !== this.terrainVersion || extent !== this.floorExtent) {
      // A wall came down, a pool closed over, or this is a different floor entirely. Rebuilt whole,
      // because it takes about a millisecond and happens a dozen times a floor.
      this.rebuildFloor(world);
    }

    const player = world.player;
    const elapsed = world.elapsedSeconds;
    // Every camera hitch the rules raise, in the same terms the Canvas scene builder reads them: a
    // detonation nearby, the weight of something thrown or landed, and the tap of a connected swing.
    // Applied as a real pitch here rather than as the horizon shear a column raycaster is limited to.
    const kick = blastKick(world) + weightKick(world) + meleeImpactPitch(world.impact);
    this.camera.position.set(player.x, EYE_HEIGHT, player.y);
    this.camera.rotation.set(player.pitch + kick, -player.angle - Math.PI / 2, 0);

    this.sky.root.position.set(player.x, 0, player.y);
    this.lighting.update(elapsed, this.collectLights(world, elapsed));
    this.lighting.updateDecals(collectFloorDecals(world));

    this.bodies.sync(world, elapsed, frame.deltaSeconds);
    this.structures.sync(world);
    this.effects.sync(world);
    this.viewmodel.sync(world);

    this.finishing.draw({
      cameraAngle: player.angle,
      cameraX: player.x,
      cameraY: player.y,
      elapsedSeconds: elapsed,
      hitFlash: world.hitFlash,
      turnRate: frame.turnRate,
    });

    // The one thing on a floor still drawn through a wall, and only once the descent is unlocked.
    this.exitMarker.visible = world.maze.progress.main.met;
    this.exitMarker.position.set(world.maze.exit.x + 0.5, 1.2, world.maze.exit.y + 0.5);
    this.exitMarker.rotation.y = elapsed * 0.9;

    this.renderer.render(this.scene, this.camera);
  }

  private rebuildFloor(world: World): void {
    if (this.floor) {
      this.scene.remove(this.floor.root);
      this.floor.dispose();
    }

    this.floor = buildFloorMeshes(world.maze, this.textures, this.lighting);
    this.terrainVersion = world.terrainVersion;
    this.floorExtent = `${world.maze.width}x${world.maze.height}`;
    this.scene.add(this.floor.root);
  }

  /**
   * Brings the blood grid up to date, and re-points the floor at it when a new one was allocated.
   *
   * The re-pointing is the part that is easy to miss: descending builds a differently sized grid, and
   * a floor still holding the old texture would draw the previous floor's carnage on this one.
   */
  private syncStains(world: World): void {
    if (this.floorStains.sync(world)) {
      this.lighting.setStainGrid(this.floorStains.texture, this.floorStains.blood, world.maze.width, world.maze.height);
    }
  }

  /**
   * This frame's light list: the torch first, then everything the floor's fittings are throwing.
   *
   * All of them, every frame. The first build could afford four because each was a real renderer
   * light costing a shader recompile and a pass over every fragment; these are four floats in a
   * uniform array read by a loop, so the limit is gone and with it the bodies that went dark as the
   * player walked away from a lamp.
   */
  private collectLights(world: World, elapsedSeconds: number): readonly SceneLight[] {
    this.lights.length = 0;
    const player = world.player;

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

    for (const light of this.structures.lights(world, elapsedSeconds)) {
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
    for (const hazard of world.hazards) {
      this.lights.push({ x: hazard.x, y: hazard.y, radius: 2.6, intensity: 0.8, color: [255, 96, 72] });
    }

    for (const mortar of world.mortars) {
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

    this.collectWindupLights(world, elapsedSeconds);
    this.collectVfxLights(world);
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
  private collectWindupLights(world: World, elapsedSeconds: number): void {
    for (const enemy of world.enemies) {
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
  private collectVfxLights(world: World): void {
    for (const effect of world.vfx) {
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
    // The arm and the finishing pass are both drawn at full size whatever the frame behind them is:
    // they are 2D layers over the picture rather than part of it, exactly as the shipped ones are.
    this.finishing.resize(width, height);
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

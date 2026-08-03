/**
 * The floor, drawn and walked.
 *
 * Everything atmospheric in this experiment is decided here: the field of view, the fog, the torch,
 * and the night the two of them are read against. The numbers come from the Canvas scene builder
 * rather than from taste, because the question this child answers is whether the same floor under the
 * same light reads the same way through a different renderer.
 */

import * as THREE from "three";

import { blocksWalk, buildFloor, type Maze } from "@/core/maze";
import type { ResolvedMap } from "@/core/map-contract";

import { buildFloorMeshes, triangleCount, type FloorMeshes } from "./floor-meshes";
import { buildSky, type Sky } from "./sky";
import { createSceneTextures, type SceneTextureSet } from "./scene-textures";

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

const WALK_SPEED = 3.4;
const MOUSE_SENSITIVITY = 0.0026;
const MAX_PITCH = 1.45;
/** How close the walk is allowed to bring the eye to masonry, so a face is never clipped through. */
const BODY_RADIUS = 0.22;

export type SceneStatus = Readonly<{
  cell: string;
  fps: number;
  triangles: number;
  drawCalls: number;
}>;

type RuntimeCallbacks = Readonly<{
  onStatus(status: SceneStatus): void;
}>;

export class SceneRuntime {
  private animationFrame = 0;
  private readonly ambient: THREE.AmbientLight;
  private readonly camera: THREE.PerspectiveCamera;
  private disposed = false;
  private elapsed = 0;
  private floor: FloorMeshes;
  private frameCount = 0;
  private readonly held = new Set<string>();
  private lastFrameTime = performance.now();
  private maze: Maze;
  private metricsElapsed = 0;
  private pitch = 0;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;
  private readonly scene = new THREE.Scene();
  private readonly sky: Sky;
  private readonly textures: SceneTextureSet;
  private readonly torch: THREE.PointLight;
  private torchEnabled = true;
  private x = 0;
  private y = 0;
  private yaw = 0;
  /** The world-space heading, kept in the game's own convention so the two can be compared. */
  private angle = 0;

  constructor(
    private readonly viewport: HTMLElement,
    map: ResolvedMap,
    private readonly callbacks: RuntimeCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
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

    this.maze = buildFloor(map);
    this.floor = buildFloorMeshes(this.maze, this.textures);
    this.scene.add(this.floor.root);
    this.standAtEntrance();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.resize();
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.floor.dispose();
    this.sky.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Swaps the floor for another map's, keeping the textures — they are the same for every floor. */
  openMap(map: ResolvedMap): void {
    this.scene.remove(this.floor.root);
    this.floor.dispose();
    this.maze = buildFloor(map);
    this.floor = buildFloorMeshes(this.maze, this.textures);
    this.scene.add(this.floor.root);
    this.standAtEntrance();
  }

  setTorchEnabled(enabled: boolean): void {
    this.torchEnabled = enabled;
    this.torch.visible = enabled;
  }

  setFogEnabled(enabled: boolean): void {
    this.scene.fog = enabled ? new THREE.FogExp2(this.sky.horizonColor.getHex(), FOG_DENSITY) : null;

    for (const child of this.floor.root.children) {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        child.material.needsUpdate = true;
      }
    }
  }

  holdKey(key: string, held: boolean): void {
    if (held) {
      this.held.add(key);
      return;
    }

    this.held.delete(key);
  }

  releaseKeys(): void {
    this.held.clear();
  }

  look(movementX: number, movementY: number): void {
    const turned = this.angle + movementX * MOUSE_SENSITIVITY;
    this.angle = turned - Math.PI * 2 * Math.floor(turned / (Math.PI * 2));
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch - movementY * MOUSE_SENSITIVITY));
  }

  /**
   * Puts the walker where a run would arrive, facing whichever way sees furthest.
   *
   * The position is the game's own — the middle of the entrance cell. The heading is not, because the
   * game has no opening heading and an arbitrary one lands against masonry about as often as not: an
   * experiment whose first frame is a wall face at arm's length reads as a broken renderer for the
   * second it takes to turn around, and this one is opened to be looked at.
   */
  private standAtEntrance(): void {
    this.x = this.maze.entrance.x + 0.5;
    this.y = this.maze.entrance.y + 0.5;
    this.pitch = 0;

    let bestAngle = 0;
    let bestRun = -1;

    for (let step = 0; step < 32; step += 1) {
      const angle = (step / 32) * Math.PI * 2;
      const stepX = Math.cos(angle);
      const stepY = Math.sin(angle);
      let run = 0;

      while (run < 24 && !blocksWalk(this.maze, Math.floor(this.x + stepX * run), Math.floor(this.y + stepY * run))) {
        run += 0.5;
      }

      if (run > bestRun) {
        bestRun = run;
        bestAngle = angle;
      }
    }

    this.angle = bestAngle;
  }

  /** Whether the eye may stand here, given the body it is carried in. */
  private open(x: number, y: number): boolean {
    for (const [offsetX, offsetY] of [
      [-BODY_RADIUS, -BODY_RADIUS],
      [BODY_RADIUS, -BODY_RADIUS],
      [-BODY_RADIUS, BODY_RADIUS],
      [BODY_RADIUS, BODY_RADIUS],
    ] as const) {
      if (blocksWalk(this.maze, Math.floor(x + offsetX), Math.floor(y + offsetY))) {
        return false;
      }
    }

    return true;
  }

  /** Walks, sliding along whichever axis is still open so a corner does not stop the walker dead. */
  private step(seconds: number): void {
    const forward = (this.held.has("w") ? 1 : 0) - (this.held.has("s") ? 1 : 0);
    const strafe = (this.held.has("d") ? 1 : 0) - (this.held.has("a") ? 1 : 0);

    if (forward === 0 && strafe === 0) {
      return;
    }

    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    let moveX = cos * forward - sin * strafe;
    let moveY = sin * forward + cos * strafe;
    const length = Math.hypot(moveX, moveY);
    const pace = WALK_SPEED * seconds * (this.held.has("shift") ? 2.4 : 1);
    moveX = (moveX / length) * pace;
    moveY = (moveY / length) * pace;

    if (this.open(this.x + moveX, this.y)) {
      this.x += moveX;
    }

    if (this.open(this.x, this.y + moveY)) {
      this.y += moveY;
    }
  }

  private readonly frame = (time: number): void => {
    if (this.disposed) {
      return;
    }

    const delta = Math.min((time - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = time;
    this.elapsed += delta;
    this.step(delta);

    // The camera carries the world heading rather than the other way round, so the walk and the look
    // stay in the game's coordinates and only the last step converts into the scene's.
    this.yaw = -this.angle - Math.PI / 2;
    this.camera.position.set(this.x, EYE_HEIGHT, this.y);
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    // The same two-term flicker the scene builder gives the torch: one fast, one slow, so it never
    // settles into a readable pulse.
    const flicker = 0.9 + Math.sin(this.elapsed * 11.3) * 0.06 + Math.sin(this.elapsed * 4.1) * 0.04;
    this.torch.position.set(this.x, EYE_HEIGHT, this.y);
    this.torch.intensity = this.torchEnabled ? TORCH_INTENSITY * flicker * Math.PI : 0;
    this.sky.root.position.set(this.x, 0, this.y);

    this.renderer.render(this.scene, this.camera);

    this.frameCount += 1;
    this.metricsElapsed += delta;

    if (this.metricsElapsed >= 0.4) {
      this.callbacks.onStatus({
        cell: `${Math.floor(this.x)}, ${Math.floor(this.y)}`,
        drawCalls: this.renderer.info.render.calls,
        fps: Math.round(this.frameCount / this.metricsElapsed),
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
  }
}

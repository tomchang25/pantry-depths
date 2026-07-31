import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import blockUrl from "./assets/skeleton-blocky.glb?url";
import {
  ARC_CLIP,
  BAKE_CAMERA,
  BAKE_LIGHTS,
  bakeHeadingAngle,
  type BlockCellSize,
  type BlockClip,
  type BlockWeapon,
  HOLDING_CLIPS,
  HAND_BONE,
  WEAPON_BONE,
  WEAPON_CLIPS,
} from "./block-contracts";
import { SwingArc } from "./block-vfx";

export type BlockStatus = Readonly<{
  detail: string;
  normalizedTime: number;
  phase: string;
}>;

export type BlockMetrics = Readonly<{
  drawCalls: number;
  fps: number;
  triangles: number;
}>;

type RuntimeCallbacks = Readonly<{
  onMetrics(metrics: BlockMetrics): void;
  onReady(): void;
  onStatus(status: BlockStatus): void;
}>;

/** The stage is small because the body is: two units tall, and nothing else in the scene. */
const STAGE_RADIUS = 4;

/**
 * Everything the workbench renders: one full-size view for debugging and one strip for judging.
 *
 * The strip is the point. Every misjudgment this project has made about a body was made at
 * workbench distance — arms that measured correct and read as missing, proportions tuned against a
 * close camera and wrong at sprite size — so the surface that decides is the one that draws the
 * figure the size the game draws it, with the bake's own camera, and the big view is for finding
 * out why something looks wrong rather than whether it does.
 */
export class BlockRuntime {
  private animationFrame = 0;
  private arc = new SwingArc();
  private arcEnabled = true;
  private cellSize: BlockCellSize = 48;
  private clip: BlockClip = "idle";
  private readonly clips = new Map<string, THREE.AnimationClip>();
  private readonly controls: OrbitControls;
  private current: THREE.AnimationAction | undefined;
  private readonly fill: THREE.DirectionalLight;
  private disposed = false;
  private elapsed = 0;
  private frameCount = 0;
  private handBone: THREE.Object3D | undefined;
  private readonly key: THREE.DirectionalLight;
  private lastFrameTime = performance.now();
  private metricsElapsed = 0;
  private mixer: THREE.AnimationMixer | undefined;
  private pixelated = true;
  private playing = true;
  private readonly resizeObserver: ResizeObserver;
  private speed = 1;
  private readonly stripCameras: THREE.OrthographicCamera[] = [];
  private readonly stripRenderer: THREE.WebGLRenderer;
  private weapon: BlockWeapon = "sword";
  private readonly weaponParts = new Map<string, THREE.Object3D[]>();
  private weaponTip: THREE.Object3D | undefined;
  private readonly viewFill: THREE.Vector3;
  private readonly viewKey: THREE.Vector3;

  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.05, 40);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();

  constructor(
    private readonly viewport: HTMLElement,
    private readonly stripCanvas: HTMLCanvasElement,
    private readonly callbacks: RuntimeCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = "three-block__canvas";
    this.viewport.append(this.renderer.domElement);

    // No antialiasing on the strip, on purpose. A sprite is resolved at its cell size and then
    // scaled by nearest neighbour, so smoothing here would flatter the figure with an edge quality
    // the game will never composite.
    this.stripRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    this.stripRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this.stripRenderer.setScissorTest(true);
    this.stripCanvas.replaceWith(this.stripRenderer.domElement);
    this.stripRenderer.domElement.className = this.stripCanvas.className;

    this.scene.background = new THREE.Color(0x121017);
    this.camera.position.set(1.8, 1.6, 3.4);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxDistance = 12;
    this.controls.minDistance = 1.2;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(0, 0.95, 0);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(STAGE_RADIUS, 40),
      new THREE.MeshStandardMaterial({ color: 0x241d29, metalness: 0, roughness: 0.96 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;

    this.key = new THREE.DirectionalLight(0xffd9ab, 3.4);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.camera.far = 16;
    this.fill = new THREE.DirectionalLight(0x9fb4e0, 1.5);
    this.scene.add(new THREE.HemisphereLight(0xb7c8ea, 0x171119, 1.1), this.key, this.fill, floor, this.arc.root);
    this.aimLights(0);
    this.viewKey = this.key.position.clone();
    this.viewFill = this.fill.position.clone();

    for (let direction = 0; direction < BAKE_CAMERA.directions; direction += 1) {
      const half = BAKE_CAMERA.frameWidth / 2;
      const cell = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 30);
      const angle = bakeHeadingAngle(direction);
      cell.position.set(Math.cos(angle) * BAKE_CAMERA.radius, BAKE_CAMERA.height, Math.sin(angle) * BAKE_CAMERA.radius);
      cell.lookAt(0, BAKE_CAMERA.lookAt, 0);
      this.stripCameras.push(cell);
    }

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.resize();
    void this.load();
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.arc.dispose();
    this.mixer?.stopAllAction();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.stripRenderer.dispose();
    this.stripRenderer.domElement.remove();
  }

  availableClips(): readonly BlockClip[] {
    return WEAPON_CLIPS[this.weapon];
  }

  reset(): void {
    this.elapsed = 0;
    this.arc.clear();
    this.applyClip();
  }

  scrub(fraction: number): void {
    const duration = this.current?.getClip().duration ?? 0;
    this.elapsed = duration * fraction;
    this.arc.clear();
    this.sync();
  }

  setArcEnabled(enabled: boolean): void {
    this.arcEnabled = enabled;
    this.arc.root.visible = enabled;

    if (!enabled) {
      this.arc.clear();
    }
  }

  setCellSize(size: BlockCellSize): void {
    this.cellSize = size;
    this.resize();
  }

  setClip(clip: BlockClip): void {
    this.clip = clip;
    this.reset();
  }

  setPixelated(pixelated: boolean): void {
    this.pixelated = pixelated;
    this.resize();
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.lastFrameTime = performance.now();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  setWeapon(weapon: BlockWeapon): void {
    this.weapon = weapon;

    for (const [name, parts] of this.weaponParts) {
      for (const part of parts) {
        part.visible = name === weapon;
      }
    }

    if (!WEAPON_CLIPS[weapon].includes(this.clip)) {
      this.clip = WEAPON_CLIPS[weapon][0]!;
    }

    this.reset();
  }

  private applyClip(): void {
    const clip = this.clips.get(this.clip);

    if (!this.mixer || !clip) {
      return;
    }

    this.current?.stop();
    const action = this.mixer.clipAction(clip);
    action.reset();
    // A held clip parks on its last frame because the simulation decides how long a telegraph
    // lasts; looping one would answer that question here, in the wrong place.
    const holds = HOLDING_CLIPS.has(this.clip);
    action.setLoop(holds ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = holds;
    action.play();
    this.current = action;
    this.sync();
  }

  private async load(): Promise<void> {
    const gltf = await new GLTFLoader().loadAsync(blockUrl);
    // Half a turn: glTF is Y-up and Blender is Z-up, so the conversion sends the body's own forward
    // to −Z and an unturned import faces away from every camera in this scene.
    gltf.scene.rotation.y = Math.PI;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }

      const weapon = /^Weapon_([a-z]+)_/.exec(object.name)?.[1];

      if (weapon) {
        const parts = this.weaponParts.get(weapon) ?? [];
        parts.push(object);
        this.weaponParts.set(weapon, parts);
      }

      if (object.name === WEAPON_BONE) {
        this.weaponTip = object;
      }

      if (object.name === HAND_BONE) {
        this.handBone = object;
      }
    });

    for (const clip of gltf.animations) {
      this.clips.set(clip.name, clip);
    }

    this.scene.add(gltf.scene);
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    this.setWeapon(this.weapon);
    this.callbacks.onReady();
  }

  /** Put the mixer exactly on `elapsed`, which is what makes scrubbing and holding the same code. */
  private sync(): void {
    if (!this.mixer || !this.current) {
      return;
    }

    this.current.time = Math.min(this.elapsed, this.current.getClip().duration);
    this.mixer.update(0);
    this.scene.updateMatrixWorld(true);
  }

  private readonly frame = (time: number): void => {
    if (this.disposed) {
      return;
    }

    const realDelta = Math.min((time - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = time;
    const duration = this.current?.getClip().duration ?? 0;

    if (this.playing && this.current && duration > 0) {
      const delta = realDelta * this.speed;
      this.elapsed += delta;

      if (this.elapsed >= duration) {
        // A holding clip parks; a looping one wraps, and the arc is dropped either way so a smear
        // never survives into the next pass of the swing.
        this.elapsed = HOLDING_CLIPS.has(this.clip) ? duration : this.elapsed % duration;
        this.arc.clear();
      }

      this.sync();
    }

    this.updateArc();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.renderStrip();

    this.frameCount += 1;
    this.metricsElapsed += realDelta;

    if (this.metricsElapsed >= 0.4) {
      this.callbacks.onMetrics({
        drawCalls: this.renderer.info.render.calls,
        fps: Math.round(this.frameCount / this.metricsElapsed),
        triangles: this.renderer.info.render.triangles,
      });
      this.callbacks.onStatus({
        detail: duration > 0 ? `${this.elapsed.toFixed(2)}s of ${duration.toFixed(2)}s` : "no clip",
        normalizedTime: duration > 0 ? this.elapsed / duration : 0,
        phase: `${this.weapon} · ${this.clip}`,
      });
      this.metricsElapsed = 0;
      this.frameCount = 0;
    }

    this.animationFrame = requestAnimationFrame(this.frame);
  };

  private updateArc(): void {
    if (!this.arcEnabled || !this.weaponTip || !this.handBone) {
      return;
    }

    if (this.clip !== ARC_CLIP) {
      this.arc.clear();
      return;
    }

    this.arc.sample(
      this.handBone.getWorldPosition(new THREE.Vector3()),
      this.weaponTip.getWorldPosition(new THREE.Vector3()),
    );
  }

  /** Put the key and fill where the bake puts them for one heading. */
  private aimLights(direction: number): void {
    const angle = bakeHeadingAngle(direction);
    const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const sideways = new THREE.Vector3(-outward.z, 0, outward.x);

    for (const [light, spec] of [
      [this.key, BAKE_LIGHTS.key],
      [this.fill, BAKE_LIGHTS.fill],
    ] as const) {
      light.position.copy(outward).multiplyScalar(spec.outward).addScaledVector(sideways, spec.sideways).setY(spec.up);
      light.target.position.set(0, spec.lookAt, 0);
      light.target.updateMatrixWorld();
      light.updateMatrixWorld();
    }
  }

  private renderStrip(): void {
    const size = this.cellSize;

    for (let direction = 0; direction < this.stripCameras.length; direction += 1) {
      // Relit per cell, because the bake relights per direction. Without this, half the strip is a
      // flat silhouette and the body gets blamed for the strip's lighting.
      this.aimLights(direction);
      const x = direction * size;
      this.stripRenderer.setViewport(x, 0, size, size);
      this.stripRenderer.setScissor(x, 0, size, size);
      this.stripRenderer.render(this.scene, this.stripCameras[direction]!);
    }

    this.key.position.copy(this.viewKey);
    this.fill.position.copy(this.viewFill);
    this.key.target.position.set(0, 1, 0);
    this.key.target.updateMatrixWorld();
    this.key.updateMatrixWorld();
  }

  private resize(): void {
    const width = Math.max(1, this.viewport.clientWidth);
    const height = Math.max(1, this.viewport.clientHeight);
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // The strip's backing store is exactly eight cells wide and one tall; CSS blows it up. That is
    // what makes the pixelation toggle honest — the pixels really are that big.
    const size = this.cellSize;
    this.stripRenderer.setPixelRatio(1);
    this.stripRenderer.setSize(size * BAKE_CAMERA.directions, size, false);
    const element = this.stripRenderer.domElement;
    element.style.imageRendering = this.pixelated ? "pixelated" : "auto";
    element.style.width = "100%";
    element.style.height = "auto";
  }
}

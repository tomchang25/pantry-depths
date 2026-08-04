import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import blockUrl from "@/content/enemies/assets/skeleton-blocky.glb?url";
import { HOLDING_CLIPS, WEAPON_CLIPS, type BlockClip, type BlockWeapon } from "@/presentation/scene-3d/block-clips";
import { AFTER_THROW_CLIPS, ARC_CLIP, HAND_BONE, THROW_RELEASE, THROWN_WEAPONS, WEAPON_BONE } from "./block-contracts";
import { SwingArc } from "./block-vfx";
import { bisectPieces, burstPieces, Scatter } from "./destruction";

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

/** Roughly chest height on this rig, and where a burst is thrown from. */
const BODY_CENTRE = 1.08;

/**
 * One body on a turntable, lit from a fixed key and fill so a clip can be read frame by frame.
 *
 * It carried a second renderer beside this one until 2026-08-04: eight orthographic cameras
 * reproducing the sprite bake's own framing, so a figure could be judged at the size the game
 * composited it at. That went when the game stopped compositing sprites — the renderer draws this
 * armature directly now, so the question the strip answered is answered by standing the body on a
 * floor and looking at it, which is what the Placement Workbench is.
 */
export class BlockRuntime {
  private animationFrame = 0;
  private arc = new SwingArc();
  private arcEnabled = true;
  /** The armature's own bones, by name, and where freed ones fall. Empty until the rig has loaded. */
  private readonly bones = new Map<string, THREE.Object3D>();
  private readonly debris = new THREE.Group();
  private scatter: Scatter | undefined;
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
  private playing = true;
  private readonly resizeObserver: ResizeObserver;
  private speed = 1;
  private weapon: BlockWeapon = "sword";
  private readonly weaponParts = new Map<string, THREE.Object3D[]>();
  private weaponTip: THREE.Object3D | undefined;

  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.05, 40);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();

  constructor(
    private readonly viewport: HTMLElement,
    private readonly callbacks: RuntimeCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = "entity-workbench__canvas";
    this.viewport.append(this.renderer.domElement);

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
    this.scene.add(
      new THREE.HemisphereLight(0xb7c8ea, 0x171119, 1.1),
      this.key,
      this.fill,
      floor,
      this.arc.root,
      this.debris,
    );
    this.aimLights();

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
  }

  availableClips(): readonly BlockClip[] {
    return WEAPON_CLIPS[this.weapon];
  }

  reset(): void {
    this.restoreBody();
    this.elapsed = 0;
    this.arc.clear();
    this.applyClip();
  }

  /**
   * Take the body apart, either into its own bones or in half.
   *
   * The clip stops for the duration, because a mixer writing bone transforms every frame and a
   * physics step writing them too is two authorities over one number — and the one that would win is
   * whichever ran last, which is not a thing to leave to chance.
   */
  breakApart(mode: "burst" | "bisect"): void {
    if (this.scatter || this.bones.size === 0) {
      return;
    }

    this.arc.clear();
    this.current?.stop();
    this.scene.updateMatrixWorld(true);
    const origin = new THREE.Vector3(0, BODY_CENTRE, 0);
    const pieces = mode === "burst" ? burstPieces(this.bones) : bisectPieces(this.bones);
    this.scatter = new Scatter(pieces, this.debris, { dust: mode === "burst", origin, seed: 0x51ce });
  }

  /** Puts the body back together and hands the clip its bones again. */
  restoreBody(): void {
    if (!this.scatter) {
      return;
    }

    this.scatter.restore();
    this.scatter = undefined;
    this.applyClip();
  }

  isBroken(): boolean {
    return this.scatter !== undefined;
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

  setClip(clip: BlockClip): void {
    this.clip = clip;
    this.reset();
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
    this.updateWeaponVisibility();

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

      if (object instanceof THREE.Bone) {
        this.bones.set(object.name, object);
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

    if (this.scatter) {
      this.scatter.update(realDelta * this.speed);
    }

    if (!this.scatter && this.playing && this.current && duration > 0) {
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

    this.updateWeaponVisibility();
    this.updateArc();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    this.frameCount += 1;
    this.metricsElapsed += realDelta;

    if (this.metricsElapsed >= 0.4) {
      this.callbacks.onMetrics({
        drawCalls: this.renderer.info.render.calls,
        fps: Math.round(this.frameCount / this.metricsElapsed),
        triangles: this.renderer.info.render.triangles,
      });
      this.callbacks.onStatus({
        detail: this.scatter
          ? "in pieces"
          : duration > 0
            ? `${this.elapsed.toFixed(2)}s of ${duration.toFixed(2)}s`
            : "no clip",
        normalizedTime: duration > 0 ? this.elapsed / duration : 0,
        phase: this.scatter ? `${this.weapon} · broken` : `${this.weapon} · ${this.clip}`,
      });
      this.metricsElapsed = 0;
      this.frameCount = 0;
    }

    this.animationFrame = requestAnimationFrame(this.frame);
  };

  /**
   * Which weapon is in the hand this frame, and whether it is still there.
   *
   * A javelin leaves at the throw, so it is hidden from the release point of the strike onward
   * rather than for the whole clip: the wind-up and the first half of the throw are the frames that
   * say what the enemy is about to do, and a javelin that vanishes before it is thrown says
   * nothing.
   */
  private updateWeaponVisibility(): void {
    const duration = this.current?.getClip().duration ?? 0;
    const progress = duration > 0 ? this.elapsed / duration : 0;
    const thrown =
      THROWN_WEAPONS.has(this.weapon) &&
      ((this.clip === ARC_CLIP && progress >= THROW_RELEASE) || AFTER_THROW_CLIPS.has(this.clip));

    for (const [name, parts] of this.weaponParts) {
      const visible = name === this.weapon && !thrown;

      for (const part of parts) {
        part.visible = visible;
      }
    }
  }

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

  /**
   * A fixed key and fill, three-quarters on.
   *
   * Fixed is the point. This stage exists so two clips can be compared, and a light that travelled
   * with the figure would make every comparison partly a comparison of lighting.
   */
  private aimLights(): void {
    for (const [light, spec] of [
      [this.key, { x: 3.2, y: 4.4, z: 2.2, lookAt: 1.1 }],
      [this.fill, { x: -2.2, y: 2.7, z: -1.5, lookAt: 1.0 }],
    ] as const) {
      light.position.set(spec.x, spec.y, spec.z);
      light.target.position.set(0, spec.lookAt, 0);
      light.target.updateMatrixWorld();
      light.updateMatrixWorld();
    }
  }

  private resize(): void {
    const width = Math.max(1, this.viewport.clientWidth);
    const height = Math.max(1, this.viewport.clientHeight);
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

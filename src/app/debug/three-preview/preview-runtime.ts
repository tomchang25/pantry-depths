import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import type {
  PreviewDebugOptions,
  PreviewLightMode,
  PreviewPlayback,
  PreviewRendererMode,
  PreviewSceneId,
  PreviewShowcase,
  PreviewStatus,
} from "./preview-contracts";
import { createPreviewShowcase } from "./preview-showcases";

export type PreviewMetrics = Readonly<{
  drawCalls: number;
  fps: number;
  rendererHeight: number;
  rendererWidth: number;
  triangles: number;
}>;

type RuntimeCallbacks = Readonly<{
  onMetrics(metrics: PreviewMetrics): void;
  onScene(showcase: PreviewShowcase): void;
  onStatus(status: PreviewStatus): void;
}>;

/**
 * The stage every showcase gets unless it asks for more.
 *
 * The floor, the fog and the orbit ceiling were all sized for one body in the
 * middle of the disc. A showcase that lays fourteen out in a grid needs the
 * floor under them, the fog behind them and enough orbit distance to see the
 * back row, so the three move together from one number rather than a scene
 * being quietly half off the edge.
 */
const DEFAULT_STAGE_RADIUS = 9;

export class PreviewRuntime {
  private readonly ambient = new THREE.HemisphereLight(0xb7c8ea, 0x161019, 1.4);
  private animationFrame = 0;
  private completeDelay = 0;
  private readonly controls: OrbitControls;
  private debug: PreviewDebugOptions = { helpers: false, wireframe: false };
  private disposed = false;
  private frameCount = 0;
  private readonly floor: THREE.Mesh;
  private readonly grid = new THREE.GridHelper(14, 28, 0x6d597f, 0x332b3a);
  private lastFrameTime = performance.now();
  private metricsElapsed = 0;
  private playback: PreviewPlayback;
  private lightMode: PreviewLightMode = "dungeon";
  private rendererMode: PreviewRendererMode = "normal";
  private readonly resizeObserver: ResizeObserver;
  private showcase: PreviewShowcase;
  private stageRatio = 1;
  private readonly spot = new THREE.DirectionalLight(0xffd6a3, 4.2);

  readonly camera = new THREE.PerspectiveCamera(46, 1, 0.05, 80);
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();

  constructor(
    private readonly viewport: HTMLElement,
    private readonly callbacks: RuntimeCallbacks,
    initialScene: PreviewSceneId,
    reducedMotion: boolean,
  ) {
    this.playback = {
      autoReplay: !reducedMotion,
      playing: !reducedMotion,
      speed: 1,
    };
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.className = "three-preview__canvas";
    this.renderer.domElement.setAttribute("aria-label", "Interactive Three.js preview");
    this.viewport.append(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x100d15);
    this.scene.fog = new THREE.Fog(0x100d15, 10, 24);
    this.camera.position.set(6.6, 4.4, 8.2);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.maxDistance = 18;
    this.controls.minDistance = 3;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(0, 1.55, 0);

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x211b27,
      metalness: 0,
      roughness: 0.96,
    });
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(DEFAULT_STAGE_RADIUS, 48), floorMaterial);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.spot.position.set(-4.5, 8.5, 5.5);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.camera.near = 0.5;
    this.spot.shadow.camera.far = 24;
    this.grid.position.y = 0.012;
    this.grid.visible = false;
    this.scene.add(this.ambient, this.spot, this.floor, this.grid);

    this.showcase = createPreviewShowcase(initialScene);
    this.scene.add(this.showcase.root);
    this.showcase.setDebug(this.debug);
    this.applyStage(this.showcase);
    this.applyCameraPreset(this.showcase.id);
    this.callbacks.onScene(this.showcase);

    // Development-only handles, so a browser session can orbit the camera to a
    // named angle instead of dragging: judging a pose means seeing the same
    // body from more than one side, and a screenshot taken from wherever the
    // mouse left off is not comparable with the last one.
    (window as unknown as Record<string, unknown>).__previewCamera = this.camera;
    (window as unknown as Record<string, unknown>).__previewControls = this.controls;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.resize();
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.showcase.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  getPlayback(): PreviewPlayback {
    return this.playback;
  }

  reset(): void {
    this.completeDelay = 0;
    this.showcase.reset();
    this.showcase.setDebug(this.debug);
    // A reset rebuilds the scene, so anything the showcase measured about it is
    // measured again; the readout has to be re-read rather than left stale.
    this.callbacks.onScene(this.showcase);
    this.callbacks.onStatus(this.showcase.readStatus());
  }

  setAutoReplay(autoReplay: boolean): void {
    this.playback = { ...this.playback, autoReplay };
  }

  setDebug(options: PreviewDebugOptions): void {
    this.debug = options;
    this.grid.visible = options.helpers;
    this.showcase.setDebug(options);
  }

  setLightMode(mode: PreviewLightMode): void {
    this.lightMode = mode;
    if (mode === "neutral") {
      this.ambient.color.setHex(0xffffff);
      this.ambient.groundColor.setHex(0x5d6470);
      this.ambient.intensity = 2.25;
      this.spot.color.setHex(0xffffff);
      this.spot.intensity = 3.2;
    } else {
      this.ambient.color.setHex(0xb7c8ea);
      this.ambient.groundColor.setHex(0x161019);
      this.ambient.intensity = 1.4;
      this.spot.color.setHex(0xffd6a3);
      this.spot.intensity = 4.2;
    }
    this.applyAtmosphere();
  }

  /**
   * Background and fog together, because both depend on the light mode and on
   * how big the current stage is. Setting fog from the light mode alone is what
   * would drop a fourteen-body grid's back row into the dark the first time
   * somebody switched to neutral lighting.
   */
  private applyAtmosphere(): void {
    const colour = this.lightMode === "neutral" ? 0x343944 : 0x100d15;
    const near = this.lightMode === "neutral" ? 13 : 10;
    const far = this.lightMode === "neutral" ? 30 : 24;

    this.scene.background = new THREE.Color(colour);
    this.scene.fog = new THREE.Fog(colour, near * this.stageRatio, far * this.stageRatio);
  }

  setPlaying(playing: boolean): void {
    this.playback = { ...this.playback, playing };
    this.lastFrameTime = performance.now();
  }

  setRendererMode(mode: PreviewRendererMode): void {
    this.rendererMode = mode;
    this.renderer.domElement.classList.toggle("three-preview__canvas--pixelated", mode === "pixelated");
    this.resize();
  }

  setScene(id: PreviewSceneId): void {
    if (this.showcase.id === id) {
      this.reset();
      return;
    }
    this.showcase.dispose();
    this.showcase = createPreviewShowcase(id);
    this.scene.add(this.showcase.root);
    this.showcase.setDebug(this.debug);
    this.applyStage(this.showcase);
    this.applyCameraPreset(id);
    this.completeDelay = 0;
    this.callbacks.onScene(this.showcase);
    this.callbacks.onStatus(this.showcase.readStatus());
  }

  setPose(value: string): void {
    this.showcase.setPose?.(value);
    this.callbacks.onScene(this.showcase);
    this.callbacks.onStatus(this.showcase.readStatus());
  }

  setSpeed(speed: number): void {
    this.playback = { ...this.playback, speed };
  }

  private readonly frame = (time: number): void => {
    if (this.disposed) return;
    const realDelta = Math.min((time - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = time;
    const delta = this.playback.playing ? realDelta * this.playback.speed : 0;

    if (delta > 0) {
      this.showcase.update(delta);
      const status = this.showcase.readStatus();
      if (status.normalizedTime >= 1 && this.playback.autoReplay) {
        this.completeDelay += realDelta;
        if (this.completeDelay >= 0.8) this.reset();
      } else {
        this.completeDelay = 0;
      }
      this.callbacks.onStatus(this.showcase.readStatus());
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.frameCount += 1;
    this.metricsElapsed += realDelta;
    if (this.metricsElapsed >= 0.3) {
      const drawingBuffer = new THREE.Vector2();
      this.renderer.getDrawingBufferSize(drawingBuffer);
      this.callbacks.onMetrics({
        drawCalls: this.renderer.info.render.calls,
        fps: Math.round(this.frameCount / this.metricsElapsed),
        rendererHeight: drawingBuffer.y,
        rendererWidth: drawingBuffer.x,
        triangles: this.renderer.info.render.triangles,
      });
      this.metricsElapsed = 0;
      this.frameCount = 0;
    }

    this.animationFrame = requestAnimationFrame(this.frame);
  };

  private applyStage(showcase: PreviewShowcase): void {
    const radius = showcase.stageRadius ?? DEFAULT_STAGE_RADIUS;
    const ratio = radius / DEFAULT_STAGE_RADIUS;
    this.stageRatio = ratio;

    this.floor.scale.set(ratio, ratio, 1);
    this.grid.scale.setScalar(ratio);
    this.applyAtmosphere();
    this.controls.maxDistance = 18 * ratio;
    this.spot.position.set(-4.5 * ratio, 8.5 * ratio, 5.5 * ratio);
    this.spot.shadow.camera.far = 24 * ratio;
    this.spot.shadow.camera.left = -radius;
    this.spot.shadow.camera.right = radius;
    this.spot.shadow.camera.top = radius;
    this.spot.shadow.camera.bottom = -radius;
    this.spot.shadow.camera.updateProjectionMatrix();
  }

  private applyCameraPreset(id: PreviewSceneId): void {
    if (id === "sword-attack") {
      // Close, and framed on the guard rather than on the whole body. The arms
      // are thinner than the legs and the same colour as the ribs they cross,
      // so at a full-body distance a correctly solved arm is indistinguishable
      // from a rib — which is exactly the judgement this scene exists to make.
      this.camera.position.set(0, 2.75, 6.6);
      this.controls.target.set(0, 2.6, 0);
    } else if (id === "mortar") {
      this.camera.position.set(7.4, 4.8, 8.6);
      this.controls.target.set(0, 1.25, 0);
    } else if (id === "altar") {
      this.camera.position.set(4.3, 3.15, 5.1);
      this.controls.target.set(0, 1.2, 0);
    } else {
      this.camera.position.set(4.6, 3.35, 5.7);
      this.controls.target.set(0, 1.88, 0);
    }
    this.controls.update();
  }

  private resize(): void {
    const width = Math.max(1, this.viewport.clientWidth);
    const height = Math.max(1, this.viewport.clientHeight);
    const deviceRatio = window.devicePixelRatio || 1;
    const pixelRatio =
      this.rendererMode === "pixelated" ? Math.min(0.5, deviceRatio * 0.42) : Math.min(1.5, deviceRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

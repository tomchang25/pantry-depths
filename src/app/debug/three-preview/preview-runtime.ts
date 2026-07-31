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

export class PreviewRuntime {
  private readonly ambient = new THREE.HemisphereLight(0xb7c8ea, 0x161019, 1.4);
  private animationFrame = 0;
  private completeDelay = 0;
  private readonly controls: OrbitControls;
  private debug: PreviewDebugOptions = { helpers: false, wireframe: false };
  private disposed = false;
  private frameCount = 0;
  private readonly grid = new THREE.GridHelper(14, 28, 0x6d597f, 0x332b3a);
  private lastFrameTime = performance.now();
  private metricsElapsed = 0;
  private playback: PreviewPlayback;
  private rendererMode: PreviewRendererMode = "normal";
  private readonly resizeObserver: ResizeObserver;
  private showcase: PreviewShowcase;
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
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.spot.position.set(-4.5, 8.5, 5.5);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.camera.near = 0.5;
    this.spot.shadow.camera.far = 24;
    this.grid.position.y = 0.012;
    this.grid.visible = false;
    this.scene.add(this.ambient, this.spot, floor, this.grid);

    this.showcase = createPreviewShowcase(initialScene);
    this.scene.add(this.showcase.root);
    this.showcase.setDebug(this.debug);
    this.applyCameraPreset(this.showcase.id);
    this.callbacks.onScene(this.showcase);

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
    if (mode === "neutral") {
      this.scene.background = new THREE.Color(0x343944);
      this.scene.fog = new THREE.Fog(0x343944, 13, 30);
      this.ambient.color.setHex(0xffffff);
      this.ambient.groundColor.setHex(0x5d6470);
      this.ambient.intensity = 2.25;
      this.spot.color.setHex(0xffffff);
      this.spot.intensity = 3.2;
    } else {
      this.scene.background = new THREE.Color(0x100d15);
      this.scene.fog = new THREE.Fog(0x100d15, 10, 24);
      this.ambient.color.setHex(0xb7c8ea);
      this.ambient.groundColor.setHex(0x161019);
      this.ambient.intensity = 1.4;
      this.spot.color.setHex(0xffd6a3);
      this.spot.intensity = 4.2;
    }
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
    this.applyCameraPreset(id);
    this.completeDelay = 0;
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

  private applyCameraPreset(id: PreviewSceneId): void {
    if (id === "mortar") {
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

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import authoredUrl from "./assets/skeleton-swordsman-authored.glb?url";
import type { PreviewDebugOptions, PreviewPoseOption, PreviewReadout, PreviewStatus } from "./preview-contracts";
import { disposeObject, setObjectWireframe } from "./preview-utils";

/**
 * The hand-authored skeleton, loaded from the file Blender exported.
 *
 * Every other showcase here builds its body out of primitives in TypeScript, which is what a proof
 * of concept should do — it answers whether the runtime can carry a body without anybody having to
 * model one first. This one answers the question after that: whether a body somebody actually posed
 * survives the trip. Nothing in it is authored here. The mesh, the skeleton, the constraints' baked
 * result and the clip all come out of the `.blend`, and if a pose reads wrong on this page it reads
 * wrong because that is how it was posed.
 */

/** The clip is authored at 24 frames a second, and the plate's three guards sit on these frames. */
const CLIP_FPS = 24;
const GUARD_FRAMES: Readonly<Record<string, number>> = {
  middle: 1,
  high: 20,
  low: 30,
};

export class AuthoredSwordsmanShowcase {
  readonly description =
    "The skeleton as it was posed by hand in Blender, loaded from the exported file rather than rebuilt here. Play the chop, or hold any of its three guards.";
  readonly id = "authored-swordsman" as const;
  readonly poseOptions: readonly PreviewPoseOption[] = [
    { label: "Play the chop", value: "play" },
    { label: "Middle (frame 1)", value: "middle" },
    { label: "High (frame 20)", value: "high" },
    { label: "Low (frame 30)", value: "low" },
  ];
  readonly root = new THREE.Group();
  readonly title = "Authored Swordsman";

  private action: THREE.AnimationAction | undefined;
  private debug: PreviewDebugOptions = { helpers: false, wireframe: false };
  private duration = 0;
  private elapsed = 0;
  private failure: string | undefined;
  private helper: THREE.SkeletonHelper | undefined;
  private mixer: THREE.AnimationMixer | undefined;
  private pose = "play";
  private status: PreviewStatus = {
    detail: "reading the exported file",
    normalizedTime: 0,
    phase: "Loading",
    state: "loading",
  };

  constructor() {
    void this.load();
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    disposeObject(this.root);
    this.root.removeFromParent();
  }

  readStatus(): PreviewStatus {
    return this.status;
  }

  readReadout(): PreviewReadout | undefined {
    if (!this.action) {
      return undefined;
    }

    return {
      columns: ["Guard", "Frame", "Time"],
      notes: [
        this.failure ??
          "Loaded from Blender. Bones, skinning and the clip are the file's; nothing on this page re-poses them.",
        `Clip runs ${this.duration.toFixed(2)}s at ${CLIP_FPS} frames a second.`,
      ],
      rows: Object.entries(GUARD_FRAMES).map(([label, frame]) => ({
        cells: [String(frame), `${((frame - 1) / CLIP_FPS).toFixed(2)}s`],
        flagged: false,
        label,
        selected: this.pose === label,
      })),
      title: "Authored clip",
    };
  }

  reset(): void {
    this.elapsed = 0;
    this.applyPose();
  }

  setDebug(options: PreviewDebugOptions): void {
    this.debug = options;
    setObjectWireframe(this.root, options.wireframe);

    if (this.helper) {
      this.helper.visible = options.helpers;
    }
  }

  setPose(value: string): void {
    this.pose = value;
    this.elapsed = 0;
    this.applyPose();
  }

  update(deltaSeconds: number): void {
    if (!this.mixer || !this.action) {
      return;
    }

    if (this.pose === "play") {
      this.elapsed = this.duration > 0 ? (this.elapsed + deltaSeconds) % this.duration : 0;
      this.mixer.update(deltaSeconds);
    }

    const frame = Math.round(this.elapsed * CLIP_FPS) + 1;
    this.status = {
      detail: this.pose === "play" ? `frame ${frame}` : "held",
      normalizedTime: this.duration > 0 ? this.elapsed / this.duration : 0,
      phase: this.pose === "play" ? "Chop" : this.pose,
      state: this.pose === "play" ? "playing the authored clip" : "holding an authored guard",
    };
  }

  /**
   * Park the clip on one frame.
   *
   * Held by setting the mixer's time and stepping it by nothing, rather than by pausing playback:
   * a paused mixer holds whatever frame it stopped on, and what is wanted here is a named frame.
   */
  private applyPose(): void {
    if (!this.mixer || !this.action) {
      return;
    }

    const frame = GUARD_FRAMES[this.pose];
    this.action.paused = frame !== undefined;

    if (frame !== undefined) {
      this.action.time = (frame - 1) / CLIP_FPS;
      this.elapsed = this.action.time;
    } else {
      this.action.time = 0;
    }

    this.mixer.update(0);
  }

  private async load(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync(authoredUrl);
      const [clip] = gltf.animations;

      // Blender stands its bodies about two metres tall; every other scene here is built at roughly
      // twice that, and the stage, lights and camera are sized for those. Scaling on the way in
      // keeps one set of stage numbers rather than one per showcase.
      gltf.scene.scale.setScalar(2.05);
      // Half a turn, because glTF is Y-up and Blender is Z-up: the conversion sends the body's own
      // forward to −Z, so an unturned import faces away and shows the camera its shoulder blades
      // while both arms hide behind the ribs. Every other scene here faces +Z.
      gltf.scene.rotation.y = Math.PI;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.SkinnedMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });

      this.root.add(gltf.scene);
      this.helper = new THREE.SkeletonHelper(gltf.scene);
      const materials = Array.isArray(this.helper.material) ? this.helper.material : [this.helper.material];
      for (const material of materials) {
        material.depthTest = false;
        material.transparent = true;
        material.opacity = 0.72;
      }
      this.helper.visible = this.debug.helpers;
      this.root.add(this.helper);
      setObjectWireframe(this.root, this.debug.wireframe);

      if (!clip) {
        this.failure = "The exported file carries no animation; only its rest pose can be shown.";
        this.status = { detail: this.failure, normalizedTime: 0, phase: "Rest", state: "no clip in the file" };
        return;
      }

      this.mixer = new THREE.AnimationMixer(gltf.scene);
      this.action = this.mixer.clipAction(clip);
      this.duration = clip.duration;
      this.action.play();
      this.applyPose();
    } catch (error) {
      this.failure = error instanceof Error ? error.message : "The exported file could not be read.";
      this.status = { detail: this.failure, normalizedTime: 0, phase: "Failed", state: "load failed" };
    }
  }
}

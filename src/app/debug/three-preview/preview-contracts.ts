import type * as THREE from "three";

export const PREVIEW_SCENE_IDS = ["sword-attack", "skeleton-bisect", "bone-explosion", "altar", "mortar"] as const;

export type PreviewSceneId = (typeof PREVIEW_SCENE_IDS)[number];

export type PreviewDebugOptions = Readonly<{
  helpers: boolean;
  wireframe: boolean;
}>;

export type PreviewStatus = Readonly<{
  detail?: string;
  normalizedTime: number;
  phase: string;
  state: string;
}>;

export type PreviewShowcase = {
  readonly description: string;
  readonly id: PreviewSceneId;
  readonly root: THREE.Group;
  readonly title: string;
  dispose(): void;
  reset(): void;
  setDebug(options: PreviewDebugOptions): void;
  update(deltaSeconds: number): void;
  readStatus(): PreviewStatus;
};

export type PreviewPlayback = Readonly<{
  autoReplay: boolean;
  playing: boolean;
  speed: number;
}>;

export type PreviewRendererMode = "normal" | "pixelated";
export type PreviewLightMode = "dungeon" | "neutral";

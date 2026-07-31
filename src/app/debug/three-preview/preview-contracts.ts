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

export type PreviewReadoutRow = Readonly<{
  cells: readonly string[];
  /** The instrument found something wrong with this row; the shell marks it. */
  flagged: boolean;
  label: string;
  /** This row is the one currently on screen. */
  selected?: boolean;
}>;

/**
 * A table of measurements a showcase publishes for the sidebar.
 *
 * Optional on the contract because most showcases have nothing to measure — the
 * alternative was every scene carrying an empty table so that one of them could
 * carry a full one.
 */
export type PreviewReadout = Readonly<{
  columns: readonly string[];
  notes: readonly string[];
  rows: readonly PreviewReadoutRow[];
  title: string;
}>;

export type PreviewPoseOption = Readonly<{ label: string; value: string }>;

export type PreviewShowcase = {
  readonly description: string;
  readonly id: PreviewSceneId;
  /**
   * The poses this showcase can show one at a time.
   *
   * A scene that offers these shows exactly one of them; the shell puts a
   * picker beside the transport. Comparing fourteen bodies laid out in one
   * scene turned out to be the wrong instrument — depth rows occlude and
   * foreshorten each other, and nothing in the grid can be held against a
   * reference drawing.
   */
  readonly poseOptions?: readonly PreviewPoseOption[];
  readonly root: THREE.Group;
  /** How much floor, grid and fog this scene needs. Omitted means the runtime's default stage. */
  readonly stageRadius?: number;
  readonly title: string;
  dispose(): void;
  reset(): void;
  setDebug(options: PreviewDebugOptions): void;
  update(deltaSeconds: number): void;
  readStatus(): PreviewStatus;
  readReadout?(): PreviewReadout | undefined;
  setPose?(value: string): void;
};

export type PreviewPlayback = Readonly<{
  autoReplay: boolean;
  playing: boolean;
  speed: number;
}>;

export type PreviewRendererMode = "normal" | "pixelated";
export type PreviewLightMode = "dungeon" | "neutral";

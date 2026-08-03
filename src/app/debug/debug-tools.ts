import { mountSandboxExperiment } from "@/app/debug/sandbox-tool";

export type DebugToolRenderer = {
  render(mount: HTMLElement): void;
};

export type DebugTool = {
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly load: () => Promise<DebugToolRenderer>;
};

/** The single registry for future development tools. */
export const DEBUG_TOOLS: readonly DebugTool[] = [
  {
    id: "three-scene",
    path: "/debug/three-scene",
    title: "Three.js Floor",
    description:
      "Walk a real authored floor drawn with Three.js, and judge whether the masonry, the night sky, the fog and the torch survive the move off the raycaster.",
    load: () =>
      import("@/sandbox/three-scene/three-scene").then(({ THREE_SCENE_EXPERIMENT }) => ({
        render: mountSandboxExperiment(THREE_SCENE_EXPERIMENT),
      })),
  },
  {
    id: "three-block",
    path: "/debug/three-block",
    title: "Block Skeleton",
    description:
      "Judge a blocky enemy at sprite size: eight headings, the bake's own camera, and clips driven by numeric tables.",
    load: () =>
      import("@/sandbox/three-block/three-block").then(({ THREE_BLOCK_EXPERIMENT }) => ({
        render: mountSandboxExperiment(THREE_BLOCK_EXPERIMENT),
      })),
  },
  {
    id: "three-preview",
    path: "/debug/three-preview",
    title: "Three.js Preview",
    description:
      "Preview skeletal posing, destructive animation, procedural models, and ballistic effects in isolation.",
    load: () =>
      import("@/sandbox/three-preview/three-preview").then(({ THREE_PREVIEW_EXPERIMENT }) => ({
        render: mountSandboxExperiment(THREE_PREVIEW_EXPERIMENT),
      })),
  },
  {
    id: "entity-workbench",
    path: "/debug/entity-workbench",
    title: "Entity Workbench",
    description: "Scrub entity clips, reproduce death states, and tune authored display numbers.",
    load: () =>
      import("@/app/debug/entity-workbench").then(({ renderEntityWorkbench }) => ({
        render: renderEntityWorkbench,
      })),
  },
  {
    id: "hud-attack-workbench",
    path: "/debug/hud-attack-workbench",
    title: "HUD Workbench",
    description: "Tune pure HUD states and authored attacks against real dungeon renderer panels.",
    load: () =>
      import("@/app/debug/hud-attack-workbench").then(({ renderHudAttackWorkbench }) => ({
        render: renderHudAttackWorkbench,
      })),
  },
  {
    id: "sfx-workbench",
    path: "/debug/sfx-workbench",
    title: "SFX Workbench",
    description:
      "Play every cue through the real pipeline, tune loudness and pitch into the cue table, and record fit verdicts for the library feedback loop.",
    load: () =>
      import("@/app/debug/sfx-workbench").then(({ renderSfxWorkbench }) => ({
        render: renderSfxWorkbench,
      })),
  },
  {
    id: "map-workbench",
    path: "/debug/map-workbench",
    title: "Map Workbench",
    description:
      "Lay out a floor's slots, pool and draw, author the rooms it is built from, and watch the game's own assembler build both.",
    load: () =>
      import("@/app/debug/map-workbench").then(({ renderMapWorkbench }) => ({
        render: renderMapWorkbench,
      })),
  },
];

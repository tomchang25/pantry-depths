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
    id: "scene-index",
    path: "/debug/scene-index",
    title: "Scene Index",
    description:
      "Every address a development build opens the game at: the dressed scenes, the plain map testbeds, and ordinary play.",
    load: () =>
      import("@/app/debug/scene-index").then(({ renderSceneIndex }) => ({
        render: renderSceneIndex,
      })),
  },
  {
    id: "entity-workbench",
    path: "/debug/entity-workbench",
    title: "Entity Workbench",
    description:
      "One body on a turntable: every weapon, every clip, scrubbed frame by frame, and the two ways it comes apart.",
    load: () =>
      import("@/app/debug/entity-workbench/entity-workbench").then(({ renderEntityWorkbench }) => ({
        render: renderEntityWorkbench,
      })),
  },
  {
    id: "placement-workbench",
    path: "/debug/placement-workbench",
    title: "Placement Workbench",
    description:
      "How a body and a pickup sit on an authored floor, at the distance the game draws them — the surface the size, height and marker numbers are tuned against.",
    load: () =>
      import("@/app/debug/placement-workbench").then(({ renderPlacementWorkbench }) => ({
        render: renderPlacementWorkbench,
      })),
  },
  {
    id: "hud-workbench",
    path: "/debug/hud-workbench",
    title: "HUD Workbench",
    description: "Tune pure HUD states and authored attacks against real dungeon renderer panels.",
    load: () =>
      import("@/app/debug/hud-workbench").then(({ renderHudWorkbench }) => ({
        render: renderHudWorkbench,
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

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
    id: "three-block",
    path: "/debug/three-block",
    title: "Block Skeleton",
    description:
      "Judge a blocky enemy at sprite size: eight headings, the bake's own camera, and clips driven by numeric tables.",
    load: () =>
      import("@/app/debug/three-block/three-block").then(({ renderThreeBlock }) => ({
        render: renderThreeBlock,
      })),
  },
  {
    id: "three-preview",
    path: "/debug/three-preview",
    title: "Three.js Preview",
    description:
      "Preview skeletal posing, destructive animation, procedural models, and ballistic effects in isolation.",
    load: () =>
      import("@/app/debug/three-preview/three-preview").then(({ renderThreePreview }) => ({
        render: renderThreePreview,
      })),
  },
  {
    id: "entity-workbench",
    path: "/debug/entity-workbench",
    title: "Entity Workbench",
    description: "Scrub entity clips, reproduce death states, and author named wall or tile decor variants.",
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

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
    id: "combat",
    path: "/debug/combat",
    title: "Combat Explorer",
    description: "Inspect the authored combat cost matrix and a selected stage/enemy projection.",
    load: () =>
      import("@/app/debug/combat-explorer").then(({ renderCombatExplorer }) => ({
        render: renderCombatExplorer,
      })),
  },
  {
    id: "actions",
    path: "/debug/actions",
    title: "Action Viewer",
    description: "Step a real command scenario and inspect snapshots and semantic events.",
    load: () =>
      import("@/app/debug/action-viewer").then(({ renderActionViewer }) => ({
        render: renderActionViewer,
      })),
  },
];

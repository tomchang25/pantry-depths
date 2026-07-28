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
    id: "floor-workbench",
    path: "/debug/floor-workbench",
    title: "Floor Set Workbench",
    description: "Generate, edit, validate, preview, and explicitly save floor-set JSON in development.",
    load: () =>
      import("@/app/debug/floor-workbench").then(({ renderFloorWorkbench }) => ({
        render: renderFloorWorkbench,
      })),
  },
];

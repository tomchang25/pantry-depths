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
    id: "entity-workbench",
    path: "/debug/entity-workbench",
    title: "Entity Workbench",
    description: "Scrub every entity clip and reproduce carried, wall, barricade, and drowning deaths.",
    load: () =>
      import("@/app/debug/entity-workbench").then(({ renderEntityWorkbench }) => ({
        render: renderEntityWorkbench,
      })),
  },
  {
    id: "melee-viewmodel-lab",
    path: "/debug/melee-viewmodel-lab",
    title: "First-person Melee Viewmodel Lab",
    description: "Preview eight non-combo sword attacks with random and locked debug selection.",
    load: () =>
      import("@/app/debug/melee-viewmodel-lab").then(({ renderMeleeViewmodelLab }) => ({
        render: renderMeleeViewmodelLab,
      })),
  },
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

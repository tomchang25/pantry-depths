/**
 * Machine-enforced layering.
 *
 * These rules restate the import boundaries owned by
 * `dev/foundation/platforms/web-react/standards/project_structure_standard.md`
 * and the project's `dev/standards/project_structure.addendum.md`. Changing one
 * without the other leaves the repository with two disagreeing sources of truth.
 *
 * Layers that do not exist yet (`platform/`, `shared/`) are still declared here so
 * that earning one later starts from an enforced boundary rather than an open door.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "A runtime cycle makes module initialization order load-bearing.",
      from: {},
      to: { circular: true, dependencyTypesNot: ["type-only"] },
    },
    {
      name: "no-orphan-modules",
      severity: "warn",
      comment:
        "A module nothing imports is either dead or missing its registration. Two kinds of entry are exempt: the bootstrap, which index.html references through a script tag the cruiser cannot follow, and the offline tooling entrypoints directly under dev/tools/, which npm scripts and the development server invoke by path. The exemption stops at the entrypoint level, so an unreferenced tooling implementation module is still reported.",
      from: {
        orphan: true,
        pathNot: "\\.d\\.ts$|(^|/)vite-env\\.d\\.ts$|^src/app/main\\.ts$|^dev/tools/[^/]+\\.ts$",
      },
      to: {},
    },

    {
      name: "core-imports-only-core",
      severity: "error",
      comment:
        "src/core holds the deterministic rules: grid, turn resolution, the attack-minus-defense formula. It must never reach content, presentation, ui, or a DOM global.",
      from: { path: "^src/core/" },
      to: { path: "^src/", pathNot: "^src/core/" },
    },
    {
      name: "content-imports-only-content-and-core",
      severity: "error",
      comment: "Authored data (enemy table, door effects, baked floors) types itself through core contracts only.",
      from: { path: "^src/content/" },
      to: { path: "^src/", pathNot: "^src/(content|core)/" },
    },
    {
      name: "presentation-imports-only-presentation-content-core",
      severity: "error",
      comment: "The raycaster renders from core snapshots; it never drives them.",
      from: { path: "^src/presentation/" },
      to: { path: "^src/", pathNot: "^src/(presentation|content|core)/" },
    },
    {
      name: "platform-and-shared-are-leaves",
      severity: "error",
      comment: "Support layers must not depend on the layers that consume them.",
      from: { path: "^src/(platform|shared)/" },
      to: { path: "^src/", pathNot: "^src/(platform|shared)/" },
    },

    {
      name: "sandbox-imports-only-itself-content-core",
      severity: "error",
      comment:
        "A sandbox experiment (dev/standards/sandbox_track.md) is self-contained: it drives core and content and never reaches application composition, the demo, or another layer. Needing more is evidence the work is not sandbox-shaped.",
      from: { path: "^src/sandbox/" },
      to: { path: "^src/", pathNot: "^src/(sandbox|content|core)/" },
    },
    {
      name: "sandbox-experiments-do-not-cross-import",
      severity: "error",
      comment:
        "One experiment is one folder. A module two experiments want is a graduation candidate, not a sandbox commons.",
      from: { path: "^src/sandbox/([^/]+)/" },
      to: { path: "^src/sandbox/", pathNot: "^src/sandbox/$1/" },
    },
    {
      name: "only-the-debug-hub-imports-sandbox",
      severity: "error",
      comment:
        "Sandbox experiments are development-only and enter the application through one deferred debug catalog entry, so production exclusion is inherited from the debug route boundary. Graduation is a move out of the tree, never an import into it.",
      from: { path: "^src/", pathNot: "^src/(sandbox|app/debug)/" },
      to: { path: "^src/sandbox/" },
    },

    {
      name: "game-layer-does-not-import-tooling",
      severity: "error",
      comment:
        "Offline tooling is development-time only and reaches the filesystem and the process. The shipped module graph must never depend on it, so the call direction stays one-way: dev/tools imports src, never the reverse.",
      from: { path: "^src/" },
      to: { path: "^dev/" },
    },
    {
      name: "tooling-imports-only-its-measured-set",
      severity: "error",
      comment:
        "Offline tooling drives the rules and authored content, and it never reaches application composition, orchestration, or the DOM: a tool that needs those is a debug tool and belongs in src/app/debug.",
      from: { path: "^dev/tools/" },
      to: { path: "^src/", pathNot: "^src/(core|content)/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "\\.test\\.ts$" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default"] },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};

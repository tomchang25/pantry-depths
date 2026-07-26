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
        "src/core holds the deterministic rules: grid, turn resolution, the attack-minus-defense formula. It must never reach content, presentation, runtime, harness, ui, or a DOM global.",
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
      name: "runtime-does-not-import-ui-shared-or-app",
      severity: "error",
      from: { path: "^src/runtime/" },
      to: { path: "^src/(ui|shared|app)/" },
    },
    {
      name: "harness-imports-within-its-measured-set",
      severity: "error",
      comment: "Scenarios and the debug API drive core through runtime; they never render.",
      from: { path: "^src/harness/" },
      to: { path: "^src/", pathNot: "^src/(harness|core|content|runtime)/" },
    },
    {
      name: "ui-imports-within-its-measured-set",
      severity: "error",
      comment: "The HUD reaches capabilities through runtime, never by importing platform or app directly.",
      from: { path: "^src/ui/" },
      to: { path: "^src/", pathNot: "^src/(ui|core|content|runtime)/" },
    },
    {
      name: "only-app-imports-harness",
      severity: "error",
      comment:
        "Inside the game layer the bootstrap is the single harness wiring point, so the harness stays a seam and not a rule bypass. The offline tooling tree is the one sanctioned harness consumer outside it; see tooling-imports-only-its-measured-set.",
      from: { path: "^src/", pathNot: "^src/(app|harness)/" },
      to: { path: "^src/harness/" },
    },
    {
      name: "platform-and-shared-are-leaves",
      severity: "error",
      comment: "Support layers must not depend on the layers that consume them.",
      from: { path: "^src/(platform|shared)/" },
      to: { path: "^src/", pathNot: "^src/(platform|shared)/" },
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
        "Offline tooling drives the rules, authored content, and deterministic scenarios. It is the one sanctioned harness consumer outside src/app, and it never reaches application composition, orchestration, or the DOM: a tool that needs those is a debug tool and belongs in src/app/debug.",
      from: { path: "^dev/tools/" },
      to: { path: "^src/", pathNot: "^src/(core|content|harness)/" },
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

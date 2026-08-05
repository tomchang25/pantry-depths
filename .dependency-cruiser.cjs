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
        "src/core holds the rules: the contracts, the floor assembly, the world, the tick, and the minds. Authored tables reach it through the injected game catalog, never through an import — it must never reach content, presentation, ui, or a DOM global.",
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
      name: "runtime-imports-its-declared-set",
      severity: "error",
      comment:
        "src/runtime orchestrates: it runs the tick, drains the cue and picture queues, and mounts the interface. It may reach core, content, presentation, and ui (the declared no-React deviation - the frame loop pushes view models into the DOM interface directly), and nothing else.",
      from: { path: "^src/runtime/" },
      to: { path: "^src/", pathNot: "^src/(runtime|core|content|presentation|ui)/" },
    },
    {
      name: "only-the-app-imports-runtime",
      severity: "error",
      comment: "The route shell mounts the surface; nothing else drives the frame loop.",
      from: { path: "^src/", pathNot: "^src/(runtime|app)/" },
      to: { path: "^src/runtime/" },
    },
    {
      name: "ui-imports-only-ui-content-core",
      severity: "error",
      comment:
        "The plain-DOM interface renders models it is handed; it drives nothing and reaches no browser capability beyond its own DOM.",
      from: { path: "^src/ui/" },
      to: { path: "^src/", pathNot: "^src/(ui|content|core)/" },
    },
    {
      name: "only-runtime-and-app-import-ui",
      severity: "error",
      comment: "The interface is mounted by the surface (declared deviation) and by the workbenches that preview it.",
      from: { path: "^src/", pathNot: "^src/(ui|runtime|app)/" },
      to: { path: "^src/ui/" },
    },

    {
      name: "melee-decision-is-fenced",
      severity: "error",
      comment:
        "The player attack resolver decides from a snapshot and returns effects. It may reach its own folder, the attack vocabulary, the floor's queries and geometry, and the grid, and nothing else. The executor beside it is exempt: holding raw state on the slice's behalf is its job. Declared ahead of the directory, as the rules for layers not yet earned are.",
      from: { path: "^src/core/player/melee/", pathNot: "^src/core/player/melee/execute-melee\\.ts$" },
      to: {
        path: "^src/",
        pathNot: "^src/core/player/melee/|^src/core/combat/melee-contract|^src/core/floor/|^src/core/grid",
      },
    },
    {
      name: "enemy-behaviors-are-fenced",
      severity: "error",
      comment:
        "An attack family mutates its own narrow self and returns effects for everything else. It may reach its own folder, the enemy state vocabulary, the enemy contract, the floor's queries and geometry, and the grid.",
      from: { path: "^src/core/enemy/behaviors/" },
      to: {
        path: "^src/",
        pathNot:
          "^src/core/enemy/behaviors/|^src/core/enemy/enemy-state|^src/core/combat/enemy-contract|^src/core/floor/|^src/core/grid",
      },
    },
    {
      name: "decision-modules-never-reach-state-or-owners",
      severity: "error",
      comment:
        "The specific half of the two fences above, named separately so the failure says which wall was hit. Type-only imports included, because tsPreCompilationDeps is on: without that, the run state type would reach a decision module through a signature with no rule firing.",
      from: {
        path: "^src/core/(player/melee|enemy/behaviors)/",
        pathNot: "^src/core/player/melee/execute-melee\\.ts$",
      },
      to: { path: "^src/core/(world|damage|feedback|progression)/|^src/core/combat/particles" },
    },

    {
      name: "feedback-is-the-bottom-owner",
      severity: "error",
      comment:
        "Run feedback writes the presentation-feed fields on the state record. It sits under every other owner and reaches only the state module and the shared vocabularies at the root of the rules layer.",
      from: { path: "^src/core/feedback/" },
      to: { path: "^src/", pathNot: "^src/core/feedback/|^src/core/world/|^src/core/[^/]+\\.ts$" },
    },
    {
      name: "enemy-damage-owns-its-domain-alone",
      severity: "error",
      comment: "The enemy damage and death owner sits directly above feedback and composes no other owner.",
      from: { path: "^src/core/damage/enemy-damage\\.ts$" },
      to: { path: "^src/core/damage/", pathNot: "^src/core/damage/enemy-damage\\.ts$" },
    },
    {
      name: "structure-damage-owns-its-domain-alone",
      severity: "error",
      comment:
        "The structure damage owner sits beside enemy damage and composes no other owner. It lives in the damage tree rather than beside the floor so that the fenced decision modules may keep importing the floor's queries.",
      from: { path: "^src/core/damage/structure-damage\\.ts$" },
      to: { path: "^src/core/damage/", pathNot: "^src/core/damage/structure-damage\\.ts$" },
    },
    {
      name: "player-damage-composes-only-enemy-damage",
      severity: "error",
      comment:
        "A hit the held enemy absorbs is enemy damage and must keep its single writer, so player damage composes that one owner through a returned outcome. It reaches no other.",
      from: { path: "^src/core/damage/player-damage\\.ts$" },
      to: { path: "^src/core/damage/", pathNot: "^src/core/damage/(player-damage|enemy-damage)\\.ts$" },
    },
    {
      name: "owners-do-not-import-their-consumers",
      severity: "error",
      comment:
        "The owner stack is one-way. An owner that reached an executor would make the direction a cycle and put a second writer above the single one.",
      from: { path: "^src/core/(feedback|damage)/" },
      to: { path: "^src/core/(player|enemy|projectile|hazard)/|^src/core/world/step-world" },
    },
    {
      name: "the-compatibility-facade-is-for-outside-the-rules",
      severity: "error",
      comment:
        "The state module's facade exists so the layers outside this refactor keep their imports. A rules-layer module reaching it would launder the fences above through a re-export, so inside the rules every import names the concrete module.",
      from: { path: "^src/core/" },
      to: { path: "^src/core/world/index" },
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

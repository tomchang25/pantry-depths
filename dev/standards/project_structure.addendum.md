# Project Structure Addendum

Addendum to `dev/foundation/platforms/web-react/standards/project_structure_standard.md`. That standard remains the canonical owner of root vocabulary, source layer vocabulary, and import boundaries. This file records only the trees it does not name, feature-level placement detail, and the declared deviations.

## Entry Format

Every section below is a declaration. It states a tree, a deviation, or a boundary as fact, in the plain technical register the repository entry points require.

- State the rule directly. A why is at most one sentence, and only where the constraint is not self-evident.
- Record no history and no dates. Git owns how a rule came to be; a retired deviation is deleted in the change that retires it, not memorialized.
- For a machine-checked rule, state what is checked and which checker holds it; do not restate the checker's logic.
- Record nothing derivable from the code or a checker. A derivable description drifts, and a drifted description is believed.

## Declared Deviation: No React

Pantry Depths selects the `web-react` platform because it is the only Web platform axis the foundation offers. The project uses **no React and no UI framework**: the game is TypeScript rendered through Three.js, and the HUD is plain DOM.

Consequences:

- `src/ui/` is a plain-DOM layer: the HUD, its icon builder, and its stylesheet, rendering view models they are handed.
- With no reactive binding layer, the runtime pushes view models into the DOM interface directly, so `src/runtime/` imports `src/ui/` — a declared deviation from the platform rule that runtime never imports ui, machine-checked in `.dependency-cruiser.cjs`.
- These platform triggers never fire in this repository and reading them is not required: `react_component_standard.md`, `react_strict_mode_effects.md`, `browser_persistence_standard.md`, `indexeddb_upgrade_transactions.md`, `service_worker_cache_versioning.md`, and the service-worker and installability portions of `web_platform_standard.md`.
- V1 has no save system, no IndexedDB, no service worker, and no PWA manifest, so `public/` is omitted entirely.

Reintroducing React, persistence, or a service worker retires the corresponding bullet and restores its trigger.

## Declared Deviation: A Random Real-Time Core

The platform standard expects `src/core/` to own deterministic gameplay state. This core is a real-time, mutating tick that draws on global randomness and guarantees no replay. The screenshot harness seeds global randomness for reproducible captures. Making the tick injectable-random is a behaviour-affecting redesign; shipping it retires this deviation.

## Layer Status

The standard names `presentation/` and `shared/` as earned layers that are created only when the owning work exists. This table declares which layers exist and what each holds.

| Layer               | Directory | Status                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`          | Present   | Route boundary, bootstrap, the debug tool surface, and the development scene surface. The ordinary route mounts the game.                                                                                                                                                                                                                 |
| `src/core/`         | Present   | The rules, by domain: `damage/` and `feedback/` own the mutation stack; `player/` and `enemy/` hold the two decision hotspots behind their fences; `projectile/`, `hazard/`, `floor/`, `progression/` and `world/` hold the rest. Reads authored tables only through the injected game catalog. Roles and directions inside it are below. |
| `src/content/`      | Present   | Authored data by feature: maps, rooms, enemies, combat tables, sfx, presentation assets, viewmodel definitions.                                                                                                                                                                                                                           |
| `src/presentation/` | Present   | The audio stack, and the Three.js runtime in `scene-3d/` that draws the game.                                                                                                                                                                                                                                                             |
| `src/runtime/`      | Present   | The frame loop, input, mounting, the cue drain, the scene-hook seam, the development overlay, and map selection from the address.                                                                                                                                                                                                         |
| `src/ui/`           | Present   | The plain-DOM HUD, its icons, and its stylesheet — see the No React deviation above.                                                                                                                                                                                                                                                      |
| `src/platform/`     | Absent    | Not expected in V1. No persistence, desktop shell, or distribution API.                                                                                                                                                                                                                                                                   |
| `src/shared/`       | Absent    | Earned layer. Create only on demonstrated cross-feature ownership.                                                                                                                                                                                                                                                                        |

A scaffolded empty directory is not a claim that the layer is earned. It carries a `.gitkeep` and nothing else; the first real module in it still justifies the placement.

## Roles Inside The Rules Layer

The platform standard treats `src/core/` as one layer with one boundary. Inside it, three roles are told apart by path, and the boundary rules in `.dependency-cruiser.cjs` key on those paths. This section and that configuration are two halves of one contract; changing either alone leaves them disagreeing.

| Role               | Reads                       | Writes                                         | Reaches                                            |
| ------------------ | --------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| **Resolver**       | Its snapshot and view types | Nothing — it returns typed effects             | Its contract, floor queries and geometry, the grid |
| **Executor**       | Raw run state               | Through owners and feedback, by convention     | Owners, resolvers, contracts                       |
| **Mutation owner** | Raw run state               | Its own domain, as that domain's single writer | Owners strictly below it, feedback, state          |

Resolver and behavior purity, and the direction between owners, are machine-checked by the boundary rules. The executor discipline of writing only through owners is a reviewed convention backed by the access census below, not a wall.

**The owner stack is one-way.** Run feedback — sound cues, announcements, visual effects, stains, damage direction marks — is the bottom owner and a leaf: it declares the shapes of its own channels and takes only the narrow slice of the run it writes, so it depends on no module that depends on it. Enemy damage and structure damage sit above it and compose no other owner. Player damage composes exactly one owner, enemy damage — a hit the held enemy absorbs is enemy damage and keeps its single writer — and the composition runs through a returned outcome, not a shared field. The area-impact executor is the only module that composes all three. No owner imports sideways, upward, or into an executor.

The identity allocator is its own module because both the state record and the feedback owner hand out identities; an allocator living in either would make the other import upward.

**Two placement rules keep the stack one-way.** Every mutation owner lives under a tree the fenced decision modules cannot import — structure damage therefore lives in `src/core/damage/` rather than beside the floor it mutates, so the floor tree stays queries and geometry the fenced trees may import. Where one module mixes queries with its own mutators, the contract types close the gap an import rule cannot: every floor view a snapshot or behavior view carries is read-only-typed, and a mutating entry does not typecheck against it.

**The fenced trees** are `src/core/player/melee/` — excepting its executor, which holds raw state on the slice's behalf — and `src/core/enemy/behaviors/`. Neither may import run state, an owner, an executor, the particle field, or progression, type-only imports included.

**The compatibility facade** at `src/core/world/index.ts` serves the layers outside the rules — runtime, presentation, interface, app — and tests. No module inside `src/core/` may import it; a rules-layer import of the facade would launder the fences above through a re-export.

## The Raw-State Access Census

`dev/tools/check-ownership.mjs` counts, per source module, how many bindings take the whole run state and how many direct mutations are made through it: assignments and compound assignments on any state-rooted path, increments and decrements, and the mutating collection calls. `dev/standards/raw_world_allowlist.json` records the permitted counts, and the check fails on any increase or any counted module missing from the list. `npm run check:ownership` runs it as the first stage of `npm run verify`.

It is a census, not a boundary: the mutation count keys on the state parameter's ordinary name, so an alias assigned to a local escapes it. The hard limits stay on module paths and contract types; the one boundary the census holds outright is the fenced trees naming the state type at all.

An allowlist entry naming a module that no longer exists is reported, not failed — modules move while the ratchet tightens, and a stale entry marks work still to do.

If the census proves leaky, the named escalations are a deep-read-only state type, a mutation-port layer the executors write through, or a syntax-tree write checker. None is adopted.

Two paths are whole-state executors by decision: the projectile resolution and the enemy fire and emplacement cycle hold the whole run state and sit on the allowlist. Narrowing them to a snapshot-and-effect contract is scheduled work, tracked in `TODO.md`.

## One Renderer

`src/presentation/` holds one renderer: the Three.js runtime in `scene-3d/`. The procedural surfaces and artwork a renderer is tuned against belong to that renderer; a second renderer would arrive with its own, as a declared temporary duplication with a scheduled end, never as a commons.

## The Sandbox Tree

`src/sandbox/` is the sandbox track's source tree — `dev/standards/sandbox_track.md` owns what belongs on that track. It is declared here because the platform layer vocabulary does not name it. One experiment is one directory, `src/sandbox/<experiment>/`; files never sit directly under `src/sandbox/`. The directory is absent while no experiment exists; the rules below stay declared and machine-checked against the absent tree.

- **Development-only, entered through the debug hub.** An experiment gets one catalog entry in `src/app/debug/` whose deferred loader crosses into the experiment's folder, so it inherits the debug namespace's production exclusion. Nothing under `src/sandbox/` is production-reachable.
- **Import directions, machine-checked by the boundary rules:** an experiment imports its own folder, `src/core/`, and `src/content/`, and nothing else in `src/`. Nothing imports `src/sandbox/` except `src/app/debug/`. Experiments never import each other — a module two experiments want is a graduation candidate, not grounds for a sandbox commons.
- **Graduation is a move, never an in-place promotion.** An experiment that earns permanence moves into the layer that owns the behavior under the formal-track lifecycle, and its sandbox folder is deleted in the same change; the other ending is deleting the folder outright. The import boundary never opens so the rest of `src/` can reach into the sandbox.

## Declared Deviation: Development Namespaces Beyond `/debug`

The platform standard names one development namespace, `/debug`, and defines the production surface as everything that is not it. `src/app/debug/` follows the shared development-tool route surface without a routing deviation, and debug navigation uses native full-document anchors. Pantry declares two more namespaces, and they are not debug routes: `/soundstage` and `/testbed/<map name>` open the game itself. Pantry's ordinary route policy renders the game for every path that is not a development namespace, and for every path at all in a production build. No route reads a map query parameter in any build.

`src/app/scene/` is the development-only composition subtree behind the extra namespaces. A **scene** is the game at an address of its own with a session's worth of rules over it; the subtree holds the catalog of scenes plus one module of rules per scene. A **testbed** is the degenerate case with no rules: the address names a map and the floor is plain, which makes it the control group a dressed scene is read against.

- **The debug boundary's promises hold identically here.** Route selection is by pathname; the crossing into the subtree is one compile-time development guard plus a deferred import; a production request to any of these addresses follows the ordinary production route policy without loading a catalog or a scene. Nothing under `src/app/scene/` is production-reachable.
- **A scene is a play route, not a tool.** It mounts the same play surface the shipped game mounts, through the same lazy import — the play surface's stylesheet locks the document to the viewport and a debug tool's page scrolls, so a scene is entered by navigating to its address, never mounted inside a scrolling page. Scenes get no debug hub listing; the hub lists the scene index, a tool whose links are ordinary anchors that leave the debug document. The index renders from the scene catalog and the map library and states nothing of its own — a second place naming a scene is what the catalog exists to prevent.
- **A scene's rules reach the play surface as a value, never as a name.** The runtime declares the hook contract and calls it where its behaviour has a seam; `src/app/scene/` implements it. The runtime holds no scene vocabulary, and no layer identifies a scene by comparing a map name — scene identity is the address.
- **The word `sandbox` keeps one meaning:** the disposable-experiment track and its source tree. No `/sandbox` route exists; an experiment that wants a play scene registers under `/sandbox/<experiment>`, one namespace per experiment.

## Feature Placement Detail

- Maps and rooms are authored data, not code. They live in `src/content/maps/` and `src/content/rooms/` as JSON and are the only source of map geometry. No generator ships in `src/`; offline authoring algorithms belong in `dev/tools/`.
- Numeric records the design owns — player base stats, the four door effects, the enemy table, sprite `scale` and `anchorY` — live in `src/content/` and are not duplicated as literals inside `src/core/` or `src/presentation/`.
- Image assets exist in two trees with different lifetimes. The baked 512×512 runtime PNGs live under `src/content/**/assets/`, are imported through source so the bundler fingerprints them, and are version-controlled — they are the only copy the game or the repository depends on. The editable sources that bake them live in `/assets/` at the repository root, are never imported at runtime, and are deliberately outside version control: a working copy without them is correct, not missing files to restore. A change to runtime artwork therefore ships the baked PNG.
- Environment surfaces — walls, floor, ceiling — stay procedurally drawn and ship no image file. Enemies, world sprites, and stand-in placeholders are the exceptions that use images.

## Offline Tooling Ownership

`dev/tools/` is the offline tooling tree. A file directly under it is an executable entrypoint — a CLI, a process adapter, or a runner configuration; reusable implementation lives in a named subdirectory of it. Entry versus implementation is told by path, never by file size.

Placement inside the tree follows the same test as the source layers. Content schema and structural validation belong in `src/content/` and are imported, not reimplemented. What remains in `dev/tools/` is what no game layer may own: offline authoring algorithms that must not ship, artifact serialization, filesystem access, argument parsing, exit status, and development-server request handling.

Import directions, machine-checked by the boundary rules:

- `dev/tools/` imports `src/core/` and `src/content/` through the `@/` alias. It never imports `src/app/` or a renderer; a tool that needs those is a debug tool and belongs in `src/app/debug/`.
- `src/` never imports `dev/`. The shipped module graph must not depend on development-time tooling.

The development authoring endpoint namespace is declared once in the tooling tree. The workbench client keeps its own literal because client code must not import `dev/`; one unit test holds that copy equal to the declaration. Editor tasks invoke existing npm scripts and own no parameters, defaults, or behavior of their own — a prompt-driven flag surface belongs to the CLI or the workbench, not to a third entry point.

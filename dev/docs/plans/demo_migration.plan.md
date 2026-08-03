# Demo Migration

Move the demo out of its exempt tree and into the formal layer architecture, and retire the two-half ruling that exempted it.

## Goal

The demo won the direction gate and is now the game, but it lives in a tree that sits outside the layer vocabulary, outside every machine-checked import boundary, and outside the test discipline — a standing ruling forbids testing it at all. This plan moves its rules, tables, runtime, and interface into the layers that own them, deletes the turn-based model the demo replaced, and rewrites the two operation contracts that were written around the exemption, so that future work on the game is formal-track work by default.

## Requirements

1. Behaviour is preserved exactly at every step. No balance change, no feel change, no new feature rides along. Because the moved code has no tests yet, the only honest proof of preservation is a person playing it — every child that moves live modules ends in a playtest, not only the aggregate gate.
2. The turn-based model is removed entirely, in one child, before the demo's rules move in. Two combat truths in one repository — one live, one a remnant that types real modules — is how a reader (or an agent) builds on the dead one. The vocabulary the live render path genuinely uses survives; the rest goes.
3. At no point during the migration does any module sit outside a machine-enforced import boundary. The demo tree gets boundary rules describing its current reality before anything moves, so every subsequent move is a rule the checker watches tighten rather than a hole it cannot see.
4. Migrated code joins the normal test discipline: new unit tests exist only where a child's implementation spec named them beforehand, per the existing test operations contract. The demo-specific test ban retires with the surface that justified it; the sandbox track's rules and its machine guard are untouched.
5. The two operation contracts shaped around the exemption — the implement permissions and the test operations contract — are rewritten as coherent documents, not patched again. Both are load-bearing for the machine governance checker and for the sandbox track, so each rewrite lands in the same change as its checker and cross-reference updates.
6. The projection half — the scene builder, the sprite loader, the first-person viewmodel, and the particles — stays where it is. The chosen 3D runtime will replace most of it, and moving six thousand lines that are scheduled to die is work done twice. The interim tree is declared for what it is: a projection layer awaiting the renderer decision, with a boundary rule of its own.

## Design

### What moves where

The demo tree today holds five different kinds of module, and the migration is sorting them into the layers the platform structure standard already names.

| Role                                                                                                                                                              | Destination layer             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Rules and state: floor assembly, the world, the tick, enemy minds, player actions, impact resolution, extraction, tasks, room population, movement, the run clock | core                          |
| Numbers and catalogues: enemy statistics, throwable weights and behaviours, the blessing catalogue, the modifier axes, sealed-core rewards                        | content                       |
| The frame loop, input, mounting, and session dressing (the filming stage's switches)                                                                              | runtime (earned by this plan) |
| The HUD, its icons, and its stylesheet                                                                                                                            | ui (earned by this plan)      |
| The projection half: scene building, sprite loading, the viewmodel, particles                                                                                     | stays put, declared interim   |

Two of those destinations are earned layers this plan creates. The runtime layer is the structure standard's own vocabulary for orchestration between core and presentation, which is exactly what the frame loop is. The ui layer was declared omitted when the project declared its no-React deviation; the HUD earning it as a plain-DOM layer revises that declaration rather than contradicting it — the deviation was about React, not about owning an interface layer.

Every moved symbol keeps its name through the moves, `Demo` prefixes included. A dedicated rename child runs after the last move and renames them all in one pass, so each symbol is renamed exactly once, in its final home, and no diff mixes a move with a rename. The closing child then retires the institutions.

### The two contract inversions

Two import directions have to flip before the rules can live in core, and each is its own child because each is independently shippable and independently playtestable while the code still sits in the demo tree.

**The sound seam.** Six rules modules currently play sounds directly by calling the audio stack. Core may not reach presentation, so the inversion is the one the structure standard already prescribes: the rules emit semantic sound events as part of what a tick reports, and the surface that runs the tick resolves them into playback. The audible result must be identical — same cues, same moments, same rate limiting.

**The map contract.** Floor assembly currently imports its tile vocabulary, room shapes, and resolved-map contract from the content layer, which is upside down: the standard says content types itself through core contracts. The vocabulary and the contracts move to core; the content layer keeps discovery, parsing, and validation of the authored files, producing core-typed values; the runtime passes a resolved map into assembly. Which map a run opens, and the fallback for an unrecognised name, is runtime's question.

### What the rules keep

The tick is real-time, mutating, and random, and it stays that way. The platform standard expects core to be deterministic; this plan moves the rules in as they are and records the deviation in the structure addendum, because making the tick injectable-random is a behaviour-affecting redesign and this plan ships none. The screenshot harness already seeds global randomness for reproducible captures, and that continues to work unchanged.

The filming stage's identity stays a named map compared by string. The scene-routing question — whether a stage is a route of its own — is a recorded draft with three open questions, and answering it here would smuggle a product decision into a refactor.

### The test transition

The ban on testing the demo half exists because a test written against a moving real-time surface freezes its bugs as specification. The rules half stops being that surface the moment it lives in core behind the normal discipline: a new test still exists only when a spec named it first, so there is no reflex coverage wave. The machine guard that enforces the ban is kept alive until the final child — during the middle children it is still the thing preventing tests against the interim projection tree — and is deleted only when the contracts that reference it are rewritten. The sandbox budget guard is a different guard for a different track and does not change.

### Child overview

| #   | Child                       | Focus                                                                                         | Form                                                                                |
| --- | --------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Governance baseline         | Structure addendum corrections; boundary rules describing the demo tree as it is              | Shipped — `demo_migration_01_governance_baseline.implementation_spec.md` (archived) |
| 2   | Retire the turn-based model | Delete the old combat model and its tables; keep the vocabulary the live render path uses     | Shipped — `demo_migration_02_retire_turn_based.implementation_spec.md` (archived)   |
| 3   | Tables into content         | The pure-data halves of the enemy, throwing, blessing, modifier, and sealed catalogues        | Shipped — `demo_migration_03_tables_into_content.implementation_spec.md` (archived) |
| 4   | The sound seam              | Rules emit semantic cues; the surface plays them                                              | Shipped — `demo_migration_04_sound_seam.implementation_spec.md` (archived)          |
| 5   | The map contract            | Core owns the floor vocabulary and contracts; content produces values against them            | Execution below                                                                     |
| 6   | Rules into core             | The eleven rules modules move; boundary rules tighten to match                                | Execution below                                                                     |
| 7   | Runtime and interface       | The surface becomes the runtime layer; the HUD becomes the ui layer; workbench imports follow | Execution below                                                                     |
| 8   | The rename pass             | Every surviving `Demo`-prefixed symbol loses its prefix in one typecheck-verified change      | Execution below                                                                     |
| End | Child End                   | Guard deletion; both contract rewrites; checker sync; root entry points; tracker and history  | Execution below                                                                     |

Landing order is the table order. Children 2 and 3 could swap; nothing else can. Children 4 and 5 exist so that child 6 is a move rather than a move entangled with two redesigns.

## Non-Goals

1. No move of the projection half. The scene builder, sprite loader, viewmodel, and particles wait for the 3D runtime decision; migrating them now is work the renderer replacement would discard.
2. No behaviour, balance, content, or feel change of any kind.
3. No scene routing. The map query parameter, the stage's name comparison, and the address-bar shape all stay exactly as they are.
4. No enemy-record or tile-record consolidation. Both stay recorded drafts; this plan moves code between layers without reshaping it.
5. No deterministic or seeded tick. The randomness stays as it is, recorded as a declared deviation.
6. No new tests beyond those named in a child's spec, and no browser tests at all — the existing after-delivery proposal gate covers any future wish.

## Acceptance Criteria

1. After every child, the game plays identically to the commit before it, confirmed by a playtest covering that child's moved surface; and the aggregate verification gate and the governance check both pass.
2. After the final child, the demo tree contains only the projection half, and a boundary rule names exactly that tree and its allowed imports.
3. No module anywhere references the turn-based combat model; the one appearance vocabulary that survives it has a home that nothing turn-based owns.
4. The demo test guard is gone; the sandbox budget guard is unchanged; no test imports the interim projection tree.
5. Both rewritten operation contracts read as whole documents — no reference to a demo half remains anywhere in governance except history — and the machine governance checker passes against them in the same change.
6. The structure addendum's layer table matches the tree that actually exists, including the two newly earned layers and the declared interim projection tree.

---

## Execution

Perishable coordinates, recorded 2026-08-03 against `26210bd` (pre-closeout survey; re-verify against live code per child). Conflicts resolve in favour of the conceptual half.

### Child 5 — The map contract

- Today `src/demo/maze.ts` imports from `@/content/maps/map-resolver` (`ResolvedMap`), `@/content/maps/map-schema` (`validateDrawnFloor`, `validateDrawnWalk`, `strandedGround`, tile/room/cast types), `@/content/maps/room-schema`.
- Inversion: tile-kind, room-role, cast, crowd vocabulary and the resolved-map contract move under `src/core/`; `src/content/maps/` keeps JSON discovery (`map-library.ts`, `room-library.ts`), parsing, and validation, producing core-typed values. `src/demo/maps.ts` (default map + fallback) moves runtime-side in child 7; interim it may stay demo-side.
- Watch: the authoring endpoint and workbenches read these schemas (`dev/tools/authoring`, map/room workbenches); `dev/tools/` may import core and content, so the split must keep their imports legal.
- Verification: verify + a capture run or playtest on the shipped map plus one authored map.

### Child 6 — Rules into core

- Move into `src/core/`: `maze.ts` (1456), `world.ts` (1394), `simulation.ts` (1055), `enemy-ai.ts` (952), `actions.ts` (839), `impacts.ts` (440), `extraction.ts` (163), `tasks.ts` (118), `rooms.ts` (118), `movement.ts` (93), `run-level.ts` (37) — ≈6.7k lines — plus the behaviour halves left behind by child 3.
- Known residual edges to clear at spec time: `world.ts`/others importing `demo-sprites` asset ids (`DEMO_ASSET_IDS` believed scene-side only — re-verify), `particles.ts` (presentation-only per its own header; calls from rules become events or stay behind the seam), `demo-scene` back-references from `actions`/`impacts` if any.
- `.dependency-cruiser.cjs`: core rule already says core imports only core; the demo-tree rule shrinks to the projection half.
- Workbench importers of moved modules update in the same change (`entity-workbench` ← `simulation`/`world`/`enemy-archetypes`; `floor-preview`/`map-workbench`/`room-workbench` ← `world`/`maze`).
- Unit tests: named in the spec preview per the standing gate. Strong candidates: floor-assembly refusals, damage/throw arithmetic, task state, run-level derivation. Nothing is added that the spec did not name.
- Verification: verify + the plan's heaviest playtest — full floor loop, every enemy kind, throws, water, stage, extraction.

### Child 7 — Runtime and interface

- `src/runtime/` earned: `demo-surface.ts` (1197) split into frame loop, input, and mount/dispose; `stage.ts` (142) moves beside it with its `map.name === "stage"` comparison intact (harness is not an option: only app may import harness, and the surface calls `dressStage` at mount and restart); `maps.ts` default-map choice lands here.
- `src/ui/` earned: `demo-hud.ts` (598) + `demo.css` (1508) + `hud-icons.ts` (143). `demo-dev-overlay.ts` (151) is a development instrument mounted by the surface — spec decides runtime-side dev-guarded vs app/debug.
- `src/app/main.ts` wiring and all 8 workbench imports updated; structure addendum's ui/runtime rows and the no-React deviation text rewritten here (flagged in child 1).
- Verification: verify + playtest (input feel, HUD, dev overlay, stage keys, restart).

### Child 8 — The rename pass

- Every `Demo`-prefixed symbol that survived the moves loses the prefix in one mechanical, typecheck-verified change — the content-side vocabulary from child 3 (`DemoThrowWeight`, `DemoPropBehaviour`, `DemoEnemyArchetype`, and the rest), and the run-side types the later children moved (`DemoWorld`, `DemoCell`, `DemoInput`, the HUD model types). Redundant aliases dissolve into their sources (`DemoPropKind` → `PropKind`, `DemoArchetypeId` → `MapCastKind` or a rename of that source; decided at spec time). Renaming waits for this child so every symbol is renamed exactly once, in its final home.
- Runs after the last move and before Child End; verification is `npm run verify` — a rename that changes no behaviour needs no playtest of its own.

### Child End

- Delete `test/unit/repository/demo-half-is-untested.test.ts` (guard bans string imports `@/demo/`, `@/presentation/`; frozen exemption is the image-loader test).
- Rewrite `dev/agent_rules/test_operations.md`: two surfaces (formal, sandbox); "Looking Is Not Testing", capture harness, browser-acceptance scope, and reporting sections survive with the demo references rewritten; the ban's history paragraph moves to history, not deleted from memory.
- Rewrite `dev/agent_rules/implement_operations.md` as one coherent document: keep sandbox light ceremony, the second-confirmation bypass, standing plan authorization, sandbox-approval-as-authorization, `/goal`; drop the demo half.
- Machine couplings that must move in the same change: `dev/tools/check_governance.py` CONTRACTS pins strings in both files ("Explicit Second-Confirmation Bypass", "Phase 1 target confirmation remains mandatory", "Executing A Goal-Executable Plan End To End", `commands/implement.md`); `dev/standards/sandbox_track.md` and `.claude/commands/goal.md` route to `implement_operations.md`.
- Root entry points: `CLAUDE.md` and `AGENTS.md` carry a "Never test the demo" section — rewritten to the new truth.
- `TODO.md`: this plan's Active line removed at closeout; `CHANGELOG.md` records the outcome.
- Verification: `npm run verify` + `npm run check:governance`; both reported separately.

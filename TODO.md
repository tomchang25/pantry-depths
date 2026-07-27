# TODO

The single forward-work tracker for Pantry Depths. Shipped outcomes move to `CHANGELOG.md`.

Plan children get no lines here. They live in their plan's child overview table, per `dev/foundation/core/workflows/plan_standard.md`. This file tracks only work that no plan owns.

---

## Active

Nothing currently in progress.

---

## Queued

### V1 prototype milestone

[`dev/docs/plans/pantry_depths_v1.mega_plan.md`](dev/docs/plans/pantry_depths_v1.mega_plan.md) — the whole game, in four critical-path delivery plans and two optional tooling and content plans.

| Stream | Scope                                                                             |   Children | State                                                         |
| ------ | --------------------------------------------------------------------------------- | ---------: | ------------------------------------------------------------- |
| A      | Rules and Content                                                                 |          7 | Shipped                                                       |
| B      | Presentation Port                                                                 |          1 | Shipped; renderer parity and reduced-motion evidence deferred |
| C      | [Feel and Endgame](dev/docs/plans/pantry_feel.plan.md)                            |          4 | Queued                                                        |
| D      | [Final Floor Design](dev/docs/plans/pantry_floor_design.plan.md)                  |          1 | Queued after Presentation Port                                |
| T      | Debug Surface Shell                                                               | standalone | Shipped; shared debug presentation foundation                 |
| P      | Authoring Workbench UX                                                            |          4 | Shipped; direct floor authoring and generator totals          |
| Q      | [Scene Authoring and Live Preview](dev/docs/plans/pantry_scene_authoring.plan.md) |          6 | Queued; preview children need the renderer                    |

The Presentation Port has shipped, so the V1 critical-path next action is `pantry_feel_01`; it also inherits the first chance to exercise the renderer's semantic-event feedback, which no caller has driven yet. Scene Authoring and Live Preview is available in parallel, and its preview children are now unblocked.

### Standalone sketches

Direction chosen, no plan owns the area. Each becomes actionable through `/implement`, which rewrites it into a standalone implementation spec.

- [Player screen layer](dev/docs/plans/pantry_player_screen_layer.sketch.md) — make the held torch and sword, the attack slash, the torch flame, and the damage flash authored values instead of constants inside the renderer. Screen-space only, so it stays out of the scene authoring plan's placed-camera preview; the open shape question is what each value should be a fraction of.
- [Cross-floor locks](dev/docs/plans/pantry_cross_floor_locks.sketch.md) — let the generator place a key on one floor and the door it opens on a later one. Runtime and the validator already support it; the generator's per-floor construction guarantee does not. The generator allocation layer it builds on has now shipped, so nothing blocks it.
- [Cross-floor entity move](dev/docs/plans/pantry_cross_floor_entity_move.sketch.md) — let the Workbench move a gameplay entity to another floor instead of forcing delete-and-recreate. The two-click move mode already survives a floor switch; the authoring mutation resolves the entity against the destination floor and refuses.

---

## Draft

Not scheduled. Do not start without a decision.

- White and black keys, widening the palette beyond the current three colours. Blocked on a product decision, not on implementation: the design document's section 八 binds red, blue, and yellow to passage, attack, and defence, while additional colours have no assigned meaning. The shipped authoring workbench and generator deliberately expose only the three existing colours, so widening the palette is a content-contract change, not a tooling change.
- Browser acceptance coverage for gameplay. `test/e2e/` now covers the development console only — the parts of `src/app/debug/` that a DOM-less unit environment cannot observe. Presentation, input feel, VFX, and audio remain deliberate manual-playtest boundaries; `dev/agent_rules/test_operations.md` owns that scope line.
- A jsdom component layer — `jsdom` plus `@testing-library/dom`, no React — between unit and browser. Not earned today: `src/ui/` is empty, every DOM module in the tree is a dev-only debug tool, and those tools' pure logic is already extracted and unit-covered. It becomes a real decision when `pantry_feel_01`/`_02` land the HUD, because that DOM ships to players and the feel plan's acceptance criteria 3 and 6 — required information without relying on colour alone, keyboard reachable and semantically labelled — are semantic assertions that belong below the browser layer, not in a manual playtest.
- Promote the mega plan shape into game-devkit as `mega_plan_standard.md`. The foundation has no mega-plan contract today; this project is its trial run. See mega plan §8 items 5 and 6.

Playtest-driven balance questions live in mega plan §8, not here — they are product decisions against `src/content/`, not forward work.

---

## Infrastructure Debt

- [ ] `src/app/main.ts` is a placeholder that only writes text into `#app`. `pantry_rules_01` establishes the debug/ordinary-play dispatch; `pantry_feel_01` replaces the ordinary-play placeholder with the runtime.
- [ ] `dev/docs/reports/pantry_depths_architecture.html` is still a skeleton. It is hand-written and filled in at milestone closeout. The balance report is generated as of `pantry_rules_05`.

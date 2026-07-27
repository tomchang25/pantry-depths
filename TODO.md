# TODO

The single forward-work tracker for Pantry Depths. Shipped outcomes move to `CHANGELOG.md`.

Plan children get no lines here. They live in their plan's child overview table, per `dev/foundation/core/workflows/plan_standard.md`. This file tracks only work that no plan owns.

---

## Active

[Authoring Workbench UX](dev/docs/plans/pantry_authoring.plan.md) — active parent plan; `pantry_authoring_01`, the shared Debug Surface Shell, `pantry_authoring_02`, and `pantry_authoring_03` have landed, and `pantry_authoring_04` is next.

---

## Queued

### V1 prototype milestone

[`dev/docs/plans/pantry_depths_v1.mega_plan.md`](dev/docs/plans/pantry_depths_v1.mega_plan.md) — the whole game, in four critical-path delivery plans, one parallel asset item, and two optional tooling and content plans.

| Stream | Scope                                                                 |   Children | State                                              |
| ------ | --------------------------------------------------------------------- | ---------: | -------------------------------------------------- |
| A      | Rules and Content                                                     |          7 | Shipped                                            |
| B      | [Presentation Port](dev/docs/plans/pantry_presentation.plan.md)       |          2 | Queued                                             |
| C      | [Feel and Endgame](dev/docs/plans/pantry_feel.plan.md)                |          4 | Queued                                             |
| D      | [Final Floor Design](dev/docs/plans/pantry_floor_design.plan.md)      |          1 | Queued after Presentation Port                     |
| S      | Enemy Sprite Art                                                      |   parallel | Parallel asset deliverable; style spec not written |
| T      | Debug Surface Shell                                                   | standalone | Shipped; shared debug presentation foundation      |
| P      | [Authoring Workbench UX](dev/docs/plans/pantry_authoring.plan.md)     |          4 | Active; `01`–`03` landed, `04` is next             |
| Q      | [Composite Environment Presets](dev/docs/plans/pantry_preset.plan.md) |          3 | Queued after `pantry_authoring_04`                 |

Current optional-tooling work is the remaining Authoring Workbench child. The V1 critical-path next action remains `/implement pantry_presentation_01`.

### Standalone sketches

Direction chosen, no plan owns the area. Each becomes actionable through `/implement`, which rewrites it into a standalone implementation spec.

- [Start and end markers](dev/docs/plans/pantry_start_and_end_markers.sketch.md) — make the spawn position and the run-completion condition authored markers instead of a fixed corner and one enemy's identity. The completion half is a product decision the design document owns and overlaps the feel plan's ending sequence; settle that before writing a spec.
- [Cross-floor locks](dev/docs/plans/pantry_cross_floor_locks.sketch.md) — let the generator place a key on one floor and the door it opens on a later one. Runtime and the validator already support it; the generator's per-floor construction guarantee does not. Depends on the allocation layer `pantry_authoring_04` introduces.

---

## Draft

Not scheduled. Do not start without a decision.

- White and black keys, widening the palette beyond the current three colours. Blocked on a product decision, not on implementation: the design document's section 八 binds red, blue, and yellow to passage, attack, and defence, while additional colours have no assigned meaning. This future content/gameplay expansion is outside the active authoring plan.
- Browser acceptance coverage. Deliberately absent from V1; `dev/agent_rules/test_operations.md` records it as a standing gap.
- Promote the mega plan shape into game-devkit as `mega_plan_standard.md`. The foundation has no mega-plan contract today; this project is its trial run. See mega plan §8 items 5 and 6.

Playtest-driven balance questions live in mega plan §8, not here — they are product decisions against `src/content/`, not forward work.

---

## Infrastructure Debt

- [ ] `src/app/main.ts` is a placeholder that only writes text into `#app`. `pantry_rules_01` establishes the debug/ordinary-play dispatch; `pantry_feel_01` replaces the ordinary-play placeholder with the runtime.
- [ ] `dev/docs/reports/pantry_depths_architecture.html` is still a skeleton. It is hand-written and filled in at milestone closeout. The balance report is generated as of `pantry_rules_05`.

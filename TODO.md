# TODO

The single forward-work tracker for Pantry Depths. Shipped outcomes move to `CHANGELOG.md`.

Plan children get no lines here. They live in their plan's child overview table, per `dev/foundation/core/workflows/plan_standard.md`. This file tracks only work that no plan owns.

---

## Active

Nothing in flight.

---

## Queued

### V1 prototype milestone

[`dev/docs/plans/pantry_depths_v1.mega_plan.md`](dev/docs/plans/pantry_depths_v1.mega_plan.md) — the whole game, in four delivery plans, one parallel asset item, and one parked tooling plan.

| Stream | Scope                                                             | Children | State                                              |
| ------ | ----------------------------------------------------------------- | -------: | -------------------------------------------------- |
| A      | [Rules and Content](dev/docs/plans/pantry_rules.plan.md)          |        7 | Active; `pantry_rules_01`–`05` shipped             |
| B      | [Presentation Port](dev/docs/plans/pantry_presentation.plan.md)   |        2 | Queued                                             |
| C      | [Feel and Endgame](dev/docs/plans/pantry_feel.plan.md)            |        4 | Queued                                             |
| D      | [Final Floor Design](dev/docs/plans/pantry_floor_design.plan.md)  |        1 | Queued after Presentation Port                     |
| S      | Enemy Sprite Art                                                  | parallel | Parallel asset deliverable; style spec not written |
| P      | [Authoring Workbench UX](dev/docs/plans/pantry_authoring.plan.md) |        3 | Parked; promote if final floor authoring blocks    |

Next action: `/implement pantry_rules_06` for the final five-floor layout, entity placement, and balance tuning.

---

## Draft

Not scheduled. Do not start without a decision.

- White and black keys, widening the palette from three colours to five. Blocked on a product decision, not on implementation: the design document's section 八 binds the three current colours to passage, attack, and defence, and white and black have no assigned meaning. Decide what they mean before touching `KeyColor`. Requirement 4 of the authoring plan depends on this.
- Browser acceptance coverage. Deliberately absent from V1; `dev/agent_rules/test_operations.md` records it as a standing gap.
- Promote the mega plan shape into game-devkit as `mega_plan_standard.md`. The foundation has no mega-plan contract today; this project is its trial run. See mega plan §8 items 5 and 6.

Playtest-driven balance questions live in mega plan §8, not here — they are product decisions against `src/content/`, not forward work.

---

## Infrastructure Debt

- [ ] `src/app/main.ts` is a placeholder that only writes text into `#app`. `pantry_rules_01` establishes the debug/ordinary-play dispatch; `pantry_feel_01` replaces the ordinary-play placeholder with the runtime.
- [ ] `dev/docs/reports/pantry_depths_architecture.html` is still a skeleton. It is hand-written and filled in at milestone closeout. The balance report is generated as of `pantry_rules_05`.

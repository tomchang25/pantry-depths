# TODO

The single forward-work tracker for Pantry Depths. Shipped outcomes move to `CHANGELOG.md`.

Plan children get no lines here. They live in their plan's child overview table, per `dev/foundation/core/workflows/plan_standard.md`. This file tracks only work that no plan owns.

---

## Active

Nothing in flight.

---

## Queued

### V1 prototype milestone

[`dev/docs/plans/pantry_depths_v1.mega_plan.md`](dev/docs/plans/pantry_depths_v1.mega_plan.md) — the whole game, in three plans plus one parallel item.

| Stream | Scope                                                           | Children | State                                              |
| ------ | --------------------------------------------------------------- | -------: | -------------------------------------------------- |
| A      | [Rules and Content](dev/docs/plans/pantry_rules.plan.md)        |        5 | Queued; `pantry_rules_01` is next                  |
| B      | [Presentation Port](dev/docs/plans/pantry_presentation.plan.md) |        2 | Queued                                             |
| C      | [Feel and Endgame](dev/docs/plans/pantry_feel.plan.md)          |        4 | Queued                                             |
| S      | Enemy Sprite Art                                                | parallel | Parallel asset deliverable; style spec not written |

Next action: `/implement pantry_rules_01` to build the dev-only debug hub before gameplay rules land.

---

## Draft

Not scheduled. Do not start without a decision.

- Browser acceptance coverage. Deliberately absent from V1; `dev/agent_rules/test_operations.md` records it as a standing gap.
- Promote the mega plan shape into game-devkit as `mega_plan_standard.md`. The foundation has no mega-plan contract today; this project is its trial run. See mega plan §8 items 5 and 6.

Playtest-driven balance questions live in mega plan §8, not here — they are product decisions against `src/content/`, not forward work.

---

## Infrastructure Debt

- [ ] `test` carries `--passWithNoTests`. Remove it with the first unit test (`pantry_rules_02`).
- [ ] `src/app/main.ts` is a placeholder that only writes text into `#app`. `pantry_rules_01` establishes the debug/ordinary-play dispatch; `pantry_feel_01` replaces the ordinary-play placeholder with the runtime.
- [ ] `dev/docs/reports/*.html` are skeletons. The balance report gains a generator at `pantry_rules_05`; the architecture report is filled in at milestone closeout.

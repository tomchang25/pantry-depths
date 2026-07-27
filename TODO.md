# TODO

The single forward-work tracker for Pantry Depths. It tracks only work that no plan owns: plan children get no lines here, they live in their plan's child overview table, per `dev/foundation/core/workflows/plan_standard.md`. There is deliberately no Done tier — remove a shipped line and record its outcome in `CHANGELOG.md`.

> The actionable tiers (`Plan`, `Chore`, and `Bug`) carry one line per item: no paragraphs, tables, or rationale. An item that needs explanation belongs in `## Draft` under one `###` heading, written as plain text and lists — no `####` headings or bold-label patterns.
>
> Scope tags in actionable lines use short, lowercase `snake_case` identifiers, such as `[cross_floor_locks]`.

Actionable line format: `[scope] one sentence - [ref plans/<name>.md if any]`

The V1 prototype milestone lives in [`pantry_depths_v1.mega_plan.md`](dev/docs/plans/pantry_depths_v1.mega_plan.md), which owns every stream's scope, state, and landing order; this tracker does not restate them. The critical-path next action is `pantry_feel_03`. Scene Authoring and Live Preview runs in parallel and its preview children are now unblocked.

---

## Active

> Nothing currently in progress.

---

## Plan

Forward work that no plan owns, each with a sketch in `dev/docs/plans/`. A line becomes actionable through `/implement`, which rewrites the sketch into a standalone implementation spec; the line stays here until the work ships. If a plan later adopts the work, the sketch moves into that plan as a child and this line is removed in the same change.

- [player_screen_layer] Make the held torch and sword, the attack slash, the torch flame, and the damage flash authored values instead of renderer constants; the open shape question is what each value is a fraction of - [ref plans/pantry_player_screen_layer.sketch.md]
- [cross_floor_locks] Let the generator place a key on one floor and the door it opens on a later one, since runtime and the validator already allow it but the per-floor construction guarantee does not - [ref plans/pantry_cross_floor_locks.sketch.md]
- [cross_floor_entity_move] Let the Workbench move a gameplay entity to another floor instead of forcing delete-and-recreate, by giving the move mutation an explicit source and destination floor - [ref plans/pantry_cross_floor_entity_move.sketch.md]

---

## Chore

One line, no rationale, no backing document.

- [mega_plan_standard] Promote the mega-plan shape into game-devkit as `mega_plan_standard.md` once this project's trial run has an answer - [ref mega plan §8 items 5 and 6]

---

## Bug

One line, no rationale, no backing document.

> No open bugs.

---

## Infrastructure Debt

Known gaps with a named closer. Not independently actionable — each closes as a side effect of the work that owns it.

- [ ] `dev/docs/reports/pantry_depths_architecture.html` is still a skeleton; it is hand-written and filled in at milestone closeout.

---

## Draft

Not scheduled. Do not start without a decision.

### Palette Expansion

White and black keys, widening the palette beyond the current three colours. Blocked on a product decision, not on implementation: the design document's section 八 binds red, blue, and yellow to passage, attack, and defence, while additional colours have no assigned meaning. The shipped authoring workbench and generator deliberately expose only the three existing colours, so widening the palette is a content-contract change, not a tooling change.

### Browser Acceptance Coverage For Gameplay

`test/e2e/` now covers the development console only — the parts of `src/app/debug/` that a DOM-less unit environment cannot observe. Presentation, input feel, VFX, and audio remain deliberate manual-playtest boundaries; `dev/agent_rules/test_operations.md` owns that scope line.

### DOM Component Test Layer

A jsdom component layer — `jsdom` plus `@testing-library/dom`, no React — between unit and browser. Now a live question rather than a hypothetical: `src/ui/` ships player-facing DOM. The readout kept its whole derivation in a pure, DOM-free module so the branching logic is unit-covered, but the feel plan's acceptance criteria 3 and 6 — required information without relying on colour alone, keyboard reachable and semantically labelled — are semantic assertions about the DOM itself, and a stylesheet that silently overrode a hidden panel has already slipped through the current layers once.

### V2 Direction

The [post-V1 product direction](dev/docs/design/pantry_depths_v2_direction.md): extraction runs, exit unlock conditions, spawn conditions, map difficulty tiers, inventory and items, blessings and curses, and fog. It is a direction document, not forward work: no requirements, no children, and nothing in it loosens V1's frozen-extension contract. Two of its open questions — fog versus the explored map, and the persistence debt that carried items imply — need answers before any of it becomes a plan.

---

Playtest-driven balance questions live in mega plan §8, not here — they are product decisions against `src/content/`, not forward work.

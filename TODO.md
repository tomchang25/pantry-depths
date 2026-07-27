# TODO

The single forward-work tracker for Pantry Depths. It tracks only work that no plan owns: plan children get no lines here, they live in their plan's child overview table, per `dev/foundation/core/workflows/plan_standard.md`. There is deliberately no Done tier — remove a shipped line and record its outcome in `CHANGELOG.md`.

> The actionable tiers (`Plan`, `Chore`, and `Bug`) carry one line per item: no paragraphs, tables, or rationale. An item that needs explanation belongs in `## Draft` under one `###` heading, written as plain text and lists — no `####` headings or bold-label patterns.
>
> Scope tags in actionable lines use short, lowercase `snake_case` identifiers, such as `[cross_floor_locks]`.

Actionable line format: `[scope] one sentence - [ref plans/<name>.md if any]`

This tracker is the forward-work authority. The V1 milestone plan that used to own stream ordering has been frozen into `dev/docs/design/`; what still pointed forward from it lives under `## Draft` below. The critical-path next action is `pantry_floor_design_01`, and Scene Authoring and Live Preview runs in parallel with its preview children unblocked.

---

## Active

> Nothing currently in progress.

---

## Plan

Forward work that no plan owns, each with a sketch in `dev/docs/plans/`. A line becomes actionable through `/implement`, which rewrites the sketch into a standalone implementation spec; the line stays here until the work ships. If a plan later adopts the work, the sketch moves into that plan as a child and this line is removed in the same change.

- [feedback_and_leaving] Give the world its own voice for walls, doors, upgrades, the hot spring, and threats the player never faced, and make leaving through the exit an authored departure rather than a summary panel appearing - [ref plans/pantry_feedback_and_leaving.sketch.md]
- [player_screen_layer] Make the held torch and sword, the attack slash, the torch flame, and the damage flash authored values instead of renderer constants; the open shape question is what each value is a fraction of - [ref plans/pantry_player_screen_layer.sketch.md]
- [cross_floor_locks] Let the generator place a key on one floor and the door it opens on a later one, since runtime and the validator already allow it but the per-floor construction guarantee does not - [ref plans/pantry_cross_floor_locks.sketch.md]
- [cross_floor_entity_move] Let the Workbench move a gameplay entity to another floor instead of forcing delete-and-recreate, by giving the move mutation an explicit source and destination floor - [ref plans/pantry_cross_floor_entity_move.sketch.md]

---

## Chore

One line, no rationale, no backing document.

- [mega_plan_standard] Promote the mega-plan shape into game-devkit as `mega_plan_standard.md` once this project's trial run has an answer: whether three layers were too heavy for a one-week project, and whether keeping the top layer out of every child's reading path actually held

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

The post-V1 product direction: extraction runs, exit unlock conditions, spawn conditions, map difficulty tiers, inventory and items, blessings and curses, and fog. It is a direction document, not forward work: no requirements, no children, and nothing in it loosens V1's frozen-extension contract. Two of its open questions — fog versus the explored map, and the persistence debt that carried items imply — need answers before any of it becomes a plan.

### V1 Definition Of Done

Lifted from the milestone plan before it was frozen, because it is the only statement of when V1 is finished. All of these must hold:

1. A player walks from B1 to B5, leaves through the exit, and sees the departure and completion statistics.
2. Five floors, three key colours, six doors, four stat upgrades, the hidden wall, and the hot spring are all reachable and usable.
3. Combat stays fully deterministic: the same input sequence always produces the same result.
4. Every number lives in `src/content/` rather than scattered through rendering or input code.
5. `npm run verify` is green.
6. The balance report regenerates from a command and matches current content.
7. The architecture report exists and answers what a reader must change to add an enemy.

### Playtest Questions

Only playing answers these; none of them blocks work, and all of them are product decisions against `src/content/` rather than forward work. Lifted from the milestone plan for the same reason as above.

- Whether the forced route offers the right pressure, room to misjudge, and recovery rhythm. Adjustment is always authored content, never the combat formula.
- Whether the final encounter before the exit lands as an ending without dragging, and whether simply reaching the exit feels like enough of a close. If it does not, the answer is a stronger departure and statistics, not moving the terminal outcome back onto a kill.
- Whether restarting the whole run on death is too punishing. The one sanctioned fallback is returning to the floor's stair with opened doors and collected keys intact at 30% health; still no save.
- Whether a player reads "cannot penetrate" as a rule rather than a bug. If not, a one-time teaching cue.

### Architecture Report Contents

The report at `dev/docs/reports/pantry_depths_architecture.html` is hand-written and still a skeleton. Its requirements were held only by the milestone plan, so they are recorded here: a self-contained page, light and dark themes, anchored sections, ending in an entry point to the source. It must at least answer how one Action travels from key press to screen, why the layer boundaries fall where they do and how they are machine-enforced, which files change to add an enemy, and which change to add a floor.

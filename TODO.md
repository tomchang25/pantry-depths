# TODO

The single forward-work tracker for Pantry Depths. It tracks only work that no plan owns: plan children get no lines here, they live in their plan's child overview table, per `dev/foundation/core/workflows/plan_standard.md`. There is deliberately no Done tier — remove a shipped line and record its outcome in `CHANGELOG.md`.

> The actionable tiers (`Plan`, `Chore`, and `Bug`) carry one line per item: no paragraphs, tables, or rationale. An item that needs explanation belongs in `## Draft` under one `###` heading, written as plain text and lists — no `####` headings or bold-label patterns.
>
> Scope tags in actionable lines use short, lowercase `snake_case` identifiers, such as `[cross_floor_locks]`.

Actionable line format: `[scope] one sentence - [ref plans/<name>.md if any]`

This tracker is the forward-work authority. The demo's direction lives in `dev/docs/design/pantry_demo_core.design.md` and the tool-chain work it implies lives in `dev/docs/plans/pantry_demo_workbench.plan.md`. The critical-path next action is that plan's stage 0 and stage 1, which have no dependencies between them.

## Active

> Nothing currently in progress.

---

## Plan

Forward work that no plan owns, each with a sketch in `dev/docs/plans/`. A line becomes actionable through `/implement`, which rewrites the sketch into a standalone implementation spec; the line stays here until the work ships. If a plan later adopts the work, the sketch moves into that plan as a child and this line is removed in the same change.

> Nothing currently planned. The sketches this tier used to carry were deleted with the old direction.

---

## Chore

One line, no rationale, no backing document.

> No open chores.

---

## Bug

One line, no rationale, no backing document.

> No open bugs.

---

## Draft

Not scheduled. Do not start without a decision.

### Browser Acceptance Coverage For Gameplay

`test/e2e/` now covers the development console only — the parts of `src/app/debug/` that a DOM-less unit environment cannot observe. Presentation, input feel, VFX, and audio remain deliberate manual-playtest boundaries; `dev/agent_rules/test_operations.md` owns that scope line.

### DOM Component Test Layer

A jsdom component layer — `jsdom` plus `@testing-library/dom`, no React — between unit and browser. Now a live question rather than a hypothetical: `src/ui/` ships player-facing DOM. The readout kept its whole derivation in a pure, DOM-free module so the branching logic is unit-covered, but the feel plan's acceptance criteria 3 and 6 — required information without relying on colour alone, keyboard reachable and semantically labelled — are semantic assertions about the DOM itself, and a stylesheet that silently overrode a hidden panel has already slipped through the current layers once.

### Playtest Questions

Only playing answers these; none of them blocks work, and all of them are product decisions against `src/content/` rather than forward work. Lifted from the milestone plan for the same reason as above.

- Whether the forced route offers the right pressure, room to misjudge, and recovery rhythm. Adjustment is always authored content, never the combat formula.
- Whether the final encounter before the exit lands as an ending without dragging, and whether simply reaching the exit feels like enough of a close. If it does not, the answer is a stronger departure and statistics, not moving the terminal outcome back onto a kill.
- Whether restarting the whole run on death is too punishing. The one sanctioned fallback is returning to the floor's stair with opened doors and collected keys intact at 30% health; still no save.
- Whether a player reads "cannot penetrate" as a rule rather than a bug. If not, a one-time teaching cue.

### Architecture Report Contents

The report at `dev/docs/reports/pantry_depths_architecture.html` is hand-written and still a skeleton. Its requirements were held only by the milestone plan, so they are recorded here: a self-contained page, light and dark themes, anchored sections, ending in an entry point to the source. It must at least answer how one Action travels from key press to screen, why the layer boundaries fall where they do and how they are machine-enforced, which files change to add an enemy, and which change to add a floor.

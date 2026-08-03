# Demo Migration End — Child End

Parent Plan: `demo_migration.plan.md`

## Goal

Retire the institutions the demo's exemption built: the machine guard that banned testing half the repository, the two operation contracts patched around that ban, and the root entry points that state it. After this child, formal-track discipline is simply the repository's discipline.

## Summary

- **The guard dies with its subject.** The demo-half test guard is deleted. The sandbox budget guard is untouched — a different guard for a track that keeps its rules.
- **The test operations contract is rewritten as a whole document.** Three surfaces become two tracks: the formal track, where unit tests are spec-named and browser tests are proposed after delivery, and the sandbox track, unchanged. What playing is _for_ survives the ban's retirement: feel is still judged by a person, the capture harness still observes without judging, and the mirrored-direction-wheel lesson is kept as history explaining why tests near presentation stay rare and deliberate.
- **The implement permissions contract is rewritten as a whole document**, not patched a sixth time: the light ceremony is scoped to the sandbox track alone, and the second-confirmation bypass, the standing plan authorization, the sandbox-approval rule, and the `/goal` loop survive verbatim in substance. Every string the governance checker pins is preserved, so the checker passes without edits.
- **The root entry points and startup stop telling the old truth**: the "Never test the demo" section in both entry files becomes a short pointer to the rewritten contract, and the startup's "two halves" line becomes the sandbox delta it now is.
- **The plan closes**: tracker line removed, plan archived, changelog records the outcome, and the structure addendum's demo-tree sentence stops promising the declaration retires "when the migration closes" — it retires with the tree, when the renderer decision replaces it.

Verification: the gate and the governance check. Docs and one test deletion; no playtest.

## Relational Context

- `dev/tools/check_governance.py` pins strings in both rewritten contracts and the entry points; the rewrites keep every pinned heading and sentence, so checker and documents stay in agreement without touching the checker.
- `dev/standards/sandbox_track.md` and `.claude/commands/goal.md` route into the implement contract by heading; those headings survive.
- The capture harness sections reference a dev-only world handle by string; nothing in this child touches code, so those sections move verbatim.

## Scope

### Included

- Guard deletion; both contract rewrites; entry-point and startup edits; the addendum sentence; plan closeout (tracker, archive, changelog).

### Excluded

- The checker itself; the sandbox guard and track rules; any code change; the interim projection tree and its declaration.

## Acceptance Criteria

1. No governance document outside history speaks of a demo half, a test ban, or two ceremonies except the sandbox track's own.
2. The governance checker passes unmodified against the rewritten contracts and entry points.
3. The aggregate gate passes with the guard deleted and no other test change.
4. The plan is archived, its tracker line is gone, and the changelog records the migration's outcome.

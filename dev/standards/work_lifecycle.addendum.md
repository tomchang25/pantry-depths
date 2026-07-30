# Work Lifecycle Addendum

This file is the project-local delta to `dev/foundation/core/workflows/work_lifecycle.md`. Read that document first; it owns the canonical state machine, transition gates, and tracking states. `dev/foundation/core/workflows/probe_standard.md` and `dev/foundation/core/workflows/sketch_standard.md` own what each artifact must contain. Only the narrowing below is project-specific.

## Probe Is Reserved For Conceptual Observation

The foundation offers the probe as the optional artifact for preserving an unresolved problem before a direction is chosen. Pantry Depths narrows that: **a probe is written only when the work is still conceptual — no direction has been chosen, and the durable value is the problem statement itself.**

When a direction has been chosen, the forward artifact is a sketch for a plan child, or a plan when the work needs its own requirements and decomposition. `/implement` then turns that sketch or plan child into the implementation spec and carries it through to execution.

This supersedes only the foundation's default expectation that a probe is the normal way to park work that is not yet ready for a spec. Every other lifecycle rule stands unchanged: the implementation spec remains the only executable handoff, the transition gates still apply, and the artifact standards still define what a correct probe, sketch, plan, or spec contains.

**Why:** the probe slot was collecting half-complete drafts — documents that already knew their direction and were really provisional implementation-facing context, which is exactly what a sketch models and what the sketch standard permits codebase evidence for. Two artifacts with overlapping jobs meant a judgement call at every fork with no behavioral difference at the other end. Meanwhile `/implement`'s Phase 1 decision scan already forces the "state the problem and confirm the target before designing" step in conversation, so the probe's remaining unique job is narrow: hold a genuinely undirected observation.

No probe currently exists in this repository, so adopting this narrowing costs no migration.

## Declared Deviation: The Demo Tool-Chain Plan Carries Code Coordinates

`dev/foundation/core/workflows/plan_standard.md` requires a plan to be written in English and to name no file paths, line numbers, function names, or class names. `dev/docs/plans/pantry_demo_workbench.plan.md` conforms to neither requirement, deliberately and with no expiry.

**Why:** that plan's subject is the tooling built around an existing codebase, and most of its decisions are statements about specific modules — which one is kept as a skeleton, which one is written beside its predecessor rather than edited in place, which import boundary forces an authored file into one directory rather than another. Rewritten to refer to systems by role, those decisions stop being checkable: "the offline generator" and "the authoring endpoint" name nothing a reader can open. The standard's stated purpose for the ban is that a plan should stay valid as the codebase changes, and this plan accepts the opposite trade — it goes stale when the code moves, and that is the signal it is meant to give.

The language follows the same reasoning: it is the author's working document, and the audience is one person who writes in Chinese.

This deviation is scoped to that one document. Every other plan in this repository follows the standard as written, and a new plan does not inherit the exemption by pointing at this section — the general relaxation below is what a new plan uses instead, and it is narrower: it keeps the reviewable half clean and confines the coordinates to a declared section.

## Every Plan May Carry An Execution Half

This supersedes, for every plan in this repository, `dev/foundation/core/workflows/plan_standard.md`'s requirement that a plan contain no file paths, line numbers, code snippets, or function and class names, and its expectation that implementation-facing shape waits for a child sketch. A plan here has two halves with two different contracts.

**The conceptual half — `Goal`, `Requirements`, `Design`, `Non-Goals`, `Acceptance Criteria` — is unchanged.** Every rule in the plan standard still applies to it: English, no code coordinates, systems referred to by role, the why stated inline, full design depth in behavioural terms. This half exists to be reviewed by a person deciding whether the direction is right, and a coordinate in it costs that reader attention on something they are not being asked to judge.

**After `Acceptance Criteria`, a plan may carry an `Execution` section under no such limits.** It may name files, line numbers, symbols, and commands; quote code; hold tables of concrete values, migration steps, per-child file maps, and anything else `/implement` would otherwise have to rediscover. There is no length discipline on it. **English still applies** — the language rule is not part of this relaxation, and every section of a plan in this repository is written in English.

**Why:** the plan standard's stated reason for the ban is that a plan should stay valid as the codebase changes, and it pays for that with a mandatory rediscovery step — every child re-derives the same coordinates through a sketch before a spec can be written, and the answers were already known when the direction was chosen. Splitting the document buys both: the half that gets reviewed stays durable and reviewable, and the half that gets executed carries what execution needs. The cost is accepted explicitly, not sidestepped.

Three rules keep the second half from rotting into a lie:

- **The `Execution` half is perishable and says so.** It is a record of the codebase at the moment the plan was written. Whoever executes a child re-checks its coordinates against the live code first; a stale line there is expected, not a defect in the plan.
- **It is forward-only, exactly as the child overview table is.** When a child ships, its `Execution` subsection is cut in the same change that cuts its row from the overview table. The section shrinks as the plan lands and is gone when the plan is done.
- **A conflict between the halves is resolved by the conceptual half.** If the `Execution` notes describe something the `Requirements` do not ask for, the notes are wrong. Design decisions are never made in the second half; it only says where.

**A child whose `Execution` subsection already answers its implementation shape skips the sketch and goes straight to a spec through `/implement`.** That is the point of the relaxation. A child still needs a sketch when its shape is genuinely open — when the plan recorded the target but not the approach, or when an earlier child changed the ground under it.

This relaxation is general and has no expiry. It does not extend to sketches, implementation specs, reviews, or closeouts, each of which keeps its own standard as written.

## Practical Routing

| Situation                                                                                | Artifact                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------- |
| A problem or tension is worth recording, but no direction is chosen                      | Probe                                 |
| The slice belongs to an existing plan whose `Execution` half already answers its shape   | Implementation spec, via `/implement` |
| The direction is chosen and the slice belongs to an existing plan, shape still open      | Sketch as that plan's child           |
| The direction is chosen and no plan owns the area yet                                    | Standalone sketch                     |
| The direction is chosen and the work needs its own requirements, non-goals, and children | Plan                                  |
| The slice is ready to execute                                                            | Implementation spec, via `/implement` |
| The change is a chore, copy edit, or configuration tweak                                 | Compact implementation note           |

A sketch whose direction later turns out to be wrong is rewritten or deleted, not converted back into a probe.

## Standalone Sketches

A sketch does not require a parent plan. `dev/foundation/core/workflows/sketch_standard.md` already provides the standalone form — the parent marker reads `Parent Plan: none (standalone sketch)` and the otherwise-omitted Requirements section is included, because with no parent there is no other owner for them. Prefer a standalone sketch over stretching an unrelated plan's boundary just to have somewhere to file a child.

The foundation's sketch lifecycle describes only the plan-child path, so this project fills in the standalone one:

- The file lives at `dev/docs/plans/<scope>_<slug>.sketch.md`, with no parent scope or child number in the name.
- It gets exactly one `TODO.md` pointer, because it is forward work that no plan owns. This is the same rule the tracker already states; a standalone sketch is not a plan child and is not exempt from it.
- If a plan later adopts the work, the sketch is renamed into that plan's child form, pointed to from the plan's child overview, and its `TODO.md` line is removed — one owner at a time, in the same change.
- It becomes actionable the same way a child sketch does: `/implement` rewrites it into a standalone implementation spec, which keeps the `TODO.md` pointer until the work ships.

# Work Lifecycle Addendum

This file is the project-local delta to `dev/foundation/core/workflows/work_lifecycle.md`. Read that document first; it owns the canonical state machine, transition gates, and tracking states. `dev/foundation/core/workflows/probe_standard.md` and `dev/foundation/core/workflows/sketch_standard.md` own what each artifact must contain. Only the narrowing below is project-specific.

## Probe Is Reserved For Conceptual Observation

The foundation offers the probe as the optional artifact for preserving an unresolved problem before a direction is chosen. Pantry Depths narrows that: **a probe is written only when the work is still conceptual — no direction has been chosen, and the durable value is the problem statement itself.**

When a direction has been chosen, the forward artifact is a sketch for a plan child, or a plan when the work needs its own requirements and decomposition. `/implement` then turns that sketch or plan child into the implementation spec and carries it through to execution.

This supersedes only the foundation's default expectation that a probe is the normal way to park work that is not yet ready for a spec. Every other lifecycle rule stands unchanged: the implementation spec remains the only executable handoff, the transition gates still apply, and the artifact standards still define what a correct probe, sketch, plan, or spec contains.

**Why:** the probe slot was collecting half-complete drafts — documents that already knew their direction and were really provisional implementation-facing context, which is exactly what a sketch models and what the sketch standard permits codebase evidence for. Two artifacts with overlapping jobs meant a judgement call at every fork with no behavioral difference at the other end. Meanwhile `/implement`'s Phase 1 decision scan already forces the "state the problem and confirm the target before designing" step in conversation, so the probe's remaining unique job is narrow: hold a genuinely undirected observation.

No probe currently exists in this repository, so adopting this narrowing costs no migration.

## Lifting From Archives Carries The Constraint Only

`dev/foundation/core/standards/governance_structure_standard.md` requires closeout, when archiving an artifact, to lift still-needed content and its context into each referencing document. This narrows what moves: a durable document receives the constraint or rule itself, with at most one sentence of why. The events that produced it, dates, and the state of the code at the time stay in the archive and in Git history. The lift replaces the pointer — a durable document still never references the archive — and it never adds a narrative section.

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

## A Plan May Declare Itself Goal-Executable

A plan whose children are meant to be worked through continuously — one approval, then every child in landing order with no further stop — says so in one line directly under its title: `Goal-Executable: yes`.

The line is a claim about the document, not an authorization. It says the plan is shaped so that running it end to end cannot silently swallow a decision. The authorization is still a sentence from the user, granted under `dev/agent_rules/implement_operations.md`; a plan that declares itself goal-executable and is never authorized is executed one stop at a time like any other.

A plan may make the claim only when all three of these hold, and whoever writes the declaration checks all three first:

1. **Every child has an `Execution` subsection.** A child whose shape is genuinely open needs a sketch, and a sketch is a stop. A plan carrying such a child is not goal-executable until that child is resolved or cut.
2. **The document contains no unanswered question** — not in the Requirements, not in the Design, and not parked in an open-questions section, of which a goal-executable plan has none. An unanswered question is a stop that was written down instead of taken.
3. **Every acceptance criterion can be judged in one sitting**: by the project's verification gate, by opening the thing and looking, or by playing it. A criterion needing a measurement nobody has taken is condition 2 in disguise.

**Why the claim lives in the document rather than only in the conversation:** those three conditions are properties of the plan, and they are the whole of what makes continuous execution safe. Written down, they give the reviewer one thing to check before saying go, and give the executor one thing to re-check when a child turns out harder than the plan thought. If any condition stops holding mid-flight, the declaration is void for the rest of that plan and the ordinary stops return — the guards on the second-confirmation bypass already say this, and the declaration does not weaken any of them.

Nothing else about the plan changes. Both halves keep their contracts, the child overview table is unchanged, and the `Execution` half stays perishable, forward-only, and subordinate to the conceptual half.

**Sandbox-track plans declare it by default.** A plan whose surface is `src/sandbox/` (`dev/standards/sandbox_track.md`) is written to satisfy the three conditions and carries `Goal-Executable: yes` from its first draft; a sandbox plan that cannot satisfy them is evidence the work is not sandbox-shaped and belongs on the formal track. What the declaration buys on that track is owned by `dev/agent_rules/implement_operations.md`: approval of a sandbox plan is itself the continuous-execution authorization.

## The Brief

A brief is a format-free document whose only job is to start a conversation somewhere else. It is not a lifecycle artifact: it authorizes nothing, it is never cited as a reason, and it is spent the moment the plan, sketch, or spec it seeded exists.

It fills a real gap. The probe is narrowed above to genuinely undirected observation, so it is the wrong home for material that already knows roughly where it is going. A sketch and a plan both assume the direction is chosen and are written to be reviewed. And the tracker's `Draft` tier forbids structure, so it cannot hold a mechanic broken into parts, a table of everything a system would have to cover, or a reading of how another repository solved the same problem. A brief holds exactly that and hands it to whoever picks the subject up next.

- **No format.** Any structure, any length, code, quoted files, external repository paths, images. This is the one document class the English rule does not reach, because its readers are the author and the next agent, and neither reads it to review a decision.
- **It says what it is, at the top:** that it is a brief, that it authorizes no implementation, and which conversation it exists to seed.
- **It lives in `dev/docs/briefs/`**, named `<slug>.brief.md`.
- **It gets one `TODO.md` pointer under `## Plan`**, beside the sketches, naming itself as a brief. It is not actionable the way a sketch is — `/implement` cannot eat one, because a brief is what the conversation that produces a sketch starts from. It sits in that tier anyway because that is where a reader looks for work nothing owns yet, and a brief buried under `Draft` is a brief nobody opens.
- **It is spent when it germinates.** When the artifact it seeded exists, the brief is deleted — or archived, when what it recorded is worth keeping — in the same change. A brief left beside the plan it produced is a second requirement owner, which is the failure most of this lifecycle exists to prevent.
- **It is never an authority.** Nothing cites a brief to justify a decision. Anything in one that turns out to be load-bearing moves into the artifact that owns it.

**Why this is not just a longer tracker draft entry:** the `Draft` tier is deliberately hostile to structure so the tracker stays scannable, which is right for the tracker and wrong for the material. A brief that has to be flattened into prose to be recorded gets written somewhere else instead — which is what already happened here, so this section names the shape that document had rather than inventing one.

## Practical Routing

| Situation                                                                                | Artifact                                                                                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| A problem or tension is worth recording, but no direction is chosen                      | Probe                                                                                                                                             |
| The material is ready to be worked on, but the working belongs in its own session        | Brief                                                                                                                                             |
| The slice belongs to an existing plan whose `Execution` half already answers its shape   | Implementation spec, via `/implement`                                                                                                             |
| The direction is chosen and the slice belongs to an existing plan, shape still open      | Sketch as that plan's child                                                                                                                       |
| The direction is chosen and no plan owns the area yet                                    | Standalone sketch                                                                                                                                 |
| The direction is chosen and the work needs its own requirements, non-goals, and children | Plan                                                                                                                                              |
| The slice is ready to execute                                                            | Implementation spec, via `/implement`                                                                                                             |
| The change is a chore, copy edit, or configuration tweak                                 | Compact implementation note                                                                                                                       |
| The work is a sandbox experiment under `src/sandbox/`                                    | Short note via `/implement`; a plan only when it has real children, then `Goal-Executable: yes` by default — see `dev/standards/sandbox_track.md` |

A sketch whose direction later turns out to be wrong is rewritten or deleted, not converted back into a probe.

## Standalone Sketches

A sketch does not require a parent plan. `dev/foundation/core/workflows/sketch_standard.md` already provides the standalone form — the parent marker reads `Parent Plan: none (standalone sketch)` and the otherwise-omitted Requirements section is included, because with no parent there is no other owner for them. Prefer a standalone sketch over stretching an unrelated plan's boundary just to have somewhere to file a child.

The foundation's sketch lifecycle describes only the plan-child path, so this project fills in the standalone one:

- The file lives at `dev/docs/plans/<scope>_<slug>.sketch.md`, with no parent scope or child number in the name.
- It gets exactly one `TODO.md` pointer, because it is forward work that no plan owns. This is the same rule the tracker already states; a standalone sketch is not a plan child and is not exempt from it.
- If a plan later adopts the work, the sketch is renamed into that plan's child form, pointed to from the plan's child overview, and its `TODO.md` line is removed — one owner at a time, in the same change.
- It becomes actionable the same way a child sketch does: `/implement` rewrites it into a standalone implementation spec, which keeps the `TODO.md` pointer until the work ships.

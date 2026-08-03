# Implement Operations

This file is the authoritative project-local permission delta for `/implement`. Read `dev/foundation/core/workflows/commands/implement.md`, `dev/foundation/core/workflows/work_lifecycle.md`, and `dev/foundation/core/workflows/implementation_spec_standard.md` first; their contracts continue to apply except for the narrow supersessions below.

## The Sandbox Track Works Light

The supersessions in the next two sections apply to **sandbox work** — changes whose surface is `src/sandbox/`, per `dev/standards/sandbox_track.md` — and to nothing else. Every other change runs the foundation workflow unchanged: the formal layers are the architecture the game lives in, and they keep their full ceremony. The sandbox is a permanent member of the light half, because disposable work never earns the ceremony back.

**Why:** the light ceremony was written for the demo era, when a playable surface reached a playable state in a day while the surface it replaced took days longer describing itself. The demo has since been migrated into the formal layers and the ceremony went with it; what remains light is the track whose whole design is that its work is cheap to run and cheap to throw away.

## Phase 1 Is A Design Conversation

For sandbox work, the foundation's Focused Decision Scan is superseded: Phase 1 is a conceptual discussion first — what should this be, and does the current shape deserve to survive it. Codebase evidence informs that conversation rather than bounding it.

1. Propose replacing existing code, not only extending it, whenever extension would preserve a shape nobody is defending. Say plainly when the honest answer is that something should be thrown away.
2. Gather only the evidence the conversation needs. Do not open a survey of the change's eventual surface before the direction is agreed.
3. Disagree with the request when the request is the problem. A concept that will not work is a Phase 1 finding, not something to be faithfully implemented and discovered later.
4. Target confirmation stays mandatory and is never inferred. This supersession changes what Phase 1 talks about, not whether it stops.

## Phase 2 Delivers An Approach, Not An Inventory

For sandbox work the spec is a short architectural note: what is being built, what owns it, what it replaces, and the shapes to avoid. It supersedes `implementation_spec_standard.md`'s required structure and the Relational Context inventory for this track only.

1. Name the owning modules and the direction of the change. Do not enumerate every file, signature, or call site — those are discovered during implementation.
2. State the load-bearing decisions and the ones deliberately left open. Detail that cannot change the agreed shape does not belong in the note.
3. Lifecycle tracking is one pointer or none.
4. Verification is `dev/agent_rules/test_operations.md`, which for this track means `npm run verify` and opening the experiment's debug tool. Sandbox coverage stays inside the budget that file states.

## Explicit Second-Confirmation Bypass

The foundation requires `/implement` to stop twice: once before spec mutation and again after the spec-backed preview before source mutation. For Pantry Depths, the second stop may be bypassed for tightly bounded work when the user explicitly requests the bypass after seeing the Phase 1 scratchboard.

This rule supersedes only the foundation statements that the Phase 2 implementation-confirmation stop is always mandatory and that an earlier confirmation can never authorize implementation. Apply the replacement contract as follows:

1. Phase 1 target confirmation remains mandatory. Never infer it from the original `/implement` invocation, and never bypass it.
2. In the reply that confirms the Phase 1 target, the user may also explicitly instruct the agent to skip the second confirmation and implement immediately after the spec is complete. The request must clearly name that intent; a generic `confirm`, `continue`, or `go ahead` authorizes Phase 2 only.
3. The bypass applies only to the current confirmed target and the current `/implement` flow. It is not a standing preference and does not carry to another target or a later invocation.
4. Phase 2 still performs the complete implementation-modeling pass, writes or updates the English implementation spec, updates lifecycle tracking, runs the required documentation checks, and prepares the user-language preview. The agent may present that preview as a progress update and continue into implementation without waiting for another reply.
5. Direct continuation is allowed only while the spec's Goal, Summary, scope, compatibility promises, and observable result faithfully remain within the Phase 1 confirmation. If modeling exposes an unresolved user-authority decision, contradicts locked behavior, expands the confirmed scope, or makes the target no longer tightly bounded, stop and ask for confirmation instead.
6. The bypass does not waive a renewed confirmation required by a material implementation-time deviation, nor any destructive-action approval, external authorization, human asset approval, or verification obligation.

When these conditions hold, the explicit bypass request is advance approval of the spec-backed Goal and Summary and the executor plan produced within the confirmed target. Phase 4 may therefore begin immediately after Phase 2 completes successfully.

## Standing Authorization Across A Plan's Children

The bypass above is per-target by construction, so a plan whose children are already specified costs one mandatory stop per child — and that stop asks a question the plan has already answered. The target for a child is the row in its overview table plus the subsection in its `Execution` half, and both were read when the plan was approved.

This rule supersedes only the two statements above that Phase 1 target confirmation may never be bypassed and that an authorization cannot carry to a later target or a later invocation. It applies where the target was written down and approved, and never where it would have to be inferred:

1. The plan carries an `Execution` half per `dev/standards/work_lifecycle.addendum.md`, and that half has a subsection answering this child's implementation shape.
2. The user has approved the plan and, in as many words, authorized continuous execution of its children. A generic `go`, `continue`, or `LGTM` on one child authorizes nothing beyond that child.
3. Both stops are then skipped for every child the authorization named. Phase 2 still performs the complete implementation-modeling pass, writes its spec, updates lifecycle tracking, and runs the required documentation checks; Phase 4 begins immediately afterwards.
4. The authorization is spent when the named children ship, when the plan's Requirements change, or when any guard below fires. It never becomes a standing preference for the repository.

Every guard on the bypass above continues to apply unchanged, and clause 5 there is what keeps this honest: stop and ask when modeling exposes an unresolved user-authority decision, contradicts locked behavior, expands the approved scope, or requires a destructive action, an external authorization, or a human asset approval. **An authorization to work through a plan is never an authorization to decide something the plan left open.**

**Why:** the per-target rule was written for `/implement` invoked conversationally against one slice, where the only record of the target is the conversation that produced it — and there, re-confirming is the only way to know the target survived. A plan with an execution half is the opposite case: the target is a reviewed document, so the confirmation buys a second reading of something already read, and the cost is paid once per child.

## A Sandbox Plan's Approval Is Its Authorization

For a plan whose surface is the sandbox track — `src/sandbox/`, per `dev/standards/sandbox_track.md` — approving the plan is itself the authorization for continuous execution of its children, and satisfies precondition 2 of the `/goal` check below. This supersedes, for sandbox plans only, clause 2 of the standing authorization above: no second sentence naming continuous execution is required.

Everything else stands unchanged. The plan still carries its `Execution` half and the `Goal-Executable: yes` declaration — the sandbox default per `dev/standards/work_lifecycle.addendum.md` — and every guard and stop condition on this page applies at full strength. A stop still ends the run and sends the remaining children back for their own authorization.

**Why:** the sandbox track exists for work that is cheap to run and cheap to throw away, so the second sentence after an approval was pure latency — the reviewer had already read a document whose declared default is continuous execution, and could have withheld approval instead. The formal track keeps the two-sentence rule because its plans change things that are expected to survive.

## Executing A Goal-Executable Plan End To End

`/goal` is the project-local loop over the standing authorization above. It relaxes nothing. It names an owner for the one thing that authorization left unowned: carrying execution from one child to the next. The authorization removes both stops, but `/implement` still ends when its child ends, so a plan of four children took four invocations and put the user back in the loop three times without asking them anything.

Check all three preconditions before the first child, and report which one failed rather than proceeding on two of three:

1. The plan declares `Goal-Executable: yes` and satisfies the three conditions in `dev/standards/work_lifecycle.addendum.md`.
2. The user has authorized continuous execution of that plan's children, in as many words, per the standing authorization above.
3. The verification gate passes before the first child, so any failure during the run is attributable to the run.

Then, for each unshipped child in the plan's landing order:

1. Run the complete `/implement` Phase 2 for that child — implementation modeling, the spec, lifecycle tracking, the documentation checks. Both stops are skipped.
2. Implement it, then run the verification its spec names. The gate runs at least once per child and never only once for the whole plan; a plan verified only at the end cannot say which child broke it.
3. Close the child out: record the outcome, cut its overview row and its `Execution` subsection, archive its spec.
4. Report the child in one short paragraph and continue to the next without waiting for a reply.

The loop stops — genuinely stops, and asks — on any of the following. These are the guards on the bypass above, restated as loop conditions:

- A user-authority decision the plan did not make.
- A conflict between a child's `Execution` subsection and the live codebase that changes what the child does rather than only where it does it.
- Scope growing past what the plan's Requirements ask for.
- A verification failure not attributable to the loop's own edit, or two consecutive failed fix attempts on one check.
- Anything requiring a destructive action, an external authorization, or a human judgement on an asset — including every judgement reserved for a person playing the game.

A stop ends the loop rather than pausing it. The remaining children go back to needing their own authorization, because whatever fired the guard is evidence the plan was less decided than it claimed.

**Why the loop reports per child instead of once at the end:** while it is running, a four-child run that reports only at the end is indistinguishable from a four-child run that went wrong on the first one. The per-child paragraph is a progress report, not a stop, and waits for nothing.

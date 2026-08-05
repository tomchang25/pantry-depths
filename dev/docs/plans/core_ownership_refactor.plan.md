# Core Ownership Refactor

Goal-Executable: yes

## Goal

Restructure the rules layer so that its two decision hotspots — the player's attack and the enemy attack families — live in modules that can only read a declared slice of the run and can only act by returning typed effects, while everything else in the layer gets a named single writer per state domain, machine-checked import boundaries, and a raw-state-access census that only shrinks. Today one flat state record of forty-six top-level fields is read and written by nearly every rules module through whole-state parameters, so reviewing a one-mechanic change requires holding the whole simulation in mind; after this plan, what a reviewer may safely not read is enforced by the compiler and the boundary checker for the decision hotspots, and bounded by ownership, direction rules, and the census everywhere else.

This plan absorbs the enemy behavior split plan: its goal, its seam decomposition, and its landing order survive as the enemy children below, with the seam signatures rewritten to the narrow contract this plan defines. The single-owner shape it moves toward already exists in this repository — the enemy kill path is one module that owns the whole outcome of a death — and this plan extends that proven shape to the rest of the rules layer.

## Requirements

1. **Three roles, visible from placement.** A _resolver_ is a pure decision: it receives a read-only snapshot and returns typed effects, and it cannot name the run state type at all. An _executor_ applies effects through one plainly readable dispatch and may hold raw state. A _mutation owner_ is the single writer for one domain of state — enemy damage and death, player damage, structure damage, run feedback. Which role a module plays is decidable from its path alone, because the boundary rules key on paths. Two different strengths of enforcement, stated honestly: resolver and behavior purity and the import direction between owners are hard walls the boundary checker holds; the executor discipline of writing only through owners is a reviewed convention backed by a write census, because a hard wall there would need a deep-read-only state type or a syntax-tree write checker, and both are named below as the escalation if the census proves leaky rather than paid for now.
2. **Machine enforcement lands before any code moves, and is runnable on its own.** The boundary rules and the census land first. The census is a stage of the aggregate verification command rather than a clause of the governance check, so it sits beside the typecheck a source change is measured by and reaches the branch-merge gate automatically; because that gate runs only at a merge, every child also runs the census directly as one of the narrow checks its spec names, which is what keeps a regression attributable to the child that caused it. The census is a ratchet: an allowlist of modules with recorded counts of whole-state parameters and of direct mutations — assignments and compound assignments on any path rooted at the state parameter (nested paths included), increments and decrements, and mutating collection calls (push, splice, pop, shift, unshift, sort, reverse, fill, copyWithin, set) on such paths — that later children may only shrink. It is a census, not a boundary — an alias extracted to a local escapes the count, as any token count must — and the hard limits stay where they belong, on module paths and contract types. This ordering is the lesson of the register containment effort: a corpus teaches by example, so the gate must exist before the corpus is rewritten.
3. **Behavior-preserving throughout.** No change to timing, geometry, damage numbers, target selection, randomness, or feel. The state record keeps its exact field layout, so the presentation, runtime, and interface layers — all outside this plan's scope — keep every read they have today. Regrouping the record's fields is deliberately deferred until after ownership is settled, because regrouping first would be a cosmetic change with a real blast radius.
4. **Enemy behaviors own their attack and nothing else.** A behavior module receives its body through a narrow mutable self type that exposes only the attack-relevant fields — commitment, wind-up clocks, aim, facing, charge state, position — so a family cannot touch health, the decision state, or the errand fields even by accident. It reads the world only through a read-only view, and every consequence beyond its own body — hurting the player, spawning a shot, damaging a wall, stunning itself, feedback — is a typed effect returned in order and applied by the chassis. Free-order self writes (clocks, aim, movement along a committed lane) stay direct, because the review question a fence answers is "what can this family do to the rest of the world"; a self transition whose order relative to world effects is part of the rules — a stun landing after the wall takes its damage — is expressed as an effect so the order is stated rather than lucky.
5. **Decisions live in the deciding module; snapshot assembly stays mechanical.** An assembler may cut candidates by a coarse radius and resolve authored numbers into plain values, and nothing else — arc, priority, capacity, and every other tunable rule lives in the resolver. An assembler that pre-filters by a rule has moved the decision out of the reviewed module, which is the leak this plan exists to close.
6. **Effects are outcome-independent within a frame.** A decision module never needs the result of one of its own effects to make its next decision in the same frame; where it would, the missing fact belongs in the view, or the decision belongs to the owner. Effects are plain returned values applied synchronously by the caller — no event bus, no subscribers, no deferred queues — so the full consumer set of any effect is one dispatch, readable top to bottom.
7. **Moved comments arrive in plain register.** Every comment in a moved or rewritten region is rewritten to the plain technical register in the same change that moves it, per the standing register rules.
8. **Exactly two new unit spec files, named in this plan and nowhere else.** One for the player attack resolver's geometry and priority rules, one for the enemy behavior release rules. Both live under the test tree, mirror their subject's source path, and exercise the isolated decision contracts — a resolver is pure; a behavior mutates only its narrow self — with hand-built snapshots and views. No other test of any kind is added by this plan.

## Design

### The three roles

| Role           | May read                    | May write                                                | May import                                          |
| -------------- | --------------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| Resolver       | Its snapshot and view types | Nothing (returns effects)                                | Its contract, geometry helpers, shared vocabularies |
| Executor       | Raw run state               | Through owners and feedback, by census-backed convention | Owners, resolvers, contracts                        |
| Mutation owner | Raw run state               | Its own domain of state                                  | Owners strictly below it, feedback, state           |

### The owner direction rules

Owners form a checked one-way stack. Run feedback — sound cues, announcements, visual effects, stains, damage direction marks — is the bottom owner and imports only the state module. Enemy damage and structure damage sit above feedback and import neither each other nor anything above them. Player damage sits above those two: it may compose enemy damage, because a hit the held hostage absorbs is enemy damage and must keep its single writer, and the composition runs through a returned outcome rather than a shared field. The area-impact executor sits above all three and is the only module that composes them. Executors sit on top. Nothing in the stack imports an executor, and no owner imports sideways or upward; the boundary checker holds every one of these directions.

Two placement rules keep the stack honest. Every mutation owner the rules call lives under a tree the fenced decision modules cannot import — which is why structure damage lives in the damage tree, not beside the floor it mutates: the floor tree stays queries and geometry precisely so the fenced trees may import it. And where one module unavoidably mixes queries with its own mutators, the import rule cannot separate its exports, so the contract types close the gap: every floor view a snapshot or behavior view carries is read-only-typed, and the floor module's mutating entries do not typecheck against it.

### The player attack slice

The snapshot carries: the player's pose; the resolved attack numbers (reach, damage, knockback, structure damage) already folded together from base values, blessings, and the equipped reward, so the progression layer vanishes from the resolver's world; the candidate bodies within a coarse radius, each with position, footprint, and material; the altar's position and remaining hits if it still stands; and a read-only-typed view of the floor for the ray that finds a breakable cell.

The resolver owns the rules a reviewer tunes: the sweep arc, nearest-first ordering, the everyone-in-the-arc cleave, the priority order (bodies, then the altar, then a breakable cell, then a miss), and where the swing visibly lands. It returns an ordered effect list — body hits with damage and shove, an altar strike, a structure strike, the landing point — and the executor applies each through the owners: enemy damage, structure damage, the altar's own resolution, and the feedback helpers. The dispatch is one exhaustive branch a reviewer reads once to know every consumer.

Throwing, shooting, and carrying stay executors: their decisions are dispatch on what the hand holds plus a short pure trajectory rule, and wrapping those in snapshots would add ceremony where there is nothing to review. The projectile and hazard flight paths likewise stay executors in this plan — they are relocated into their own modules and funneled through the owners, but their flight resolution keeps whole-state access, on the allowlist. Contract-izing them is real future work and deliberately not this plan's; the Goal claims only the two hotspots.

### The enemy behavior contract

The four seams of the absorbed plan stand: a family is asked to _open_ a committed attack, to run one frame of _telegraph_, to _release_ when the wind-up expires, and to run one frame of a _live_ attack that continues after release. A registry maps each intent in the closed intent vocabulary to its family module, typed total, so a missing row fails compilation — the same exhaustiveness guarantee the current dispatch gets from its closed-union checks, in registry form.

Each seam receives the narrow mutable self, a read-only view (the player's position, the floor, read-only-typed as above), and the frame's duration, and returns an ordered effect list: hurt the player, shove the player, spawn a shot, damage a structure cell, request a hazard probe on the ground reached, stun itself, raise feedback. The chassis — which keeps everything shared: timers, knockback, separation, pathing, steering, walking, the five-state decision frame, sight — is the world-aware executor that calls the seams and applies the effects in order.

Ordering is load-bearing and one worked example proves the contract: the charging family moves its own body along its committed lane (self), then returns, in order, a hazard probe for the ground it reached, a player hit and shove if it caught the player, and on a stall a structure hit, its dust, and its own stun — the same order the inline code applies today, with the stun expressed as an effect precisely because its place after the wall damage is part of the stated rules rather than an accident of inlining. None of the decisions reads the outcome of an earlier effect, so same-frame outcome independence holds even in the messiest family.

### The mutation owners

Enemy damage and death already have their single owner and it moves intact — and it gains the one entry that was missing: the held hostage's absorption of a hit, today five statements inside the player-hurt path that write the hostage's health, its flinch, the death record, and the kill count. That becomes the enemy-damage owner's hostage entry, which applies those writes and reports the outcome — survived, or killed with the salvage the burst leaves — so enemy state keeps exactly one writer. The hostage's death path is bespoke by design (no drop roll, no lifesteal, no pool interaction — the salvage is its drop) and the entry preserves it statement for statement rather than rerouting through the ordinary kill exit, which would change behavior.

Player damage — today a function living inside the enemy decision module, owning the hit flash, the hostage rule, the cheat gate, and the run's end — becomes its own owner, consuming the hostage entry's outcome to update what the hand holds. Structure damage — today three functions inside the player action module, called by player swings, charges, blasts, and shells alike — becomes its own owner in the damage tree. Run feedback becomes its own bottom owner module rather than a set of helpers on the state module, so the role really is decidable from the path. The area-impact module keeps its executors (blasts, shells, landings, hazard checks, drowning) and stops taking its collaborators as injected parameters, because with the owners extracted below it the injection that avoided a cycle is no longer needed.

One piece of state lives outside the run record by design: the bank of extracted rewards, which survives the run's destruction. It stays module-owned state, gains its owner's documentation, and is listed in the census like every other raw-state holder, so the one deliberate exception is a named one.

### The state module endgame

By the last children the state module's directory holds single-role files: the record and its component types with the pure reads and the id allocator (the record's own bookkeeping, named here so the role claim stays honest), the run transitions, prop placement, creation, floor population, the tick orchestrator, and one facade whose only job is compatibility for the layers outside this plan's scope. The blessing award moves to the progression tree it belongs to. The facade is for the outside: a checked rule forbids any rules-layer module from importing it, so the fences cannot be laundered through a re-export. Inside the rules layer every import names the concrete module.

### The reading contract, and what failure means

After this plan, reviewing a change to a hotspot decision means reading the slice's folder and its contract types, and nothing else — not because the rest is tidy, but because the boundary checker makes the rest unreachable from the slice. The acceptance criteria below make the escape hatch explicit: if a review of a slice change needs a file outside the slice and its contracts, the verdict is that a decision is misplaced, and the fix is moving the decision, never widening the contract.

### Children and landing order

| Child | Focus                                                                    | Form                       |
| ----- | ------------------------------------------------------------------------ | -------------------------- |
| 8     | Melee family, chassis de-branched                                        | This plan, Execution below |
| 9     | State module split: tick orchestrator, player movement, facade           | This plan, Execution below |
| 10    | Reward bank owner, census tightened, documentation, closing verification | This plan, Execution below |

Landing order: 1 through 10. Every child ends with the narrow checks its spec names — the typecheck, the linter, the boundary check, the census from child 1 onward, and the unit run — because the project reserves the aggregate gate for a branch merge, and a ten-child refactor validated only once at the end could not say which child broke it. The aggregate gate and the governance check run once at the close, before the merge. The judgement reserved for a person playing — that the game feels unchanged — is deliberately not a per-child gate, because it is exactly the judgement the continuous-execution guards forbid the loop to make; it is the plan's closing acceptance criterion, made once on the branch when the loop is done.

## Non-Goals

1. No presentation, runtime, or interface restructuring. Those layers keep reading the state record exactly as they do today, through the facade where implementation moved.
2. No regrouping or nesting of the state record's fields, and no snapshot types for the renderer or the interface. That work starts only after ownership is settled, as its own plan.
3. No snapshot-and-effect contract for the projectile, hazard, or emplacement paths. They are relocated and funneled through owners in this plan and remain allowlisted whole-state executors; narrowing them is a future plan.
4. No deep-read-only state type, no mutation-port layer for executors, and no syntax-tree write checker. These are the named escalation if the write census proves leaky, and they are deliberately not bought now.
5. No determinism, no injectable randomness, no replay. The random real-time core is a declared structural deviation and stays one.
6. No tuning changes, no new mechanics, no new attack families, and no behavior change to any enemy, weapon, or structure.
7. No event bus, no subscription mechanism, no middleware, and no generic component or query framework. The architecture is named modules calling named modules.

## Acceptance Criteria

1. The narrow checks a child's spec names pass for every child, and the aggregate verification gate and the governance check both pass once at the close of the plan, before the branch merge.
2. The boundary checker rejects a resolver or behavior module that imports the run state module, an owner, an executor, or the particle field; rejects an owner importing against the direction stack; and rejects a rules-layer module importing the compatibility facade — demonstrated by the rules being present and the gate green.
3. The census is a stage of the aggregate verification command and is runnable on its own, and its counts — whole-state parameters and direct mutations per module, in the forms Requirement 2 lists — end strictly below the recorded baseline, with every remaining holder on the allowlist. An increase fails the gate.
4. A change to the sweep arc, target priority, cleave rule, or reach handling is reviewable by reading the attack slice's folder and contract types alone; a change to one enemy family likewise touches its family module and the contract alone. Needing a third location is a failed cut, and the failure verdict is recorded rather than worked around.
5. After the enemy children, the chassis contains no family-specific code, a behavior module cannot name a field outside its narrow self type (judged by the type and one attempted compile), and adding a hypothetical fourth family requires one module and one registry row, with the omitted row failing compilation — judged by reading.
6. The two named spec files exist with the cases this plan names, under the test tree, and no other new test exists anywhere in the change.
7. One closing play session on the branch confirms the game unchanged: every swing outcome (bodies, altar, wall, miss), every throw kind, shooting, carrying and dropping — the hostage guard blessing included — each hunter type's telegraph and attack and recovery, the charger's wall stun, emplacement shells, drowning and the trench, extraction, and descent all behave as before. This is the plan's one human judgement and it closes the plan.
8. Every moved region's comments are in plain register.

## Execution

Perishable coordinates, recorded 2026-08-04 at commit 0d21f83 on branch `core-ownership-refactor`. Re-check against live code before executing each child; conflicts resolve in favor of the conceptual half. Each child ends with the narrow checks its spec names — `npm run typecheck`, `npm run lint`, `npm run check:boundaries`, `npm run check:ownership` from child 1 onward, and `npm run test` — followed by one commit on the branch following the commit rules. Formatting is kept clean by running the formatter's write mode over the files a child touched, which is a fix rather than a gate. `npm run verify` and `npm run check:governance` run once in child 10, before the branch merge.

Raw-state census baseline (occurrences of the `World` token per module, `rg -c '\bWorld\b' src`): world.ts 20, simulation.ts 25, actions.ts 26, enemy-ai.ts 21, impacts.ts 15, death.ts 5, extraction.ts 6, tasks.ts 5, floor/rooms.ts 4, plus permanent holders outside core (runtime/surface.ts 10, runtime/scene-hooks.ts 5, runtime/dev-overlay.ts 1, app and presentation modules per the current count of 209 across 25 files). The checker records two numbers per file from the live tree: parameter-position uses (`world: World`) and direct mutations in the forms Requirement 2 lists, on paths rooted at the state parameter; child 1 writes the baseline table.

### Child 8 — melee family, chassis de-branched

- Relocate `shortestTurn` (155) to `src/core/floor/movement.ts` (steering math; the chassis re-imports).
- New `src/core/enemy/behaviors/melee.ts`: rewrite `honeBlade` (284), `releaseBlade` (312), and the melee release branch of `stepWindup` (546–563) — cone test from self facing and view player position, player-hit effect, feedback effects for the ember bursts.
- Chassis cleanup: `stepWindup` and `beginAttack` lose their per-intent branches; the registry is the only dispatch. Rename `enemy-ai.ts` → `src/core/enemy/chassis.ts`; census updates. Add the melee release cone cases (in-cone hit, out-of-cone miss) to the spec file — this closes it at five cases.

### Child 9 — state module split, facade

- New `src/core/player/movement.ts`: move `stepPlayer` (simulation.ts:133) and `crowdPace` (110).
- New `src/core/world/step-world.ts`: move `stepWorld` (848), `descend` (820), `stepRunLevel` (836), `stepVfx` (657), `stepDamageMarks` (796), `stepDeaths` (806), `DEATH_SECONDS` and remaining tick constants; delete `simulation.ts`; runtime import updates are import-path-only.
- Split `world.ts` into single-role files: `src/core/world/state.ts` (the record, component types, rule constants, pure reads, and the id allocator — the record's own bookkeeping); `src/core/world/run-transition.ts` (`endRun` 725, `runClockSeconds` 736); `src/core/world/props.ts` (`dropProp` 791 — prop placement; under the world tree because the floor tree must stay owner-free); `src/core/progression/award-bless.ts` (`awardBless` 713 — a progression grant, not run state); `src/core/world/create-world.ts` (`createWorld` 589); `src/core/world/populate-floor.ts` (`populateFloor` 512, `createEnemy` 445, `spawnReinforcement` 690, `flattenFloorForTesting` 662, `collectMortars` 422 and the spawn helpers); `src/core/world/index.ts` — the compatibility facade re-exporting what the outside layers import today, forbidden to core by the rule declared in child 1, which starts biting here. Core-internal imports all name concrete modules in this child.
- Census updates for every renamed path.

### Child 10 — reward bank, census tightened, closing

- New `src/core/progression/rewards-bank.ts`: move the module-level bank and its accessors (sealed.ts:97–129) and the last-extraction record (extraction.ts:35, 96); both source modules re-export. The owner's documentation names the run-boundary lifetime as the reason for module state.
- Census: rewrite the allowlist to the end-state (state, run-transition, props, step-world, create and populate, chassis, damage owners, feedback, projectile and hazard steppers, extraction, tasks, rooms, executors; resolvers and behaviors at zero), assert both totals strictly below baseline, and record before/after totals in the closeout.
- Documentation: addendum's core row updated to the landed structure; `CHANGELOG.md` entry per the closeout standard.
- Closing verification, the plan's one aggregate run: `npm run verify` (census stage included), `npm run check:governance`, and a capture run (`npm run capture`) for the user's play pass; the play pass itself is the user's, per acceptance criterion 7.

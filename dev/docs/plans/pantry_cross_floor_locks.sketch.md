# Cross-Floor Locks

Parent Plan: none (standalone sketch)

## Goal

Explore letting the generator place a key on one floor and the door it opens on a later floor, so generated candidates can gate progress across the floor sequence instead of only within a single floor. This exists as its own artifact because the algorithm is the hard part, and discovering that in the middle of other generator work would stall it.

## Requirements

1. A generated candidate can gate progress with a key on one floor and a matching door on a later floor, because confining every lock to a single floor limits generated layouts to a shape the real design does not use.
2. Every generated candidate still reaches the author already proven structurally solvable. This is the property the current per-floor construction guarantees, and losing it would make generated content untrustworthy rather than merely different.
3. Generation stays deterministic for a given set of inputs, since determinism is the project's load-bearing property and any added search or retry must remain a pure function of those inputs.
4. Generation cost and failure behavior at realistic densities are measured and stated rather than discovered later, because the existing fixed attempt ceiling becomes the real constraint the moment failures stop being rare.

## Summary

Runtime already supports cross-floor locks. Keys are run-state inventory rather than per-floor objects, and the structural validator's search already carries collected keys and opened doors across floor transitions, so a hand-authored candidate with a key on an early floor and a matching door on a later one validates today. Nothing in the content contract forbids it.

What does not support it is the **generator's construction guarantee**. Today that guarantee is per floor: a gate door sits on that floor's required route and its matching key is placed in the region still reachable on the same floor while that gate and every later gate are closed. That local argument is what makes every generated candidate solvable without search. Extending gating across floors replaces it with a whole-sequence argument, and the naive version of that argument is wrong in a way that is easy to miss: a key placed on an earlier floor is only genuinely reachable if it is reachable _before_ the player is required to pass the door it opens, which depends on the order the floors are traversed and on the other gates on both floors.

The favored direction is to keep the existing per-floor guarantee as the base case and add cross-floor pairs as a bounded extension on top of the allocation layer that `pantry_authoring_04` introduces — rather than replacing the local argument with a global search. Whether that extension can stay a constructive argument or has to fall back on the validator as an oracle is exactly what this sketch cannot yet settle, and is the first thing the spec author must resolve.

This is a standalone sketch. The work is generator construction rather than authoring interface, so no current plan owns it. Its one hard dependency is already satisfied: the shipped generator work introduced the allocation layer this builds on, so nothing blocks a spec.

## Sketch

### What can be relied on

- Keys are inventory in run state, not floor-scoped, so carrying a key downward already works at runtime. Verify there is no per-floor key reset anywhere in the run state.
- The validator's topology search already tracks collected keys and opened doors across floors and is the existing oracle for whether a candidate is solvable. The generator already calls it per attempt and reseeds on failure.
- The shipped generator now has an allocation layer above per-floor placement, which converts candidate-wide per-color totals into per-floor counts as matched same-color pairs. That seam is the natural place for a cross-floor pair to be expressed, because allocation is already the step that decides which floor gets which lock. Verify its current shape before designing on top of it.

### Candidate approaches

- **Ordered-prefix placement.** Allocate a cross-floor pair by choosing the door's floor first, then placing the key on any earlier floor in a region reachable before that floor's own gates. This keeps a constructive argument, but the argument now has to compose across floors, and it needs the traversal order between floors to be fixed and known.
- **Generate-then-verify with bounded retry.** Allocate cross-floor pairs freely, rely on the existing validator to reject unsolvable candidates, and reseed. Much simpler to write and clearly correct, but it converts a guarantee into a search and could raise generation cost sharply at higher densities. The existing search-budget error path already exists and would need to stay meaningful.
- **Hybrid.** Keep same-floor pairs constructive, allow a bounded number of cross-floor pairs, and let the validator catch the residual risk. Probably the best cost-to-risk trade, but the bound is a number nobody has evidence for yet.

### Risks and seams to inspect

- The stair graph defines traversal order, and stairs already link by destination identity with many-to-one links permitted. A cross-floor argument that assumes a simple linear floor order may be wrong for any candidate whose stairs are not a simple chain. Verify what orders the generator can actually produce.
- Spare doors currently land only on dead ends specifically so they can never seal a key away. The equivalent hazard across floors is a door that seals a stair, which would strand the player. Check whether any current rule prevents a door on a stair cell.
- The generator's reseed path treats failure as "try another seed". If cross-floor pairs make failures common rather than rare, the fixed attempt ceiling becomes the real constraint and its error message stops being accurate.
- Determinism must hold. Any added search or retry has to remain a pure function of the inputs.

### Candidate files to inspect

- The offline generator, for the allocation layer, the per-floor gating argument, the dead-end spare rule, and the attempt ceiling.
- The floor validator's topology search, for the cross-floor state it already carries and its search budget.
- The floor content schema, for stair linking and whether anything constrains a door's cell relative to a stair.

## Non-Goals

1. Do not change the runtime key or door rules; this is generator construction only.
2. Do not add new key colors or change what a color means.
3. Do not fold generator dimensions or totals into this work; `pantry_authoring_04` owns them. Start and end markers belong to `pantry_start_and_end_markers.sketch.md`.
4. Do not weaken the requirement that a generated candidate is structurally solvable before it is handed to an author.
5. Do not treat this sketch's codebase claims or candidate approaches as decided; the spec author verifies and chooses.

## Acceptance Criteria

1. A generated candidate can place a key on one floor and a door it opens on a later floor.
2. Every generated candidate still passes structural validation with a solution before it reaches the author.
3. Generation stays deterministic for a given set of inputs.
4. Generation cost and failure behavior at the densities an author actually uses are known and stated, rather than discovered later.

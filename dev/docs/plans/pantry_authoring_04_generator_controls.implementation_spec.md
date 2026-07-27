# Generator Dimensions and Per-Color Counts

Parent Plan: `pantry_authoring.plan.md`

## Goal

Let the floor-set generator produce candidates at an author-chosen odd width and height, and turn its per-floor key, door, and enemy counts into per-color candidate totals. Today every generated floor is 13 by 13 with one key and one door of a randomly chosen color, and every count multiplies by the floor count, so an author can neither ask for a specific color balance nor state an absolute lock budget.

## Summary

The generator's fixed 13-cell square becomes a per-call geometry. Width and height are supplied independently, must both be odd and at least 5, and apply to every floor in that candidate. Odd values keep the bordered maze's node lattice well-defined; the minimum of 5 excludes the degenerate 3-cell case whose interior is a single cell with no route and no room for a gate. No maximum is imposed — the structural validator's existing search-budget error already reports when a requested size and density cannot be solved.

Every count becomes a total for the whole candidate instead of a figure applied to each floor. Keys and doors are counted per color; enemies keep one count. A new allocation step distributes those totals across the candidate's floors, deterministically from the seed, and each floor is then placed with its own allocation using the existing algorithm. This is what makes the numbers mean what they say: a per-floor count silently multiplies by floor count, so "three red doors" produced thirty of them on a ten-floor candidate.

Keys and doors are allocated as matching same-color pairs wherever both are available, which keeps every floor solvable on its own and preserves the current solvable-by-construction property. Within a floor, each color still gates as many doors as it has matching keys on that floor: gate doors sit on the required route with their key placed in the region still reachable while that door and every later gate stay closed. A leftover door with no same-color key on its floor becomes a dead-end spare, and a leftover key is scattered in reachable space. A key that opens a door on a different floor stays out of scope and is explored by `pantry_cross_floor_locks.sketch.md`.

Defaults become absolute rather than floor-count-dependent: one key and one door of each color, and one enemy, for the entire candidate. On the current five-floor default this is a genuine density reduction — three locked floors instead of five — which is the point of the change rather than a side effect. The goal enemy on the deepest floor is structural and is not drawn from the enemy total.

The Workbench generator panel gains width and height fields plus, for each color, a key count, a door count, and a link toggle. Every link toggle starts engaged: editing either count while linked writes both. Unlinking restores the independent pair the color last held rather than leaving both stuck at the linked value, so an author can experiment with a linked number without destroying an earlier asymmetric setting. Every count control is labelled as a candidate total so no control is ambiguous about its unit.

The flat `keysPerFloor`, `doorsPerFloor`, and `enemiesPerFloor` inputs are removed rather than kept alongside the new form. This is development-only tooling with no external consumer, and two live count contracts would only raise the question of which one wins.

## Relational Context

- The generator is the sole owner of candidate geometry, allocation, and placement. The authoring API validates and forwards request fields; it never computes allocation or substitutes its own defaults for geometry.
- Floor dimensions become a value threaded through maze carving, room carving, traversal, index conversion, and tile rendering. The current module-level size constant is the single source those helpers read today, and every one of them must take geometry explicitly instead — index math changes from one edge length to separate width and height, so leaving any helper on the old constant silently corrupts coordinates rather than failing loudly.
- Allocation is a new step that sits strictly above placement: it converts candidate totals into per-floor counts, and placement keeps its current per-floor contract unchanged. Keeping that seam clean is what lets this child preserve the existing solvability guarantee instead of redesigning it, and it is the seam the cross-floor-locks sketch will later extend.
- The solvability guarantee lives in the ordering between gate doors and their keys within one floor, not in the counts. Allocation must therefore hand out same-color key and door pairs rather than independent per-color quantities; placement must keep each key in the region reachable while its own gate and all later gates are closed, and spare doors must continue to land only on dead ends so they can never seal a key away.
- Generated output for a given seed will differ from today's output. That is acceptable because generated candidates are drafts, never canonical content, and nothing regenerates the canonical floor set as part of verification.
- The Workbench remains the owner of its control state, including each color's remembered independent pair. The generator receives resolved numbers and knows nothing about link toggles.
- The command-line generator and the Workbench are peer callers of the same generation entry point. Both must move to the per-color shape in the same change, because the flat fields disappear.
- Per-floor manual resizing is unaffected. Generated dimensions seed a candidate; the existing resize path continues to own later per-floor changes.

## Scope

### Included

- Independent odd width and height for a generated candidate, validated at the generation boundary.
- Per-color key and door totals plus an enemy total, replacing the per-floor counts.
- A deterministic allocation step distributing totals across floors as same-color key and door pairs.
- Authoring API and command-line surfaces updated to the totals and geometry shape.
- Workbench dimension fields, per-color total fields with unit-explicit labels, and default-engaged link toggles with remembered independent values.
- Focused generator tests plus aggregate verification.

### Excluded

- Any fourth key color, variable palette sizing, or new gameplay meaning for a color.
- Per-color enemy totals; enemies keep a single total.
- A key on one floor opening a door on another floor, which `pantry_cross_floor_locks.sketch.md` explores.
- Per-floor differing dimensions inside one generated candidate.
- Changes to manual resizing, terrain painting, entity editing, or environment-feature editing.
- Authorable start and end markers, which `pantry_start_and_end_markers.sketch.md` explores.
- Regenerating or otherwise modifying canonical floor content.

## Files to Change

| File                                              | Change Size | Purpose                                                                                    |
| ------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `dev/tools/floor-set/generator.ts`                | Large       | Thread geometry through carving and placement, and add the allocation layer above them.    |
| `dev/tools/floor-set/authoring-api.ts`            | Small       | Accept and validate geometry and per-color totals in the generate request.                 |
| `dev/tools/generate-floor-set.ts`                 | Medium      | Replace the per-floor count flags with geometry and per-color total flags.                 |
| `src/app/debug/floor-workbench.ts`                | Medium      | Own dimension fields, per-color total fields, link-toggle state, and the request it sends. |
| `src/app/debug/debug.css`                         | Small       | Group the enlarged generator control set so it stays readable at narrow widths.            |
| `test/unit/dev/tools/floor-set/generator.test.ts` | Medium      | Prove geometry validation, exact totals, allocation spread, and retained solvability.      |

## Execution Outline

1. Thread geometry through the generator's pure helpers and add its validation, keeping the existing per-floor counts working, so the coordinate change is provable on its own before count semantics move.
2. Add the allocation step and switch the option shape to per-color totals, leaving per-floor placement untouched beneath it, then update the generator tests to cover geometry, totals, allocation, and the retained solvability guarantee.
3. Update the authoring API request shape and the command-line flags together, since the per-floor fields disappear in step 2 and both callers break until they move.
4. Rebuild the Workbench generator panel with dimension fields, unit-labelled total fields, and link toggles that remember each color's independent pair.
5. Add the grouping styles, run focused tests and `npm run verify`, then manually review the generator panel for keyboard and narrow-width behavior.

## Implementation Notes

- **Geometry.** Reject non-integer, even, or below-minimum dimensions before any carving runs. Room carving currently derives its origin range from one edge length and picks a room size that assumes a 13-cell interior; both need per-axis ranges and a room size clamped to fit the smaller interior dimension, or a narrow candidate will carve rooms through its border.
- **Allocation.** Spread each color's paired keys and doors across floors rather than filling the first floors first, and pick which floors receive them deterministically from the seed so the same inputs always allocate identically. When a total is smaller than the floor count, the floors that receive nothing must not always be the same ones. Allocate the matched-pair minimum of each color's key and door totals first, then distribute the leftovers of whichever side is larger.
- **Per-floor gating.** Unchanged beneath allocation: each color's gate count on a floor is the smaller of its allocated door and key counts there, all colors' gates draw from the same route so gates stay ordered along it, and the floor's total gate count still cannot exceed the route's interior length.
- **Defaults.** Omitted totals resolve to one key and one door of each color plus one enemy for the whole candidate. This lowers default density compared with today's per-floor behavior, which is intended.
- **Link toggles.** Each color owns three pieces of state: its key total, its door total, and the independent pair remembered from before the current link engagement. Engaging a link does not discard that pair.
- **Exact totals.** A requested total is honored exactly or generation fails; it is never quietly under-filled. The current spare-door loop stops early when it runs out of dead ends, which silently places fewer doors than asked. That is tolerable for a per-floor count but defeats the purpose of a total, so it must become an exhaustion signal that feeds the existing reseed path.
- **Command line.** Per-color total flags replace `--keys` and `--doors`, and the enemy flag changes meaning from per-floor to total. Update the usage text in the same change; a stale usage string is the only documentation this tool has.

## Edge Cases

| Case                                                         | Expected Handling                                                                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An even, fractional, or below-minimum dimension is requested | Reject before generating, naming the odd-and-at-least-five rule.                                                                                        |
| A color has more doors than keys                             | Allocate matched pairs first; each leftover door becomes a dead-end spare.                                                                              |
| A color has more keys than doors                             | Allocate matched pairs first; each leftover key is placed in reachable space.                                                                           |
| A total is smaller than the floor count                      | Some floors receive nothing; which ones is seed-determined, not always the first.                                                                       |
| A total exceeds what the floors can hold                     | Signal exhaustion so the existing reseed runs, then fail with the existing error naming the totals to lower. Never silently place fewer than requested. |
| Every total is zero                                          | Generate a floor set with stairs and the goal but no locks and no non-goal enemies.                                                                     |
| Requested density or size exceeds the validator's budget     | Surface the existing search-budget error naming the counts to lower.                                                                                    |
| A link toggle is disengaged after being driven to one value  | Restore that color's remembered independent pair rather than leaving both values equal.                                                                 |
| A generated candidate is later resized per floor             | Manual resizing continues to apply, unaffected by the generated dimensions.                                                                             |

## Acceptance Criteria

1. An author can generate a candidate at a chosen odd width and height, defaulting to 13 by 13, with every floor in that candidate using those dimensions.
2. Even, fractional, or too-small dimensions are refused with an explanation instead of producing a malformed candidate.
3. Red, blue, and yellow key and door totals are set independently, and a generated candidate contains exactly those totals across all its floors regardless of how many floors were requested.
4. The enemy total likewise describes the whole candidate, with the deepest floor's goal enemy excluded from it.
5. Each color's link toggle starts engaged, keeps that color's key and door totals equal without duplicate entry, and restores the previously remembered independent values when disengaged.
6. Generated candidates remain deterministic for a given set of inputs and continue to pass structural validation with a solution.
7. A color configured with more doors than keys never blocks the required route with the excess.
8. Every count control states whether it is a total, leaving no control ambiguous about its unit.
9. Every floor in a generated candidate remains independently resizable afterward.

# Core Ownership Refactor — Child 1: Gates

Parent Plan: `core_ownership_refactor.plan.md`

## Goal

Put the machine enforcement in place before any rules-layer code moves: the import boundaries that fence the decision modules and order the mutation owners, and a raw-state access census that records today's counts and refuses an increase. Nothing under `src/` changes behavior in this child; what changes is what the repository will refuse from here on.

## Summary

This child buys the guarantee every later child depends on. The plan's central lesson is that a corpus teaches by example, so a gate added after the rewrite would arrive too late to stop the next change imitating the shape being removed.

Three things land:

- **Import boundaries.** New dependency-cruiser rules declare two fenced trees that do not exist yet — the player attack slice and the enemy behavior families — and forbid them from reaching run state, the mutation owners, the particle field, or progression, type-only imports included. A second group orders the owners into a one-way stack so a damage owner cannot grow a sideways or upward dependency. A third rule forbids any rules-layer module from importing the compatibility facade that child 9 creates, so the fences cannot be laundered through a re-export. Declaring rules ahead of the directories they govern is the config's existing habit for layers not yet earned.
- **The census.** A new Node checker counts, per source file, how many parameters take the whole run state and how many direct mutations are made through it — assignments and compound assignments on any state-rooted path, increments and decrements, and the mutating collection calls. It compares those counts against a recorded allowlist and fails on any increase or any unlisted file. It is honest about being a census rather than a boundary: a local alias escapes the count, which is why the hard limits live in the import rules and the contract types instead.
- **A command for it.** The census becomes an npm script and a stage of the aggregate gate, so it reaches the branch-merge gate automatically while staying runnable on its own — which is how every later child checks itself under this project's validation contract.

The result is a repository where the later children's fences already exist and the census baseline is recorded, so the first module that tries to widen raw-state access fails a check rather than passing review.

## Relational Context

- The cruiser config's header states that its rules restate boundaries owned by the platform project-structure standard and the project's structure addendum, and that changing one without the other leaves two disagreeing sources of truth. Any rule added here is therefore added to the addendum in the same change.
- Dependency-cruiser rules are declared against path patterns, not against existing directories. The config already declares rules for `platform/` and `shared/`, which do not exist, precisely so earning a layer later starts from an enforced boundary. The fenced trees in this child follow that precedent and are inert until children 3 and 6 create them.
- `tsPreCompilationDeps: true` is already set in the config, which is what makes a type-only import visible to the checker. The fence rules depend on it: without it, the run state type could reach a resolver through a signature with no rule firing.
- The command surface standard owns the aggregate gate's stage list and permits a consumer-verification stage to be prepended before stage 1. It does not sanction inserting a project stage between the required stages. The plan's Execution note places the census after the boundary check; that is a "where" the conceptual half leaves open, so the standard's sanctioned position wins.
- The project's validation contract reserves the aggregate gate for a branch merge and otherwise runs only what an approved spec names. That is why the census needs its own script rather than existing solely as a stage: every later child runs it directly.
- The census checker is an offline tool and an executable entrypoint, so it sits directly under the tooling tree rather than in a named subdirectory. The tooling tree may import core and content through the path alias; this checker reads files as text and imports nothing from `src/`.
- The governance checker is Python and runs outside the aggregate gate. The census must not be added to it: ordinary source changes never run the governance check, so a census living there would not see the changes it exists to measure.
- The allowlist records two numbers per file. Later children shrink entries and re-point paths as modules move; the file is expected to be edited by every child, and a count that drops is edited down rather than left slack.

## Scope

### Included

- New dependency-cruiser rules: the two decision fences, the owner direction stack, and the facade rule.
- A new census checker, its allowlist recorded from the live tree, and its npm script.
- The census as a prepended stage of the aggregate gate.
- The structure addendum's core row extended with the role vocabulary, the owner stack, and the fenced trees.

### Excluded

- Every source move. No file under `src/` is created, moved, or edited in this child.
- Any deep-read-only state type, mutation-port layer, or syntax-tree write checker. Those are the plan's named escalation and are deliberately not bought.
- Any change to the governance checker's contract map.

## Files to Change

| File                                          | Change Size | Purpose                                                          |
| --------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `.dependency-cruiser.cjs`                     | Medium      | The fences, the owner direction stack, and the facade rule       |
| `dev/tools/check-ownership.mjs`               | Medium      | New census checker, counting parameters and direct mutations     |
| `dev/standards/raw_world_allowlist.json`      | Small       | The recorded baseline the ratchet compares against               |
| `package.json`                                | Small       | The census script, and the gate stage that carries it to a merge |
| `dev/standards/project_structure.addendum.md` | Small       | Role vocabulary, owner stack, and fenced trees, per the header   |

## Execution Outline

1. Write the census checker and run it in a report mode against the live tree, so the baseline is measured rather than transcribed from the plan.
2. Record the measured counts as the allowlist, then confirm the checker passes against the tree it was measured from.
3. Add the npm script and prepend the gate stage.
4. Add the cruiser rules and confirm the boundary check still passes, since no source file exists in the fenced trees yet.
5. Extend the structure addendum in the same change, per the cruiser header's two-sources rule.
6. Run the narrow checks this spec names.

## Implementation Notes

- **Counting.** A parameter use is the state type appearing in a parameter position. A direct mutation is one of: an assignment or compound assignment whose left side is a state-rooted path, an increment or decrement of such a path, or a mutating collection call on one. Bracket access counts as path segments. Comparison operators must not be read as assignment.
- **Scope of the walk.** Source files under `src/` only. The checker never reads the test tree or the tooling tree, because the ratchet is about the shipped module graph.
- **The fenced-tree rule inside the checker.** The executor of the attack slice is exempt: it is the module that holds raw state on that slice's behalf, and the import fence exempts it for the same reason. The behavior tree has no exemption.
- **Failure output.** Report the file, both counts, and the allowlist's numbers, so a failure names what grew. Print a single summary line on success in the style the other checkers use.
- **Absent directories.** Both fenced trees and several allowlisted paths will not exist until later children. Absence is not a failure; a missing allowlist entry for a file that has counts is.

## Edge Cases

| Case                                                            | Expected Handling                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A file's counts drop below its allowlist entry                  | Passes. The ratchet forbids increases, and later children edit the entry down |
| A source file with counts is absent from the allowlist          | Fails, naming the file — this is how a new whole-state module is caught       |
| An allowlist entry names a file that no longer exists           | Passes, and is reported, since children move modules constantly               |
| The state type reaches a fenced tree through a type-only import | The boundary check fails, because pre-compilation dependencies are tracked    |
| A fenced directory does not exist yet                           | Both checks pass with nothing to say                                          |

## Acceptance Criteria

1. The census reports a measured baseline for every source module that holds whole-state access, and passes against the tree it was measured from.
2. Adding a whole-state parameter or a state-rooted mutation to any counted module fails the census; removing one passes.
3. The census is runnable as its own command and is carried into the aggregate gate as a stage.
4. The import rules for the two decision fences, the owner direction stack, and the compatibility facade are declared and pass against the current tree.
5. The structure addendum states the role vocabulary, the owner direction stack, and the fenced trees, so the boundary rules and their documentation agree.
6. No file under the source tree is created, moved, or edited.

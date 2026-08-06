# Sandbox Track

Pantry Depths runs two named development tracks. The **formal track** is the default: the foundation work lifecycle, the platform standards, and this project's addenda, applied as written, aimed at data-driven, robust outcomes that are expected to survive. The **sandbox track** is the declared exception for work whose value is speed and learning rather than survival: experiments, spikes, and rushed or disposable features.

This file owns the track vocabulary and the selection rule, and routes to the owners of everything else. Each operating rule of the sandbox track lives with its domain owner in the table below; this file links and does not restate.

## Selection

Work belongs on the sandbox track when all three hold:

1. **It is allowed to die.** Deleting the whole folder is an acceptable ending, and nothing outside the folder would need repair afterwards.
2. **Its acceptance is that the feature runs.** It is judged by opening it and using it, not by robustness, coverage, or data-driven shape. Brute-force branch enumeration is welcome here — note that it does not even bend `dev/standards/code_style.addendum.md`, whose `assertNever` tail applies as written and costs nothing.
3. **It fits inside one folder.** The work is self-contained under `src/sandbox/<experiment>/`, reaching outward only through read-only imports of `src/core/` and `src/content/`.

Everything else is formal track. Formal is the default, and doubt resolves to formal: a piece of work that wants sandbox speed but fails a condition above is formal work that has not been decomposed yet.

The track is chosen per piece of work, at the moment the work is scoped. It is not a property of a session, an author, or a deadline.

## Rule Owners

| Concern                                                                                           | Owner                                         |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| The `src/sandbox/` tree, import boundaries, debug-hub wiring, production exclusion, graduation    | `dev/standards/project_structure.addendum.md` |
| Test discipline per track: the browser-test ban, the sandbox unit-test budget, the machine guards | `dev/agent_rules/test_operations.md`          |
| The short `/implement` handoff and minimal tracking                                                | `dev/agent_rules/implement_operations.md`     |
| Lifecycle routing                                                                                  | `dev/standards/work_lifecycle.addendum.md`    |
| Continuous execution across plan children                                                         | `dev/workflows/continuous_plan_execution.md`  |

## What The Track Never Relaxes

- **The branch-merge gate still applies.** Sandbox work does not run `npm run verify` for ordinary edits or delivery, but it does not bypass the aggregate gate immediately before its branch is merged.
- **Production exclusion.** A sandbox experiment is development-only, entered through the `/debug` hub, and never reachable from the production module graph.
- **User-authority boundaries.** The foundation `/implement` conditional stops and `dev/workflows/continuous_plan_execution.md` apply unchanged.

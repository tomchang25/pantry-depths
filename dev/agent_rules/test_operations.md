# Test Operations

This file is the authoritative project-local test and validation contract for Pantry Depths. Every agent-run static check, unit test, build, browser check, or delivery gate follows this file.

## The Gate

`npm run verify` before delivering a change. That is the whole gate.

It runs, in order and stopping on first failure: `format:check` → `typecheck` → `lint` → `check:boundaries` → `test` → `build`. Pass criterion is exit code 0 with no stage skipped. Never pipe a stage through a filter that replaces its exit status — a layer's result is the exit code of its command, never a filtered view of its output.

Run `npm run check:governance` as well whenever a governance, startup, or planning document changes. It is outside `verify` and passes when it prints both `governance: OK` and `foundation: OK`.

## Two Halves, Two Disciplines

The repository is not uniform, and the contract should not pretend otherwise.

| Half                                                                              | Discipline                                                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **The demo** — `src/demo/`, `src/presentation/`                                   | Verified by playing it. No automated tests, ever.                                                 |
| **Everything else** — `src/core/`, `src/content/`, `src/app/debug/`, `dev/tools/` | Keeps the coverage it already has. Growing that coverage needs permission — see the next section. |

Every test in `test/` today covers the second half. That is deliberate, not an omission: the demo is a real-time surface whose value is how it feels, and the cheapest honest check on it is a person playing it. Do not add tests to `src/demo/` or `src/presentation/` to satisfy a coverage instinct.

That paragraph was prose for as long as it was ignored. It is now enforced by `test/unit/repository/demo-half-is-untested.test.ts`, which fails the unit stage — and therefore `verify` — when any test file imports `@/demo/` or `@/presentation/`. The guard holds one frozen exemption, the presentation asset loader, and it does not grow. Do not add yourself to it, and do not move a banned test somewhere the guard cannot see it; the check is on what a test imports, not where it sits.

What the ban costs is worth naming, because the temptation returns every time: the presentation suite that prompted the guard asserted that a skeleton facing world `+Y`, seen from a camera looking east, renders its direction row 2. That was true of the code and wrong in the game — the direction wheel was mirrored — so the test had taken a rendering bug and written it down as the specification. A test against the demo does not catch that class of error; it preserves it.

## No New Test Without Being Asked For One

Adding a test is forbidden by default. A new test file, or a new case inside an existing one, requires the user to ask for it explicitly and in as many words, for that change. Nothing else grants it: not a rule elsewhere in this document that reads as though some layer ought to be covered, not a boundary that has no other observer, not the cheapness of the test, not the risk of the change. Absent the sentence, the answer is no — say what is untested and move on.

Updating or deleting a test whose subject a change moved is not adding one and needs no permission. That is the section below.

This section exists because the opposite reading produced three browser specs for the workbenches, each written from a line here that said `src/app/debug/` had no cheaper observing layer. They are deleted. A workbench is verified by opening it, which is the only way its actual subject — whether the thing on screen looks right — can be judged at all.

## When A Test Breaks

A test breaks for one of two reasons, and they have opposite answers.

**The change is wrong.** Fix the change.

**The test's subject was deliberately changed or deleted.** Then the test is describing a past the project has left. Update it to the new truth, or delete it. Do not preserve the old assertion by widening it, adding a branch for the new behaviour, or wrapping it in a conditional — a test kept alive that way records nothing and costs attention forever.

Deleting a test alongside the code it covered is a normal part of a change, not a loss to be justified.

## Environment

- Package manager `npm`; Node `>=22.12` (developed on v24.18.0). Install with `npm install` at the repository root. No network access is required after install.
- `npm run check:governance` additionally requires Python 3 on `PATH` (developed on 3.14.6).
- `npm run test:e2e` additionally requires the Chromium build Playwright pins, installed once with `npx playwright install chromium`. Do not install it unless browser coverage is actually being run.
- The Vite dev server binds `http://localhost:5273` with `strictPort`. **Treat every listener on that port as user-owned**, including a development server or a test run. Never stop, restart, or reconfigure it to make a command run. Playwright reuses a server it finds there; when the port is occupied by something that is not this project's dev server, set `PLAYWRIGHT_PORT=<available-port>` for that one invocation instead of editing `vite.config.ts` or `playwright.config.ts`.

## Individual Layers

Use these when iterating; `verify` is what proves the change is deliverable.

| Layer            | Command                      | Notes                                                                                            |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Format           | `npm run format:check`       | `npx prettier --write <paths>` to fix                                                            |
| Typecheck        | `npm run typecheck`          |                                                                                                  |
| Lint             | `npm run lint`               | Passes at 0 errors; warnings are reported and do not fail                                        |
| Import boundary  | `npm run check:boundaries`   | Passes at 0 errors; a new warning is worth a sentence                                            |
| Unit             | `npm run test`               |                                                                                                  |
| Production build | `npm run build`              |                                                                                                  |
| Governance       | `npm run check:governance`   | Outside `verify`                                                                                 |
| Floor content    | `npm run validate:floor-set` | Passes when the selected floor-set JSON has no error findings and yields one structural solution |
| Browser E2E      | `npm run test:e2e`           | Outside `verify`; scope is narrow — see below                                                    |

Expected noise: `vitest` prints its include/exclude summary when no test file matches, and `depcruise` prints a module and dependency count on success. Playwright writes `playwright-report/` and `test-results/`; both are ignored by Git.

## Browser Acceptance Scope

One spec, `test/e2e/debug-route.spec.ts`: the debug hub boots and opens a lazily loaded tool through a full-document navigation. That is the entire browser layer and it is not a template for a second one.

`npm run test:e2e` runs it, outside `verify`. A browser-launch failure is an environment problem, not an application failure, and must be reported as such.

Nothing else in `src/app/debug/` is a browser-test subject. A workbench is verified by opening it and looking, for the same reason the demo is: what it is for is whether the picture is right, and an assertion about a picture records whatever the renderer happened to be doing that day.

Should a spec ever be asked for, it may not press **Save Canonical JSON** or otherwise invoke the authoring endpoint's `save` operation: it overwrites authored content in the working tree.

The demo is not, and is not expected to become, a browser-test subject.

## Reporting

State which layers actually ran and what they returned. If something failed, say so with the output; if a step was skipped, say that.

`npm run verify` says nothing about `npm run test:e2e` or `npm run check:governance` — report them separately and never let one stand in for another.

A manual playtest report says what was played, what happened, and which of the change's intended outcomes the run confirmed or contradicted. It does not measure the run against `dev/docs/design/` or `dev/docs/reports/`; both are frozen and `dev/standards/frozen_reference_directories.md` forbids citing them.

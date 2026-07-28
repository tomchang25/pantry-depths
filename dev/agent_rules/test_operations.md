# Test Operations

This file is the authoritative project-local test and validation contract for Pantry Depths. Every agent-run static check, unit test, build, browser check, or delivery gate follows this file.

## The Gate

`npm run verify` before delivering a change. That is the whole gate.

It runs, in order and stopping on first failure: `format:check` → `typecheck` → `lint` → `check:boundaries` → `test` → `build`. Pass criterion is exit code 0 with no stage skipped. Never pipe a stage through a filter that replaces its exit status — a layer's result is the exit code of its command, never a filtered view of its output.

Run `npm run check:governance` as well whenever a governance, startup, or planning document changes. It is outside `verify` and passes when it prints both `governance: OK` and `foundation: OK`.

## Two Halves, Two Disciplines

The repository is not uniform, and the contract should not pretend otherwise.

| Half                                                                                              | Discipline                                                                                |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **The demo** — `src/demo/`, `src/presentation/`                                                   | Verified by playing it. No new automated tests are expected or required.                  |
| **Everything else** — `src/core/`, `src/content/`, `src/harness/`, `src/app/debug/`, `dev/tools/` | Keeps its existing unit coverage. A behaviour change here updates or adds a focused test. |

Every test in `test/` today covers the second half. That is deliberate, not an omission: the demo is a real-time surface whose value is how it feels, and the cheapest honest check on it is a person playing it. Do not add tests to `src/demo/` or `src/presentation/` to satisfy a coverage instinct.

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

The browser layer exists for one reason: parts of `src/app/debug/` have no cheaper observing layer, because unit tests run in a Node environment with no DOM. That is its whole mandate — a debug tool's rendering, its event wiring, and its round trip to the development authoring endpoint.

A full `npm run test:e2e` is the closeout gate for a change that touches `src/app/debug/`, the authoring endpoint, or the development server wiring. Every other change uses a targeted selection (`npx playwright test <file>.spec.ts`) or nothing at all. A browser-launch failure is an environment problem, not an application failure, and must be reported as such.

No spec may press **Save Canonical JSON** in the Floor Set Workbench, or otherwise invoke the authoring endpoint's `save` operation: it overwrites `src/content/floors/provisional-floor-set.json` in the working tree.

The demo is not, and is not expected to become, a browser-test subject.

## Reporting

State which layers actually ran and what they returned. If something failed, say so with the output; if a step was skipped, say that.

`npm run verify` says nothing about `npm run test:e2e` or `npm run check:governance` — report them separately and never let one stand in for another.

A manual playtest report says what was played, what happened, and which of the change's intended outcomes the run confirmed or contradicted. It does not measure the run against `dev/docs/design/` or `dev/docs/reports/`; both are frozen and `dev/standards/frozen_reference_directories.md` forbids citing them.

# Test Operations

This file is the authoritative project-local test and validation contract for Pantry Depths. Every agent-run static check, unit test, build, browser check, or delivery gate follows this file.

## The Gate

`npm run verify` before delivering a change. That is the whole gate.

It runs, in order and stopping on first failure: `format:check` → `typecheck` → `lint` → `check:boundaries` → `test` → `build`. Pass criterion is exit code 0 with no stage skipped. Never pipe a stage through a filter that replaces its exit status — a layer's result is the exit code of its command, never a filtered view of its output.

Run `npm run check:governance` as well whenever a governance, startup, or planning document changes. It is outside `verify` and passes when it prints both `governance: OK` and `foundation: OK`.

## Three Surfaces, Three Disciplines

The repository is not uniform, and the contract should not pretend otherwise.

| Surface                                                                                                 | Discipline                                                                                                            |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **The demo** — `src/demo/`, `src/presentation/`                                                         | Verified by playing it. No automated tests, ever.                                                                     |
| **The sandbox track** — `src/sandbox/` (`dev/standards/sandbox_track.md`)                               | Verified by opening its debug tool. Browser tests machine-banned; unit tests budgeted — see the growth section below. |
| **The formal track** — `src/core/`, `src/content/`, `src/app/debug/`, `dev/tools/`, and everything else | Keeps the coverage it already has. Growing that coverage passes through a gate — see the growth section below.        |

The demo has no tests deliberately, not as an omission: it is a real-time surface whose value is how it feels, and the cheapest honest check on it is a person playing it. Do not add tests to `src/demo/` or `src/presentation/` to satisfy a coverage instinct.

That paragraph was prose for as long as it was ignored. It is now enforced by `test/unit/repository/demo-half-is-untested.test.ts`, which fails the unit stage — and therefore `verify` — when any test file imports `@/demo/` or `@/presentation/`. The guard holds one frozen exemption, the presentation asset loader, and it does not grow. Do not add yourself to it, and do not move a banned test somewhere the guard cannot see it; the check is on what a test imports, not where it sits.

The sandbox track has its own guard beside that one, `test/unit/repository/sandbox-test-budget.test.ts`, enforcing the budget stated in the growth section: no browser spec touches the sandbox tree, and each experiment holds at most one unit spec of at most three cases. The same terms apply — do not edit it, exempt yourself from it, or relocate a test out of its sight.

What the ban costs is worth naming, because the temptation returns every time: the presentation suite that prompted the guard asserted that a skeleton facing world `+Y`, seen from a camera looking east, renders its direction row 2. That was true of the code and wrong in the game — the direction wheel was mirrored — so the test had taken a rendering bug and written it down as the specification. A test against the demo does not catch that class of error; it preserves it.

## Looking Is Not Testing

Verifying the demo by playing it leaves an agent working on the demo with nothing it can check for itself, and every change ending in a person opening a browser. The answer to that is an instrument, not an exception to the ban: `npm run capture` drives the demo through a headless browser and writes pictures for somebody to look at.

It asserts nothing and returns no verdict. It starts its own dev server, seeds `Math.random` so the same floor grows on every run, drives the same debug keys a person would, and writes `capture-output/latest/*.png`, a `stats.json` of frame timings and world counts, and a contact sheet putting the previous run beside the latest. Whether a picture is right is still decided by whoever reads it — which is exactly the judgement the ban exists to keep with a person.

The line that keeps the harness from becoming the thing the guard forbids: **it may observe and must not judge.** A threshold on a frame time, a pixel diff that fails, an exit code meaning "the picture is wrong" — each of those is a test against the demo, and wanting one goes through the section below like any other test. What the harness may grow without asking is more scenes, more instrumentation, and more legible output.

Two facts about it are easy to trip over. It never uses port 5273: it asks the operating system for a free port and starts its own server there, so it is safe to run while the user's dev server is up, and the `PLAYWRIGHT_PORT` note under Environment does not apply to it. And its `stats.json` reads `window.demoWorld`, a development-only handle rather than an import, so renaming a field on the world makes those numbers quietly absent rather than failing the run.

There is a second instrument beside it, `npm run capture:page`, and the same line governs it: one address in, one picture out, no verdict. It photographs anything the dev server serves — a named map, a workbench — starts a server of its own on a free port like the harness does, and writes to `capture-output/adhoc/` so that a casual picture can never be mistaken for a scene or destroyed by the harness rotating `latest/` into `previous/`. It presses no keys, which is what keeps it clear of the authoring endpoint's save operation; a curated scene does press keys, so the prohibition below reaches whoever writes one, and `dev/tools/capture/scenes.mjs` states it where they will read it. Its `--port` switch attaches to a server somebody else started, and then it photographs whatever that server is serving from whichever working tree it was started in.

## Growing Coverage Is Gated, Per Track

A test is never a reflex. Nothing in this document that reads as though some layer ought to be covered grants one; neither does a boundary with no other observer, the cheapness of the test, nor the risk of the change. Which gate a new test passes through depends on the track:

**Formal track, unit tests.** Keep them few. A new unit test file or case exists only when the implementation spec named it before implementation began — the Phase 2 preview is where the user sees and approves it, so a test named there was seen before it existed. Outside an `/implement` flow, a new unit test still requires the user to ask for it explicitly, in as many words, for that change. Either way, a test that does not defend a boundary the change created is left unwritten; saying what is untested and moving on remains the correct move.

**Formal track, browser tests.** Forbidden during implementation, without exception: an e2e spec is never written in an `/implement` flow and never named in a spec. When a delivered change genuinely needs browser coverage, propose it after delivery — what it would assert, what it would cost — and the user's explicit approval is what adds it. The addition updates Browser Acceptance Scope below in the same change, so that section stays a true inventory.

**Sandbox track.** Browser tests are banned outright and the ban is machine-enforced. Unit tests are budgeted: per experiment, at most one spec file importing from `@/sandbox/<experiment>/`, holding at most three test cases. The budget is a ceiling, not a quota — most experiments should spend none of it. `test/unit/repository/sandbox-test-budget.test.ts` fails `verify` when either bound breaks.

**The demo.** No tests, ever, per the section above. No gate opens this; there is nothing to propose.

Updating or deleting a test whose subject a change moved is not adding one and needs no permission. That is the section below.

The history that shaped these gates: an earlier blanket rule required an explicit user request for every new test, because its opposite had produced three browser specs for the workbenches, each written from a line here that said `src/app/debug/` had no cheaper observing layer. They are deleted. A workbench is verified by opening it, which is the only way its actual subject — whether the thing on screen looks right — can be judged at all. The unit gate has since moved into the spec preview because that is where the user already reads what a change will do; the browser gate stayed a spoken sentence, and moved to after delivery, because a browser spec is the coverage instinct's favorite disguise.

## When A Test Breaks

A test breaks for one of two reasons, and they have opposite answers.

**The change is wrong.** Fix the change.

**The test's subject was deliberately changed or deleted.** Then the test is describing a past the project has left. Update it to the new truth, or delete it. Do not preserve the old assertion by widening it, adding a branch for the new behaviour, or wrapping it in a conditional — a test kept alive that way records nothing and costs attention forever.

Deleting a test alongside the code it covered is a normal part of a change, not a loss to be justified.

## Environment

- Package manager `npm`; Node `>=22.12` (developed on v24.18.0). Install with `npm install` at the repository root. No network access is required after install.
- `npm run check:governance` additionally requires Python 3 on `PATH` (developed on 3.14.6).
- `npm run test:e2e`, `npm run capture`, and `npm run capture:page` additionally require the Chromium build Playwright pins, installed once with `npx playwright install chromium`. Do not install it unless browser coverage or a capture run is actually being asked for.
- The Vite dev server binds `http://localhost:5273` with `strictPort`. **Treat every listener on that port as user-owned**, including a development server or a test run. Never stop, restart, or reconfigure it to make a command run. Playwright reuses a server it finds there; when the port is occupied by something that is not this project's dev server, set `PLAYWRIGHT_PORT=<available-port>` for that one invocation instead of editing `vite.config.ts` or `playwright.config.ts`. `npm run capture` sidesteps all of this by starting a server of its own on a port the operating system picks.

## Individual Layers

Use these when iterating; `verify` is what proves the change is deliverable.

| Layer            | Command                    | Notes                                                                             |
| ---------------- | -------------------------- | --------------------------------------------------------------------------------- |
| Format           | `npm run format:check`     | `npx prettier --write <paths>` to fix                                             |
| Typecheck        | `npm run typecheck`        |                                                                                   |
| Lint             | `npm run lint`             | Passes at 0 errors; warnings are reported and do not fail                         |
| Import boundary  | `npm run check:boundaries` | Passes at 0 errors; a new warning is worth a sentence                             |
| Unit             | `npm run test`             |                                                                                   |
| Production build | `npm run build`            |                                                                                   |
| Governance       | `npm run check:governance` | Outside `verify`                                                                  |
| Browser E2E      | `npm run test:e2e`         | Outside `verify`; scope is narrow — see below                                     |
| Scene capture    | `npm run capture`          | Outside `verify`; pictures to look at, never a check — see Looking Is Not Testing |
| Page capture     | `npm run capture:page`     | Outside `verify`; one address in, one picture out — same line, same section       |

Expected noise: `vitest` prints its include/exclude summary when no test file matches, and `depcruise` prints a module and dependency count on success. Playwright writes `playwright-report/` and `test-results/`; both are ignored by Git.

## Browser Acceptance Scope

One spec, `test/e2e/debug-route.spec.ts`: the debug hub boots and opens a lazily loaded tool through a full-document navigation. That is the entire browser layer and it is not a template for a second one.

`npm run test:e2e` runs it, outside `verify`. A browser-launch failure is an environment problem, not an application failure, and must be reported as such.

Nothing else in `src/app/debug/` is a browser-test subject. A workbench is verified by opening it and looking, for the same reason the demo is: what it is for is whether the picture is right, and an assertion about a picture records whatever the renderer happened to be doing that day.

Sandbox experiments are never browser-test subjects either, and unlike the workbenches this is machine-enforced: `test/unit/repository/sandbox-test-budget.test.ts` fails when anything under `test/e2e/` references the sandbox tree.

Should a spec ever be asked for, it may not press **Save Canonical JSON** or otherwise invoke the authoring endpoint's `save` operation: it overwrites authored content in the working tree.

The demo is not, and is not expected to become, a browser-test subject. A browser that opens the demo to take a picture is not testing it — that is the capture harness, and its boundary is stated above rather than here.

## Reporting

State which layers actually ran and what they returned. If something failed, say so with the output; if a step was skipped, say that.

`npm run verify` says nothing about `npm run test:e2e` or `npm run check:governance` — report them separately and never let one stand in for another.

A capture run is reported the way a playtest is: which scenes were shot and what was seen in them. Having captured is not itself a result, and a clean run of the harness is not evidence that anything looks right — only the reading of the pictures is.

A manual playtest report says what was played, what happened, and which of the change's intended outcomes the run confirmed or contradicted. It does not measure the run against `dev/docs/design/` or `dev/docs/reports/`; both are frozen and `dev/standards/frozen_reference_directories.md` forbids citing them.

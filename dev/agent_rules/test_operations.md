# Test Operations

This file is the authoritative project-local test and validation contract for Pantry Depths. Every agent-run static check, unit test, build, browser check, or delivery gate follows this file.

## The Gate

`npm run verify` before delivering a change. That is the whole gate.

It runs, in order and stopping on first failure: `format:check` → `typecheck` → `lint` → `check:boundaries` → `test` → `build`. Pass criterion is exit code 0 with no stage skipped. Never pipe a stage through a filter that replaces its exit status — a layer's result is the exit code of its command, never a filtered view of its output.

Run `npm run check:governance` as well whenever a governance, startup, or planning document changes. It is outside `verify` and passes when it prints both `governance: OK` and `foundation: OK`.

## Two Tracks, Two Disciplines

| Track                                                                     | Discipline                                                                                         |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **The formal track** — everything under `src/` and `dev/tools/`           | Keeps the coverage it has. Growing it passes through a gate — see the growth section below.        |
| **The sandbox track** — `src/sandbox/` (`dev/standards/sandbox_track.md`) | Verified by opening its debug tool. Browser tests machine-banned; unit tests budgeted — see below. |

The sandbox budget is machine-enforced by `test/unit/repository/sandbox-test-budget.test.ts`: no browser spec touches the sandbox tree, and each experiment holds at most one unit spec of at most three cases. Do not edit that guard, exempt yourself from it, or relocate a test out of its sight.

## Playing Is Still The Judge Of Feel

For most of this repository's life, the demo half was banned from automated testing outright; the migration that moved the game into the formal layers retired the ban with the tree that justified it. What the ban protected is still true and still owns decisions: **a real-time surface's value is how it feels, and only a person playing it can judge that.** A behaviour-preserving refactor near presentation, input, or animation is still proven by playing; a test can only assert what the code does, never what it should feel like.

The history is worth one paragraph, because the temptation it answers returns: a presentation suite once asserted that a skeleton facing world `+Y`, seen from a camera looking east, renders its direction row 2. That was true of the code and wrong in the game — the direction wheel was mirrored — so the test had taken a rendering bug and written it down as the specification. That is why tests near the drawn image stay rare, deliberate, and spec-named, and why a playtest still closes every change whose subject is what the screen shows or how the hands respond.

## Looking Is Not Testing

An agent working on the play surface has an instrument, not a verdict: `npm run capture` drives the game through a headless browser and writes pictures for somebody to look at.

It asserts nothing and returns no verdict. It starts its own dev server, seeds `Math.random` so the same floor grows on every run, drives the same debug keys a person would, and writes `capture-output/latest/*.png`, a `stats.json` of frame timings and world counts, and a contact sheet putting the previous run beside the latest. Whether a picture is right is still decided by whoever reads it.

The line that keeps the harness honest: **it may observe and must not judge.** A threshold on a frame time, a pixel diff that fails, an exit code meaning "the picture is wrong" — each of those is a test, and wanting one goes through the growth section below. What the harness may grow without asking is more scenes, more instrumentation, and more legible output.

Two facts about it are easy to trip over. It never uses port 5273: it asks the operating system for a free port and starts its own server there, so it is safe to run while the user's dev server is up, and the `PLAYWRIGHT_PORT` note under Environment does not apply to it. And its `stats.json` reads `window.demoWorld`, a development-only handle rather than an import, so renaming a field on the world makes those numbers quietly absent rather than failing the run.

There is a second instrument beside it, `npm run capture:page`, and the same line governs it: one address in, one picture out, no verdict. It photographs anything the dev server serves — a named map, a workbench — starts a server of its own on a free port like the harness does, and writes to `capture-output/adhoc/`. It presses no keys, which is what keeps it clear of the authoring endpoint's save operation; a curated scene does press keys, so the prohibition below reaches whoever writes one, and `dev/tools/capture/scenes.mjs` states it where they will read it. Its `--port` switch attaches to a server somebody else started, and then it photographs whatever that server is serving from whichever working tree it was started in.

## Growing Coverage Is Gated, Per Track

A test is never a reflex. Nothing in this document that reads as though some layer ought to be covered grants one; neither does a boundary with no other observer, the cheapness of the test, nor the risk of the change. Which gate a new test passes through depends on the track:

**Formal track, unit tests.** Keep them few. A new unit test file or case exists only when the implementation spec named it before implementation began — the Phase 2 preview is where the user sees and approves it, so a test named there was seen before it existed. Outside an `/implement` flow, a new unit test still requires the user to ask for it explicitly, in as many words, for that change. Either way, a test that does not defend a boundary the change created is left unwritten; saying what is untested and moving on remains the correct move.

**Formal track, browser tests.** Forbidden during implementation, without exception: an e2e spec is never written in an `/implement` flow and never named in a spec. When a delivered change genuinely needs browser coverage, propose it after delivery — what it would assert, what it would cost — and the user's explicit approval is what adds it. The addition updates Browser Acceptance Scope below in the same change, so that section stays a true inventory.

**Sandbox track.** Browser tests are banned outright and the ban is machine-enforced. Unit tests are budgeted: per experiment, at most one spec file importing from `@/sandbox/<experiment>/`, holding at most three test cases. The budget is a ceiling, not a quota — most experiments should spend none of it.

The history that shaped these gates: an earlier blanket rule required an explicit user request for every new test, because its opposite had produced three browser specs for the workbenches, each written from a line here that said the debug surface had no cheaper observing layer. They are deleted. A workbench is verified by opening it, which is the only way its actual subject — whether the thing on screen looks right — can be judged at all.

Updating or deleting a test whose subject a change moved is not adding one and needs no permission. That is the section below.

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

Nothing else in `src/app/debug/` is a browser-test subject. A workbench is verified by opening it and looking: what it is for is whether the picture is right, and an assertion about a picture records whatever the renderer happened to be doing that day.

Sandbox experiments are never browser-test subjects either, and this is machine-enforced: `test/unit/repository/sandbox-test-budget.test.ts` fails when anything under `test/e2e/` references the sandbox tree.

Should a spec ever be asked for, it may not press **Save Canonical JSON** or otherwise invoke the authoring endpoint's `save` operation: it overwrites authored content in the working tree.

The play surface is not a browser-test subject by default; a browser that opens the game to take a picture is not testing it — that is the capture harness, and its boundary is stated above rather than here.

## Reporting

State which layers actually ran and what they returned. If something failed, say so with the output; if a step was skipped, say that.

`npm run verify` says nothing about `npm run test:e2e` or `npm run check:governance` — report them separately and never let one stand in for another.

A capture run is reported the way a playtest is: which scenes were shot and what was seen in them. Having captured is not itself a result, and a clean run of the harness is not evidence that anything looks right — only the reading of the pictures is.

A manual playtest report says what was played, what happened, and which of the change's intended outcomes the run confirmed or contradicted. It does not measure the run against `dev/docs/design/` or `dev/docs/reports/`; both are frozen and `dev/standards/frozen_reference_directories.md` forbids citing them.

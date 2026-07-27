# Test Operations

This file is the authoritative project-local test and Web validation contract for Pantry Depths. Every agent-run static check, unit test, build smoke, browser check, or accessibility validation must follow this file.

## When To Run

Use the narrowest available layer that proves the changed behavior.

| Changed surface                                        | Minimum layer                               |
| ------------------------------------------------------ | ------------------------------------------- |
| `src/core/` rules, `src/content/` numbers              | `npm run test` for the affected unit test   |
| Layer placement, a new directory, an import direction  | `npm run check:boundaries`                  |
| Governance file, startup pointer, foundation config    | `npm run check:governance`                  |
| `src/presentation/`, `src/ui/`, input feel, VFX, audio | Manual browser playtest (see Manual Layers) |
| `src/app/debug/` DOM wiring, the authoring endpoint    | `npm run test:e2e` for the affected spec    |
| Anything delivered as a change                         | `npm run verify`                            |

`npm run verify` is the single aggregate gate that answers "is this change deliverable". Browser acceptance stays outside it and is reported separately.

## Environment And Preparation

- Package manager: `npm`. Node `>=22.12` (developed on v24.18.0).
- Install with `npm install` at the repository root. No workspace or monorepo layout.
- No network access is required by any layer after install.
- `npm run check:governance` additionally requires Python 3 on `PATH` (developed on 3.14.6). It is not part of `verify`; run it whenever a governance or startup file changes.
- `npm run test:e2e` additionally requires the Chromium build Playwright pins, installed once with `npx playwright install chromium`. Do not install it unless browser coverage is actually being run.
- Vite dev server binds `http://localhost:5273` with `strictPort`. Do not take over a port another process owns; start an alternate port explicitly when 5273 is busy.
- Treat every listener on `http://localhost:5273` as user-owned, including a development server or a test run. Never stop, restart, or reconfigure it to make a command run. Playwright reuses a server it finds there; when the port is occupied by something that is not this project's dev server, set `PLAYWRIGHT_PORT=<available-port>` for that one invocation instead of editing `vite.config.ts` or `playwright.config.ts`.

## Available Layers

| Layer            | Command                      | State                                                    |
| ---------------- | ---------------------------- | -------------------------------------------------------- |
| Format           | `npm run format:check`       | Available                                                |
| Typecheck        | `npm run typecheck`          | Available                                                |
| Lint             | `npm run lint`               | Available                                                |
| Import boundary  | `npm run check:boundaries`   | Available                                                |
| Unit             | `npm run test`               | Available                                                |
| Production build | `npm run build`              | Available                                                |
| Governance       | `npm run check:governance`   | Available; outside `verify`                              |
| Floor content    | `npm run validate:floor-set` | Available; validates the configured floor-set input      |
| Browser E2E      | `npm run test:e2e`           | Available; outside `verify`. Scope is narrow — see below |
| Accessibility    | —                            | **Not available.** Manual keyboard-only check only.      |

## Commands And Pass Criteria

- `npm run verify` runs, in order and stopping on first failure: `format:check` → `typecheck` → `lint` → `check:boundaries` → `test` → `build`. Pass criterion is exit code 0 with no stage skipped. Never pipe a stage through a filter that replaces its exit status.
- `npm run check:boundaries` passes at 0 errors. Warnings are reported but do not fail the stage; a new warning still requires an explanation in the change report.
- `npm run check:governance` passes when it prints both `governance: OK` and `foundation: OK`.
- `npm run validate:floor-set` passes when the selected floor-set JSON has no error findings and yields one structural solution. It defaults to canonical content and accepts `--input <path>` for a candidate. It does not assess HP survivability or balance.
- `npm run test:e2e` runs the Playwright specs in `test/e2e/` against a Chromium instance and the Vite development server. It reuses a server already listening on the configured port and otherwise starts its own. It passes when every spec passes; a browser-launch failure is an environment problem, not an application failure, and must be reported as such. Target one spec with `npx playwright test <file>.spec.ts` or `npx playwright test -g "<test name>"`.
- Expected noise: `vitest` prints its include/exclude summary when no test file matches. `depcruise` prints a module and dependency count on success. Playwright writes `playwright-report/` and `test-results/`; both are ignored by Git.

## Browser Acceptance Scope

The browser layer exists for one reason: parts of `src/app/debug/` have no cheaper observing layer. Unit tests here run in a Node environment with no DOM, so a debug tool's rendering, its event wiring, and its round trip to the development authoring endpoint are unobservable below the browser.

That is the whole mandate. A browser test is added only when all of these hold:

- The behavior is logic, not appearance. Layout, spacing, colour, map readability, and generated-content quality are judged by a human and never asserted here.
- No unit test can observe it. Formulas, schema rules, validation findings, generator output, and route resolution are already owned by `test/unit/`, and a browser test must not restate them.
- It is reached through the product's own interface in a few actions. A spec that has to drive the system at length to reach its target state is set up wrong.

Gameplay presentation, input feel, VFX, and audio stay manual, exactly as before this layer existed. The renderer is not, and is not expected to become, a browser-test subject.

Run policy: this project has no CI, so a full `npm run test:e2e` is the closeout gate for a change that touches `src/app/debug/`, the authoring endpoint, or the development server wiring, and is run once per scope rather than per commit. Every other change uses a targeted selection or nothing at all.

No spec may press **Save Canonical JSON** in the Floor Set Workbench, or otherwise invoke the authoring endpoint's `save` operation: it overwrites `src/content/floors/provisional-floor-set.json` in the working tree.

## Manual Layers

Presentation, input feel, audio, and VFX have no automated coverage in V1 and are not expected to gain any. Verify them by running `npm run dev` and playing.

A manual playtest report states: which floor was reached, the player's attack and defense at that point, remaining HP, and which of the owning plan's acceptance criteria the run confirmed or contradicted. It does not measure the run against `dev/docs/design/`; that directory is frozen and `dev/standards/design_document_freeze.md` forbids citing it.

## Result Reporting

Report every layer actually run, the source state tested, the pass/fail result, any expected noise that affected interpretation, and every verification gap or manual-only boundary. The absence of browser coverage for gameplay is a standing gap and must be restated in any report that touches `src/presentation/` or `src/ui/`; the browser layer covers the development console only.

`npm run verify` excludes browser acceptance. A passing `verify` says nothing about `npm run test:e2e`; report the two separately and never let one stand in for the other. A layer's result is the exit status of its command, never a filtered view of its output — piping a stage into `grep`, `tail`, or `head` replaces that exit status and discards the failure signal.

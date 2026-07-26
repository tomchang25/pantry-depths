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
| Anything delivered as a change                         | `npm run verify`                            |

`npm run verify` is the single aggregate gate that answers "is this change deliverable".

## Environment And Preparation

- Package manager: `npm`. Node `>=22.12` (developed on v24.18.0).
- Install with `npm install` at the repository root. No workspace or monorepo layout.
- No network access is required by any layer after install.
- `npm run check:governance` additionally requires Python 3 on `PATH` (developed on 3.14.6). It is not part of `verify`; run it whenever a governance or startup file changes.
- Vite dev server binds `http://localhost:5273` with `strictPort`. Do not take over a port another process owns; start an alternate port explicitly when 5273 is busy.

## Available Layers

| Layer            | Command                      | State                                                |
| ---------------- | ---------------------------- | ---------------------------------------------------- |
| Format           | `npm run format:check`       | Available                                            |
| Typecheck        | `npm run typecheck`          | Available                                            |
| Lint             | `npm run lint`               | Available                                            |
| Import boundary  | `npm run check:boundaries`   | Available                                            |
| Unit             | `npm run test`               | Available                                            |
| Production build | `npm run build`              | Available                                            |
| Governance       | `npm run check:governance`   | Available; outside `verify`                          |
| Floor content    | `npm run validate:floor-set` | Available; validates the configured floor-set input  |
| Browser E2E      | —                            | **Not available.** Deliberately out of scope for V1. |
| Accessibility    | —                            | **Not available.** Manual keyboard-only check only.  |

## Commands And Pass Criteria

- `npm run verify` runs, in order and stopping on first failure: `format:check` → `typecheck` → `lint` → `check:boundaries` → `test` → `build`. Pass criterion is exit code 0 with no stage skipped. Never pipe a stage through a filter that replaces its exit status.
- `npm run check:boundaries` passes at 0 errors. Warnings are reported but do not fail the stage; a new warning still requires an explanation in the change report.
- `npm run check:governance` passes when it prints both `governance: OK` and `foundation: OK`.
- `npm run validate:floor-set` passes when the selected floor-set JSON has no error findings and yields one structural solution. It defaults to canonical content and accepts `--input <path>` for a candidate. It does not assess HP survivability or balance.
- Expected noise: `vitest` prints its include/exclude summary when no test file matches. `depcruise` prints a module and dependency count on success.

## Manual Layers

Presentation, input feel, audio, and VFX have no automated coverage in V1 and are not expected to gain any. Verify them by running `npm run dev` and playing.

A manual playtest report states: which floor was reached, the player's attack and defense at that point, remaining HP, and which of the design document's numbered expectations (`dev/docs/design/pantry-depths_v1.md`, section 十) the run confirmed or contradicted.

## Result Reporting

Report every layer actually run, the source state tested, the pass/fail result, any expected noise that affected interpretation, and every verification gap or manual-only boundary. The absence of browser coverage is a standing gap and must be restated in any report that touches `src/presentation/` or `src/ui/`.

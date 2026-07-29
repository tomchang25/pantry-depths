# AGENTS Instructions

## Startup

Before any repository-specific work:

1. Confirm `dev/foundation/` is initialized. If it is missing or uninitialized, stop and request `git submodule update --init --recursive`.
2. Read `dev/foundation/core/agent_rules/foundation_startup.md`.
3. Read `dev/foundation/platforms/web-react/platform_startup.md`, selected by `dev/foundation.config.json`.
4. Read `dev/agent_rules/agent_startup.md`, then load the project-local rules its discovery section routes to.

`dev/README.md` holds the trigger map from each kind of work to its required reading.

## Required contracts

- Read `dev/agent_rules/test_operations.md` before any test, build, validation, or delivery operation.
- Read `dev/agent_rules/git_operations.md` before any Git mutation. Do not commit, push, rewrite history, or change remote configuration unless the user requests it.

## Never test the demo

`src/demo/` and `src/presentation/` are verified by playing the game. **Do not write a test that covers either of them** — not for a new enemy, not for a renderer change, not to prove a fix works, not because the change felt risky. There is no exception to ask about; if you believe you have found one, you have not.

A test is machine-checked at `test/unit/repository/demo-half-is-untested.test.ts`, which fails `npm run test` when any test file imports `@/demo/` or `@/presentation/`. Do not edit or exempt yourself from that guard. The reasoning is in `dev/agent_rules/test_operations.md`; the short version is that a real-time surface's value is how it feels, and a test written against it freezes whatever the renderer happened to be doing that day — including its bugs.

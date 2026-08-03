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

## Tests are gated, never a reflex

Read `dev/agent_rules/test_operations.md` before any test, build, validation, or delivery operation. The short version: new unit tests exist only when an implementation spec named them beforehand, browser tests are proposed after delivery rather than written during it, the sandbox track's budget is machine-enforced, and the game's feel — presentation, input, animation — is still judged by a person playing it, because a test can only assert what the code does, never what it should feel like.

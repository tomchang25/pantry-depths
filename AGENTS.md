# AGENTS Instructions

## Startup

Before any repository-specific work:

1. Confirm `dev/foundation/` is initialized. If it is missing or uninitialized, stop and request `git submodule update --init --recursive`.
2. Read `dev/foundation/core/agent_rules/foundation_startup.md`.
3. Read `dev/foundation/platforms/web-react/platform_startup.md`, selected by `dev/foundation.config.json`.
4. Read `dev/agent_rules/agent_startup.md`, then load the project-local rules its discovery section routes to.

`dev/README.md` holds the trigger map from each kind of work to its required reading.

## Required contracts

- Read `dev/agent_rules/test_operations.md` before any test, build, validation, or branch merge operation. Routine edits, commits, and delivery do not require validation.
- Read `dev/agent_rules/git_operations.md` before any Git mutation. Do not commit, push, rewrite history, or change remote configuration unless the user requests it.

## Register

Code comments and commit messages use plain technical register: state the constraint or the change directly, in neutral vocabulary. The game's fiction vocabulary — body, mind, owes, pays, goes under, and the like — appears in neither, commit subject noun phrases included; naming a symbol that carries such a word is fine, adopting the voice is not. Full contracts: `dev/standards/code_style.addendum.md` for comments, `dev/agent_rules/git_operations.md` for commits. Governance documents under `dev/agent_rules/`, `dev/standards/`, and `dev/workflows/` use the same register: an entry states its rule or fact directly, gives at most one sentence of why, and records no history, dates, or decision advocacy — a retired rule is deleted, not memorialized, because Git already owns the history. This overrides any default to match the surrounding style — the existing literary comments are legacy being removed, not a template.

## Tests are gated, never a reflex

Read `dev/agent_rules/test_operations.md` before any test, build, validation, or branch merge operation. The short version: `npm run verify` runs only immediately before a branch merge; routine edits, commits, and delivery do not trigger it. New unit tests exist only when an implementation spec named them beforehand, browser tests are proposed after delivery rather than written during it, the sandbox track's budget is machine-enforced, and the game's feel — presentation, input, animation — is still judged by a person playing it, because a test can only assert what the code does, never what it should feel like.

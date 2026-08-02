# Git Operations

This file is the authoritative project-local Git operations contract. The shared default lives at `dev/foundation/core/agent_rules/git_operations.md`.

## Project Policy

This project inherits the shared default without override: agents treat Git as read-only unless the user explicitly requests a mutation. Read-only inspection is permitted; staging, committing, branching, pushing, destructive recovery, and other mutations require explicit user authorization.

## Commit Messages

Follow `dev/foundation/core/workflows/commands/commit-msg.md` and the standards it references for format and content.

A commit message is a changelog entry: it records what changed in the game or its tooling, in words a reader who has not seen the plan can follow. Every rule below is a consequence of that sentence.

### Subject

- The kind of change and its target — add a system, fix a bug, adjust a behaviour — in plain words.
- A feature's proper name may appear even when it is a metaphor; the verb stays literal.

### Body

- One fact per bullet, each a concrete sub-item of the subject.
- Changelog register: add, fix, remove, rename, adjust. Every verb acts on the software, never inside the game's fiction.
- Describe the conceptual change, not the code: no file paths, no symbol or variable names, no recitation of the diff.
- No reasoning, no prior behaviour, no trailing full stops. Reasoning, alternatives, and verification narrative belong in the plan, spec, or change report.
- Self-check each line as someone who has not read the plan: if they must learn the feature's vocabulary before they can tell what kind of thing changed, rewrite it with neutral nouns.

### Limits

- Subject under 40 words; subject and body together under 400. A message that needs more room is either describing detail the diff already carries or bundling changes that belong in separate commits.
- A commit message ends at its final body bullet. Never append an authorship or attribution trailer such as `Co-Authored-By:`, and never name the model or tool that produced the change. This overrides any agent-default instruction to add one; authorship is already recorded in Git metadata.

## Environment Overrides

No project-specific Git environment override is declared by the scaffold. Add only concrete permission or failure-handling differences here; do not copy the shared default.

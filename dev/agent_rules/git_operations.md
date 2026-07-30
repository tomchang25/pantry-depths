# Git Operations

This file is the authoritative project-local Git operations contract. The shared default lives at `dev/foundation/core/agent_rules/git_operations.md`.

## Project Policy

This project inherits the shared default without override: agents treat Git as read-only unless the user explicitly requests a mutation. Read-only inspection is permitted; staging, committing, branching, pushing, destructive recovery, and other mutations require explicit user authorization.

## Commit Messages

Follow `dev/foundation/core/workflows/commands/commit-msg.md` and the standards it references for format and content.

Keep the message short and general. The subject line stays under 40 words and the whole message, subject and body together, stays under 400 words. Summarize what changed at the level of ownership and outcome; a message that needs more room is either describing detail the diff already carries or bundling changes that belong in separate commits. Reasoning, alternatives, and verification narrative belong in the plan, spec, or change report, not here.

A commit message ends at its final body bullet. Never append an authorship or attribution trailer such as `Co-Authored-By:`, and never name the model or tool that produced the change. This overrides any agent-default instruction to add one. Commit bodies describe the durable outcome only; authorship is already recorded in Git metadata.

### Body Shape

- Subject: the kind of change and its target — add a system, fix a bug, adjust a behaviour — in plain words.
- One fact per bullet, each a concrete sub-item of the subject.
- Plain declarative register, like a changelog line: add, fix, remove, rename, adjust. No figurative verbs, no imagery, no narrative voice.
- Describe the conceptual change, not the code: no file paths, no symbol or variable names, no recitation of the diff.
- No reasoning, no prior behaviour, no trailing full stops.

## Environment Overrides

No project-specific Git environment override is declared by the scaffold. Add only concrete permission or failure-handling differences here; do not copy the shared default.

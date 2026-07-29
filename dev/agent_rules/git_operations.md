# Git Operations

This file is the authoritative project-local Git operations contract. The shared default lives at `dev/foundation/core/agent_rules/git_operations.md`.

## Project Policy

This project inherits the shared default without override: agents treat Git as read-only unless the user explicitly requests a mutation. Read-only inspection is permitted; staging, committing, branching, pushing, destructive recovery, and other mutations require explicit user authorization.

## Commit Messages

Follow `dev/foundation/core/workflows/commands/commit-msg.md` and the standards it references for format and content.

Keep the message short and general. The subject line stays under 40 words and the whole message, subject and body together, stays under 400 words. Summarize what changed at the level of ownership and outcome; a message that needs more room is either describing detail the diff already carries or bundling changes that belong in separate commits. Reasoning, alternatives, and verification narrative belong in the plan, spec, or change report, not here.

A commit message ends at its final body bullet. Never append an authorship or attribution trailer such as `Co-Authored-By:`, and never name the model or tool that produced the change. This overrides any agent-default instruction to add one. Commit bodies describe the durable outcome only; authorship is already recorded in Git metadata.

### Body Shape

The word limits above are a ceiling, not a target, and they were being treated as one. Five consecutive commits explained their own reasoning in the body — what the code used to do, why that was wrong, what was tried — which is a change report written in the wrong file. The shape is therefore fixed rather than merely bounded:

- Three to five bullets. Needing more means the commit is doing more than one thing.
- One line per bullet. If it wraps, it is explaining rather than summarizing.
- Each bullet names a capability the repository now has or has lost, in the imperative, at the altitude of the subject line.
- No reasoning, no prior behaviour, no numbers of things, no file or symbol names, no measurements. Every one of those is either in the diff already or belongs in the plan.
- No trailing full stops.

`4300f3c` is the reference commit for this shape.

## Environment Overrides

No project-specific Git environment override is declared by the scaffold. Add only concrete permission or failure-handling differences here; do not copy the shared default.

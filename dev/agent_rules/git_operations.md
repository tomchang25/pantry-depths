# Git Operations

This file is the authoritative project-local Git operations contract. The shared default lives at `dev/foundation/core/agent_rules/git_operations.md`.

## Project Policy

This project inherits the shared default without override: agents treat Git as read-only unless the user explicitly requests a mutation. Read-only inspection is permitted; staging, committing, branching, pushing, destructive recovery, and other mutations require explicit user authorization.

## Commit Messages

Re-read this section immediately before composing each commit message. A read earlier in the same session does not satisfy this step.

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
- Register governs every word of the message, subject noun phrases included. The game's fiction vocabulary — body, mind, owes, pays, goes under, and the like — names the mechanism instead: enemy, AI state, drowning.
- The hook rejects a denylist of those words. A rejection is rewritten, never bypassed; a word that keeps blocking legitimate technical phrasing is removed from the list instead.

### Limits

- Subject under 40 words; subject and body together under 400. A message that needs more room is either describing detail the diff already carries or bundling changes that belong in separate commits.
- A commit message ends at its final body bullet. Never append an authorship or attribution trailer such as `Co-Authored-By:`, and never name the model or tool that produced the change. This overrides any agent-default instruction to add one; authorship is already recorded in Git metadata.

## Delivering The Message

Write the message to a scratch file outside the repository and commit with `git commit -F <path>`. Never pass it with `-m`, and never assemble a multi-line message inside a shell.

The reason is that this environment offers two shells whose multi-line string syntax is incompatible — PowerShell here-strings and POSIX heredocs — and picking the wrong one does not fail. On 2026-08-04 a here-string was handed to the Bash tool, which read its `@` delimiters as ordinary text: the commit succeeded, the subject became a single `@`, and the real subject landed on line two where `git log --oneline` does not show it. A message delivered as a file passes through no quoting at all, so the question of which syntax applies never comes up.

The scratch file is not a project artifact. Do not write it inside the working tree and do not stage it.

## Message Structure Is Machine-Checked

`dev/tools/githooks/commit-msg` rejects a commit whose message is structurally broken. It exists because the failure above is silent: a mangled message is still a valid commit, and `git commit` reports success. It rejects

- an empty subject, or a subject that is only shell quoting debris;
- a second line that is not blank, which is how a displaced subject announces itself;
- a subject that is not in conventional commit form;
- an authorship or generator trailer, which the Limits section bans and an agent's own defaults supply anyway;
- a subject of 40 words or more, or a message of 400 or more;
- any word on the fiction-vocabulary denylist the hook carries, matched case-insensitively at word boundaries across the whole message.

The denylist is the only register rule the hook enforces, and it enforces it because a word list is a match rather than a judgement. Everything else about register — whether a bullet is a changelog entry or a piece of narration — is a judgement no hook can make, and the sections above remain the contract for it. Passing the hook is not evidence that a message is acceptable.

The list lives in the hook rather than here, so the rule and its enforcement cannot drift apart. It starts conservative and changes on evidence: a rejection is answered by rewording, and an entry that keeps blocking legitimate technical phrasing is deleted from the list.

Git locates the hook through per-clone configuration, so a fresh clone installs it once with `git config core.hooksPath dev/tools/githooks`.

Never commit with `--no-verify`. A message the hook rejects is a message to rewrite; an agent that cannot make one pass reports the rejection rather than bypassing it.

## Amending

Amend rewrites history and is not authorized, with one exception: correcting the message of a commit that was created in the current session, is still `HEAD`, and has never been pushed. That amend needs no further permission, and the report says it happened.

The exception exists because the alternative costs more than it protects. This failure is found seconds after the commit, when exactly one commit carries it; every commit added while permission is pending turns a one-commit fix into an interactive rebase over several. Nothing else may change under this exception — not the tree, not the author, not the parent — and a commit that has left the machine falls outside it entirely.

## Environment Overrides

No project-specific Git environment override is declared by the scaffold. Add only concrete permission or failure-handling differences here; do not copy the shared default.

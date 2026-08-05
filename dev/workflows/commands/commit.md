# /commit

Stage and commit the current work with a message that satisfies the project's commit rules.

## Authorization

Invoking this command is the user's explicit authorization for exactly two mutations: staging the changes named or clearly implied by the conversation, and one `git commit`. It authorizes nothing else — no push, no history rewrite, no branch or remote change.

The one amend it carries is the narrow message correction defined under Amending in `dev/agent_rules/git_operations.md`: same session, still `HEAD`, never pushed, message only. Any other amend is outside this command.

## Steps

1. Re-read `dev/agent_rules/git_operations.md` in full, even if it was read earlier in the session. Its Commit Messages section is the register contract every line of the message must pass.
2. Re-read `dev/foundation/core/workflows/commands/commit-msg.md` and the standards it references.
3. Inspect state read-only: `git status`, `git diff --cached`, `git diff`. If staged and unstaged changes disagree about what the commit should contain, say so and ask instead of guessing.
4. If the changes bundle unrelated work, propose a split before committing anything.
5. Do not run verification merely because `/commit` was invoked. Follow `dev/agent_rules/test_operations.md`: `npm run verify` is reserved for immediately before a branch merge, and any earlier narrow check needs an explicit user request or an approved spec that names it.
6. Compose the message, then self-check every line against the Subject, Body, and Limits rules before running the commit.
7. Write the message to a scratch file outside the repository and commit with `git commit -F <path>`, per Delivering The Message. Never pass it with `-m` and never assemble it in a shell — the message goes through no quoting on the way to Git.
8. Read the subject back with `git log -1 --pretty=format:'%s'` and confirm it is the single line intended. Printing `git log -1` is not this check; the check is looking at what came back. Then report `git log -1` and `git status`.

# /commit

Stage and commit the current work with a message that satisfies the project's commit rules.

## Authorization

Invoking this command is the user's explicit authorization for exactly two mutations: staging the changes named or clearly implied by the conversation, and one `git commit`. It authorizes nothing else — no push, no amend, no history rewrite, no branch or remote change.

## Steps

1. Re-read `dev/agent_rules/git_operations.md` in full, even if it was read earlier in the session. Its Commit Messages section is the register contract every line of the message must pass.
2. Re-read `dev/foundation/core/workflows/commands/commit-msg.md` and the standards it references.
3. Inspect state read-only: `git status`, `git diff --cached`, `git diff`. If staged and unstaged changes disagree about what the commit should contain, say so and ask instead of guessing.
4. If the changes bundle unrelated work, propose a split before committing anything.
5. Choose verification per `dev/agent_rules/test_operations.md` — `npm run verify` before delivering a change, plus `npm run check:governance` when a governance, startup, or planning document changed — and report what ran.
6. Compose the message, then self-check every line against the Subject, Body, and Limits rules before running the commit.
7. Commit, then confirm with `git log -1` and `git status`, and report both.

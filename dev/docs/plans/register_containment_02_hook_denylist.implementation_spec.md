# Hook Denylist

Parent Plan: `register_containment.plan.md`

## Goal

Make the commit half of the register contract machine-checked: the commit-msg hook rejects a message carrying the game's fiction vocabulary, names the word it matched, and points at the contract that explains the remedy.

## Summary

**Why.** The register rule for commit messages now exists and is loaded into every session, but a rule an agent can decline to apply is a rule that holds only while somebody is watching. The structure hook already exists for exactly this reason, and it currently declines register judgement outright — which is right for the judgement half (whether a bullet reads as a changelog entry) and wrong for the mechanical half (whether a known fiction word appears at all). A word list is not a judgement; it is a match.

**What changes.**

- The hook gains a newline-separated denylist variable holding the plan's fourteen entries, and one loop that matches each entry case-insensitively at word boundaries against the whole message. Multi-word entries match as phrases.
- A hit rejects the commit, prints the matched entry, and points at the Commit Messages section of the Git operations contract. The existing structure checks and the existing shared failure footer are untouched, so a message failing both kinds of check reports both.
- The hook's descriptive comment block stops claiming the hook never touches register, and says what it now does: the word list is mechanical, the judgement half is still the contract's.
- The `Message Structure Is Machine-Checked` section of the Git operations contract gains the denylist to its list of rejections, and its closing paragraph is corrected in the same change — passing the hook is still not evidence that a message is acceptable.

**Result.** A message carrying fiction vocabulary cannot be committed, and the failure names the word rather than asking the author to guess which of their sentences was wrong.

## Relational Context

- The hook runs under `sh` with `set -eu`. A `grep -q` that finds nothing exits 1, which is fatal outside a conditional — every denylist match must therefore stay inside an `if` condition, exactly as the existing checks do.
- The hook's `reject` helper sets `failed=1` rather than exiting, so all findings print together. The denylist loop must run in the current shell, not a pipeline subshell, or its `failed` assignment is discarded and a rejected message commits.
- The list is matched against `$message`, which is the raw file with comment lines already stripped. Subject and body are both covered by one pass; no second check per line is needed.
- POSIX ERE has no portable word-boundary escape, so boundaries are expressed as bracket negations anchored to line start and end. Any entry added later inherits that treatment by being a list item rather than its own grep call — which is the point of keeping the list a plain variable.
- The Git operations contract enumerates what the hook rejects. That list and the hook are two statements of one fact, so they change in the same commit or the contract starts lying.
- `dev/tools/check_governance.py` asserts that the Git contract names `dev/tools/githooks/commit-msg`. That pointer is untouched here.
- The hook is not on the `npm run verify` path and has no unit coverage. It is exercised by the commits this plan itself makes, and directly by running the script against a prepared message file.

## Scope

### Included

- The denylist variable, the matching loop, and the rejection text in `dev/tools/githooks/commit-msg`.
- The hook's descriptive comment block.
- The rejection list and the closing paragraph of `## Message Structure Is Machine-Checked` in `dev/agent_rules/git_operations.md`.

### Excluded

- Any change to the existing structure checks, their thresholds, or their messages.
- Any relaxation of the commit rules; the denylist is additive, per the plan's fourth non-goal.
- Rewriting historical commit messages.
- A unit or browser test for the hook.

## Files to Change

| File                                | Change Size | Purpose                                                     |
| ----------------------------------- | ----------- | ----------------------------------------------------------- |
| `dev/tools/githooks/commit-msg`     | Medium      | The denylist, the matching loop, and the corrected preamble |
| `dev/agent_rules/git_operations.md` | Small       | The machine-checked list gains the denylist                 |

## Execution Outline

1. Add the denylist variable near the existing `TYPES` and limit constants, so every tunable in the hook stays in one place.
2. Add the matching loop after the trailer checks and before the message-length check, keeping the ordering of findings roughly subject-first.
3. Correct the hook's preamble comment.
4. Update the rejection list and the closing paragraph in the Git operations contract.
5. Verify by running the hook against a prepared message that carries a denylist word, and against one that does not, checking both exit codes and the printed text. Then run `npm run verify` and `npm run check:governance`.

## Implementation Notes

- Entries are stored newline-separated in a single-quoted variable and iterated with `IFS` set to a newline for the loop only, restored afterwards. A space-separated list cannot hold the multi-word entries.
- The boundary pattern is `(^|[^[:alnum:]])<entry>([^[:alnum:]]|$)` with `grep -Eqi`. It deliberately treats an apostrophe as a boundary, so a possessive form is caught, and treats an adjacent letter as no boundary, so a longer word containing an entry is not.
- The rejection line names the entry as matched, not the surrounding sentence: the author has the message in front of them and the word is what they need.
- Every entry in the plan's table lands, including both singular and plural forms where the table lists them. The list starts conservative and is a one-line diff to change, which is what makes removing a bad entry cheap.

## Edge Cases

| Case                                                      | Expected Handling                                                                  |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| A legitimate technical word contains an entry as a prefix | Not matched; the boundary pattern requires a non-alphanumeric character or an edge |
| A possessive or plural form of an entry                   | Matched, because an apostrophe and a space are both boundaries                     |
| A message failing a structure check and the denylist      | Both are printed, because rejections accumulate rather than exit                   |
| An entry appears inside a stripped comment line           | Not matched; comment lines are removed before any check runs                       |

## Acceptance Criteria

1. A commit whose message carries a fiction-vocabulary word is rejected, and the rejection names the matched word and points at the commit contract.
2. A message with no denylist word and correct structure is accepted unchanged.
3. The Git operations contract's list of what the hook rejects includes the denylist, and its closing paragraph no longer claims the hook makes no register check at all.
4. The existing structure checks behave exactly as before.
5. The aggregate verification gate and the governance check both pass.

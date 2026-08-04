# Register Containment

Goal-Executable: yes

## Goal

Stop the literary prose register from reproducing itself in code comments and commit messages. The register originates from earlier agent sessions, not from any standard; it now persists through two carriers — the existing comment corpus, which agents imitate by default, and a commit-rule gap that lets fiction vocabulary through in noun phrases. This plan closes the rule gaps, makes the commit half machine-checked, and rewrites the corpus that feeds the imitation loop.

## Requirements

1. A register contract for comments and commits exists in a location loaded into every agent session unconditionally — not behind a read-on-trigger standard, because the trigger model is the mechanism that already failed: the one existing comment rule sits in a standard most comment-writing sessions never open.
2. The contract explicitly overrides style imitation. Agent harnesses instruct agents to match surrounding code style, so a contract that does not name and cancel that instruction loses to the corpus every time.
3. The commit message rules close the noun-phrase gap. The current rules govern verbs and bullet structure, so a subject like "adjust how a body dies when it goes under" passes while carrying pure fiction in its object phrase. Register must govern every word of the message.
4. The commit hook rejects messages containing known fiction vocabulary. The project has already established that only machine-checked rules hold; the structure hook exists for exactly this reason and explicitly declines register judgement today.
5. The comment corpus in the rules layer is rewritten to plain technical register, because as long as roughly a third of that layer is literary prose, imitation regenerates the register regardless of rules. Rewrites are comment-only changes: no code motion, no behavior change.

## Design

### The register, stated once

Plain technical register means: state the constraint, the invariant, or the non-obvious reason directly, in neutral vocabulary, in as few sentences as the fact needs — normally one or two. No narrative, no metaphor, no personification, no rhetorical structure ("X is not Y — it is Z"), no history lessons unless the history is itself the constraint.

The game's fiction vocabulary — body, mind, owes, pays, asks, business, errand, goes under, crawls out, stirs, and the like — never appears in comments or commit messages in narrative position. Naming a symbol that carries such a word (a field named `mind`, a function named `bodyFootprint`) is allowed; adopting the voice around it is not.

### Where each piece lives

- The always-loaded project instructions carry a short section stating the register and the imitation override, and pointing to the two full contracts. This is the only file the harness injects into every session without any read step, so it is the only placement that cannot be skipped.
- The full comment contract lives in the project-local code style addendum — the declared home for project code-style deltas.
- The full commit contract already lives in the Git operations contract's Commit Messages section; it gains the noun-phrase closure and a note that the hook enforces a denylist.
- The denylist itself lives in the commit hook, beside the structure checks, so the list and its enforcement cannot drift apart. It starts conservative and grows only on evidence: a false rejection is fixed by rewording the message, which is the intended effect, but a word that keeps blocking legitimate technical phrasing is removed.

### Initial denylist

Case-insensitive, word-boundary matched, applied to the whole message:

| Entry            | Reason                                                        |
| ---------------- | ------------------------------------------------------------- |
| body, bodies     | Fiction word for enemies; the mechanism word is "enemy"       |
| mind, minds      | Fiction word for AI state; the mechanism word is "AI"/"state" |
| owes, pays, paid | Economy-of-the-dungeon narration                              |
| errand           | Wander-state narration                                        |
| crawls           | Reinforcement narration                                       |
| stirs            | Difficulty narration                                          |
| goes under       | Drowning narration; the mechanism word is "drowning"          |
| as themselves    | Rendering narration                                           |
| announces        | Message-line narration                                        |
| breathes         | Idle-animation narration                                      |

### Corpus rewrite policy

- Keep every module's doc block, rewritten to one to three plain sentences of purpose.
- Keep a comment where it states a constraint, an invariant, or a why that the code cannot show; rewrite it to at most two plain sentences.
- Delete comments that narrate what the code does, tell the history of a decision whose outcome is now self-evident, or exist for voice.
- Never change code in the same edit. A rewrite commit touches comments only, so review is trivially about register and the behavior question never opens.
- Measurable target: the rules layer's comment-line share drops from 32% to at most 12%. The number is a floor check against timidity, not a quota to hit by deletion — a constraint comment is kept even if the file ends above the target.

### Child overview

| Child | Focus                       | Form                                                           |
| ----- | --------------------------- | -------------------------------------------------------------- |
| 2     | Commit hook denylist        | `register_containment_02_hook_denylist.implementation_spec.md` |
| 3     | Rules-layer comment rewrite | This plan, Execution below                                     |

Landing order: 2, 3. Child 1 has shipped; the register contract it added is the one child 3 cites.

## Non-Goals

1. No rewrite of the project-local governance documents' own prose. They are the second carrier, but the cost is high, the semantic-drift risk is real, and the always-loaded override is expected to hold without it. Promote to its own plan only if regressions continue after this plan lands.
2. No change to the upstream foundation submodule. Its documents are already in plain register.
3. No rewrite of comments outside the rules layer in this plan. Other layers follow opportunistically: any change that touches a file rewrites the comments it touches, per the contract.
4. No relaxation of the existing commit structure rules; the denylist is additive.
5. Historical commit messages stay as they are, and nothing under the frozen report directory is rewritten to satisfy the register.

## Acceptance Criteria

1. A fresh agent session, with no prompting beyond the task, receives the register contract without reading any trigger-gated standard. Judged by inspecting what the harness loads.
2. A commit message containing a denylist word is rejected by the hook with a message naming the word and pointing at the contract. Judged by attempting one.
3. The rules layer's comment-line share is at or below 12%, measured by the same line-classification count that produced the 32% baseline, and the full verification gate passes with a diff that contains no code changes in the rewrite commits.
4. Module doc blocks still exist for every rules-layer module.

## Execution

Perishable coordinates, recorded 2026-08-04 at commit b8ad8d5. Re-check against live code before executing. Conflicts resolve in favor of the conceptual half.

Required reading before executing child 2: `dev/foundation/core/standards/governance_structure_standard.md` and `dev/foundation/core/standards/consumer_operations_standard.md` (both trigger on governance/contract edits). Governance edits require `npm run check:governance` per `dev/workflows/commands/commit.md` step 5.

### Child 2 — hook denylist

File: `dev/tools/githooks/commit-msg` (shell script; current checks: empty subject, non-blank second line, conventional-commit subject shape, authorship trailers, 40-word subject / 400-word message limits).

Add a case-insensitive, word-boundary grep over the full message for the Design table's entries. Multi-word entries match as phrases. On hit: reject, print the matched word and a pointer to the Commit Messages section of `dev/agent_rules/git_operations.md`. Keep the list as a plain variable in the script so a change to it is a one-line diff. Update the hook's descriptive comment block and the "Message Structure Is Machine-Checked" list in `dev/agent_rules/git_operations.md` in the same change (it enumerates what the hook rejects).

### Child 3 — rules-layer comment rewrite

Scope: all 26 modules under `src/core/`. Baseline measurement (32%):

```bash
total=$(find src/core -name '*.ts' | xargs cat | wc -l); comments=$(find src/core -name '*.ts' | xargs cat | grep -cE '^\s*(/\*|\*|//)'); echo "$comments/$total"
```

Suggested order: one commit per file for the four large files — `src/core/floor/maze.ts` (1448 lines), `src/core/world/world.ts` (1188), `src/core/world/simulation.ts` (1055), `src/core/combat/enemy-ai.ts` (944) — then the remaining 22 modules batched by domain directory. Coordination: if the enemy behavior split plan (`dev/docs/plans/enemy_behavior_split.plan.md`) is executing concurrently, leave `enemy-ai.ts` to that plan — it rewrites the comments of everything it moves — and sweep only what remains of the file afterwards.

Each commit: comments only, `npm run verify` before delivery. Commit subjects in the new register, e.g. `docs(core): rewrite floor assembly comments to plain register`.

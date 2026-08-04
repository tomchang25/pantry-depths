# Register Contract

Parent Plan: `register_containment.plan.md`

## Goal

Put the plain-register rule for code comments and commit messages where every agent session loads it without a trigger, cancel the harness default that tells an agent to imitate the surrounding style, and close the noun-phrase gap in the commit rules so register governs every word of a message rather than only its verbs.

## Summary

**Why.** The literary register in this repository's comments and commit subjects reproduces itself through two carriers. The first is the comment corpus: agents are told by default to match surrounding style, so the existing prose is the template. The second is the commit rules, which govern verbs and bullet structure but not the noun phrases those verbs act on — which is how a subject like "adjust how a body dies when it goes under" passes a rule set that is working as written. The one existing comment rule sits in a trigger-gated standard, and the trigger model is the mechanism that already failed: most comment-writing sessions never open it.

**What changes.**

- `CLAUDE.md` and `AGENTS.md` gain a short `## Register` section stating the register in two sentences, naming the fiction-vocabulary rule, pointing at the two full contracts, and explicitly overriding the match-the-surrounding-style default. These are the only two files a harness injects with no read step, and they are maintained as mirrors of each other, so the section lands in both.
- `dev/standards/code_style.addendum.md` gains `## Comment Register`, the full comment contract: what a comment is for, the length bound, the fiction-vocabulary rule, the module doc-block rule, and the rule that existing literary comments are legacy rather than a template. It follows the addendum's existing Why / How to apply shape.
- `dev/agent_rules/git_operations.md` gains two bullets under Commit Messages → Body: register governs every word of the message including subject noun phrases, and the hook rejects a fiction-vocabulary denylist whose remedy is rewording. Existing bullets are untouched.
- `dev/tools/check_governance.py` gains pointer assertions for the three new headings, so a rename or deletion fails the governance check instead of silently stranding the contract.

**Result.** A fresh session receives the register contract before it writes anything, with no trigger to fire and no standard to open, and the commit rules stop leaving the object of a sentence ungoverned.

## Relational Context

- `CLAUDE.md` and `AGENTS.md` are paired root entry points with identical bodies; `dev/tools/check_governance.py` verifies both carry the same three startup pointers. A section added to one and not the other leaves the non-Claude entry point without the contract, which is the failure this child exists to prevent.
- `CLAUDE.md` states that it "defines no rules of its own beyond this load order and defers entirely to the documents above". The `## Register` section is a deliberate narrow exception, and it must say so by pointing at the full contracts rather than becoming a third owner of them. The full rules live in the addendum and the Git contract; the root files carry a summary and the override.
- `dev/standards/code_style.addendum.md` is the declared project-local delta to the platform code style standard and is reached through one trigger row in `dev/agent_rules/agent_startup.md` and one in `dev/README.md`. It stays the canonical owner of the comment contract; the root section does not replace it.
- The Git contract's `## Message Structure Is Machine-Checked` section enumerates what the hook rejects. Child 2 adds the denylist to both the hook and that list. This child adds only the Body bullet naming the denylist, so between the two commits the Body bullet describes a check the hook does not yet run. That window is one commit wide and closes inside this plan's run.
- `dev/tools/check_governance.py` asserts substring presence only. An assertion must name a heading stable enough to survive ordinary editing, so the three added fragments are headings rather than sentences.
- Governance edits run `npm run check:governance` outside `npm run verify`, per `dev/agent_rules/test_operations.md`. Both run for this child.

## Scope

### Included

- The `## Register` section in `CLAUDE.md` and `AGENTS.md`.
- The `## Comment Register` section in `dev/standards/code_style.addendum.md`.
- Two bullets under Commit Messages → Body in `dev/agent_rules/git_operations.md`.
- Three pointer assertions in `dev/tools/check_governance.py`.

### Excluded

- The commit hook denylist and the `## Message Structure Is Machine-Checked` list entry — child 2 owns both.
- Any rewrite of existing comments — child 3 owns that.
- Any rewrite of the project-local governance documents' own prose, per the plan's first non-goal.
- Any change to the foundation submodule.
- New tests of any kind.

## Files to Change

| File                                   | Change Size | Purpose                                                             |
| -------------------------------------- | ----------- | ------------------------------------------------------------------- |
| `CLAUDE.md`                            | Small       | The always-loaded register summary and the style-imitation override |
| `AGENTS.md`                            | Small       | The same section, keeping the paired entry points mirrored          |
| `dev/standards/code_style.addendum.md` | Medium      | The full comment contract                                           |
| `dev/agent_rules/git_operations.md`    | Small       | The noun-phrase closure and the denylist note                       |
| `dev/tools/check_governance.py`        | Small       | Pointer assertions for the three new headings                       |

## Execution Outline

1. Write `## Comment Register` in the code style addendum first, so the root sections have a real target to point at.
2. Add the two Body bullets to the Git operations contract.
3. Add the identical `## Register` section to `CLAUDE.md` and `AGENTS.md`, after `## Required contracts` in both.
4. Extend `CONTRACTS` in the governance checker with the three headings.
5. Run `npm run verify` and `npm run check:governance`.

## Implementation Notes

- The root section is a summary with pointers, not a contract. Keep it to one short paragraph; anything that needs a second paragraph belongs in the addendum instead.
- The style override has to name what it overrides. An agent harness instructs agents to match surrounding code style, so a section that merely states the correct register loses to the corpus; the sentence saying the existing comments are legacy is the load-bearing half.
- The addendum's existing section uses bold `**Why:**` and `**How to apply:**` labels after the rule body. Follow that shape rather than inventing a second one in the same file.
- The Git contract's Body bullets are terse, verbless-where-possible fragments. The two additions match that shape rather than arriving as full sentences with reasoning attached — reasoning in that file lives in prose paragraphs, not in the bullet lists.
- The checker's `CONTRACTS` entries for `CLAUDE.md` and `AGENTS.md` already exist; add `"## Register"` to both lists rather than creating new entries.

## Edge Cases

| Case                                                           | Expected Handling                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| A comment must name a symbol carrying a fiction word           | Allowed; the contract governs the voice around the symbol, not the symbol's spelling |
| A commit message must describe drowning behavior               | Allowed under the mechanism word; the fiction phrasing is what the denylist rejects  |
| An agent reads only `AGENTS.md` and never the addendum         | It still has the register and the override; the addendum adds detail, not the rule   |
| A future rename moves the comment contract out of the addendum | The governance check fails on the missing heading, which is the intended signal      |

## Acceptance Criteria

1. A session that reads only the root entry point receives the register rule, the fiction-vocabulary rule, the style-imitation override, and pointers to both full contracts, with no trigger fired and no standard opened.
2. The comment contract states what a comment is for, its length bound, the fiction-vocabulary rule, the module doc-block rule, and the legacy-is-not-a-template rule, in the file the project already declares as the owner of code-style deltas.
3. The commit rules state that register governs every word of a message, including the noun phrases in a subject, and name the hook's denylist and its remedy.
4. Both root entry points carry identical register sections.
5. The aggregate verification gate and the governance check both pass.

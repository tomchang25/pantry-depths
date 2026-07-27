# Design Document Freeze

This file is a project-local standard for Pantry Depths. It governs `dev/docs/design/` and supersedes every earlier statement that named a document in that directory as a live authority, including the lifetime table inside `pantry-depths_v1.md` and the authority model inside `pantry_depths_v1.mega_plan.md`.

The directory holds source documents, not only game design. A milestone plan lands here once its streams have shipped, for the same reason a design document does: it existed to produce the layer below it, and that has happened.

## The Rule

`dev/docs/design/` is frozen.

- **Do not modify any file in it.** Not to correct a number, not to match shipped behaviour, not to remove a contradiction, and specifically not to stop it going stale.
- **Do not read it to answer a question about the game.** Consulting it requires an explicit, current instruction from the user naming the document.
- **Do not cite it to justify or block a change.** It is not evidence for or against anything being built now.
- **The only permitted change to the directory is adding a new design document.** Adding one is a product event, not an edit: it produces new plans and updates the existing sketches, and the superseded document stays in place untouched.

## What A Frozen Source Document Is For

Such a document exists to be the origin of the layer derived from it, once. That is its entire function, and it is spent the moment that layer exists: a design document is spent when the plans exist, and a milestone plan is spent when its streams have landed.

Every subsequent decision — a retuned number, a changed control scheme, a rule that resolved differently in practice — invalidates the document a little further. That is expected and is not a defect to be repaired. A design document is a photograph of the intent at the moment work started, and it is useful precisely because it does not move.

## Why Editing It Is Worse Than Letting It Rot

Keeping a spent design document synchronised with the code costs real effort and buys nothing, because nothing reads it for truth. Worse, a partially-updated document is more dangerous than an obviously old one: a reader cannot tell which paragraphs were refreshed and which were left behind, so every sentence becomes untrustworthy while still looking authoritative. A document that is uniformly stale is safe, because its staleness is total and evident.

The same argument forbids referencing it. A frozen document will contradict the codebase, by design and increasingly over time. Any decision that leans on it is leaning on a number that was superseded without notice.

## Where The Answers Actually Live

| Question                                         | Ask                                                     |
| ------------------------------------------------ | ------------------------------------------------------- |
| What is the number?                              | `src/content/`                                          |
| What is the rule?                                | `src/core/`                                             |
| What does it feel like to play?                  | Run it — presentation has no automated coverage         |
| What ships, in what order?                       | `dev/docs/plans/`                                       |
| What is not being built, and why?                | The plan that decided it, or `TODO.md` under `## Draft` |
| What are the observed combat and route outcomes? | The generated balance report                            |
| What changed and when?                           | `CHANGELOG.md`                                          |

A scope contract — a deliberate decision _not_ to build something — used to live only in the design document, on the grounds that no code can encode "we chose not to do X". That reasoning stands, but the owner moves: record such a decision in the plan that made it, or in `TODO.md` under `## Draft`. Both are live documents that a reader is allowed to trust.

## Navigational Mentions Are Not References

A README or tracker may state that the directory exists and what era it belongs to. That is navigation, not consultation, and it does not require an instruction.

What the rule forbids is opening the document to find out what is true, and quoting it as support for a decision. If a sentence you are about to write would change should the design document say something different, you are referencing it and must stop.

## Adding A New Design Document

When the product direction shifts far enough to need one:

1. Add a new file; never edit an existing one.
2. Derive the plans and sketch updates from it in the same change, because that derivation is the only reason it exists.
3. Leave every earlier document exactly where it is. They are not superseded content to be cleaned up; they are the record of what each generation of plans was derived from.

## Freezing A Spent Plan

Moving a plan in here is the same operation run late, and it carries one obligation the plans-to-archive path does not: **lift anything still pointing forward before the move.** A frozen document is unreadable by default, so a forward-looking statement left inside it is lost rather than parked. Definitions of done, unanswered product questions, and requirements for artifacts not yet built all belong in `TODO.md` under `## Draft` before the file moves.

Backward-looking content stays and is the reason the file is kept: decision records with their rationale, risk history, and the measurements planning was based on. Nothing else records why a decision went the way it did.

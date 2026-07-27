# Development Documents

These files describe Pantry Depths' product intent and forward work. They do not replace durable rules under `dev/standards/` or the shared foundation.

- `plans/pantry_depths_v1.mega_plan.md`: the V1 milestone. Owns architecture, delivery scope, landing order, cross-cutting invariants, decision records, and future work. Start here.
- `design/`: **frozen.** The design documents that the plans were originally derived from. Do not read, cite, or edit them without an explicit instruction naming one; the only permitted change to the directory is adding a new document. See `dev/standards/design_document_freeze.md`.
- `reports/`: human-readable views of the implemented truth. `pantry_depths_balance.html` is regenerated from content data; `pantry_depths_architecture.html` is hand-written.
- `../../TODO.md`: forward work that no plan owns. Plan children are tracked in their plan's child overview, never here.
- `../../CHANGELOG.md`: append-only shipped-outcome history.

## Authority

| Question                                                       | Ask                                               |
| -------------------------------------------------------------- | ------------------------------------------------- |
| What is the actual number?                                     | `src/content/`                                    |
| What is the rule?                                              | `src/core/`                                       |
| Why is it this way, and what are we deliberately not building? | The plan that decided it, or `TODO.md` `## Draft` |
| What ships, in what order?                                     | The mega plan                                     |
| What are the observed combat and route outcomes?               | The generated balance report                      |
| How do I add an enemy?                                         | The architecture report                           |

No row points at `design/`, and that is deliberate. It is expected to contradict the codebase, and `dev/standards/design_document_freeze.md` owns why that is fine and why it must not be repaired.

## Layout

| Directory   | Contents                                                     |
| ----------- | ------------------------------------------------------------ |
| `design/`   | Frozen design documents; append-only, never read by default  |
| `plans/`    | Active plans, sketches, and implementation specs             |
| `reports/`  | Review, verification, and closeout reports                   |
| `archived/` | Completed or superseded plans and specs retained for history |

## Lifecycle Scope For V1

V1 is a one-week prototype delivered by a single author, but its rules, presentation port, feel/endgame work, and final floor design use different evidence and landing sequences. The design document served as the product draft that seeded the mega plan and was spent in doing so; the mega plan owns milestone ordering, and four critical-path main plans own the durable requirements and child overviews for those execution streams. Rules and Content and the Presentation Port are shipped and archived, as is the optional Authoring Workbench; the remaining two critical-path plans stay active below the milestone.

The critical-path route is one-way — the arrow out of the design draft was taken once and is never walked back up:

```text
design draft (frozen after this arrow)
-> V1 mega plan
-> active feel or final-floor main plan
-> focused child implementation spec
-> implementation
-> verification
-> child closeout
```

Optional tooling and content plans may run alongside that route without changing the presentation-first V1 dependency order. The Authoring Workbench has shipped; Scene Authoring and Live Preview is the queued successor, and `TODO.md` tracks the standalone sketches that no plan owns.

Child sketches remain optional and are opened only when an implementation boundary needs exploration. Every child still requires an implementation spec before source mutation and verification against `dev/agent_rules/test_operations.md` before it is called delivered. The approved minimal slime and gameplay sprite manifest is part of the Presentation Port rather than a separate delivery stream.

# Development Documents

These files describe Pantry Depths' product intent and forward work. They do not replace durable rules under `dev/standards/` or the shared foundation.

- `plans/pantry_depths_v1.mega_plan.md`: the V1 milestone. Owns architecture, delivery scope, landing order, cross-cutting invariants, decision records, and future work. Start here.
- `design/pantry-depths_v1.md`: the game design document. **Pre-implementation authority only** — its formulas and numbers expire once `src/core/` and `src/content/` exist. Its scope contract and design intent do not expire. See the document's own lifetime section.
- `reports/`: human-readable views of the implemented truth. `pantry_depths_balance.html` is regenerated from content data; `pantry_depths_architecture.html` is hand-written.
- `../../TODO.md`: forward work that no plan owns. Plan children are tracked in their plan's child overview, never here.
- `../../CHANGELOG.md`: append-only shipped-outcome history.

## Authority

| Question                                                       | Ask                          |
| -------------------------------------------------------------- | ---------------------------- |
| What is the actual number?                                     | `src/content/`               |
| What is the rule?                                              | `src/core/`                  |
| Why is it this way, and what are we deliberately not building? | The design document          |
| What ships, in what order?                                     | The mega plan                |
| What are the observed combat and route outcomes?               | The generated balance report |
| How do I add an enemy?                                         | The architecture report      |

When the design document and the codebase disagree about a number, the codebase is right and the design document does not need fixing.

## Layout

| Directory   | Contents                                                     |
| ----------- | ------------------------------------------------------------ |
| `design/`   | Product design documents                                     |
| `plans/`    | Active plans, sketches, and implementation specs             |
| `reports/`  | Review, verification, and closeout reports                   |
| `archived/` | Completed or superseded plans and specs retained for history |

## Lifecycle Scope For V1

V1 is a one-week prototype delivered by a single author, but its rules, presentation port, feel/endgame work, and final floor design use different evidence and landing sequences. The design document therefore serves as the product draft, the mega plan owns milestone ordering, and four critical-path main plans own the durable requirements and child overviews for those execution streams. Rules and Content is shipped and archived; the remaining three critical-path plans stay active below the milestone, while the optional Authoring Workbench main plan runs independently.

The critical-path route is:

```text
design draft
-> V1 mega plan
-> active presentation, feel, or final-floor main plan
-> focused child implementation spec
-> implementation
-> verification
-> child closeout
```

The optional Authoring Workbench plan may run alongside that route. Its active child handoff remains in the authoring plan's child overview and does not change the presentation-first V1 dependency order.

Child sketches remain optional and are opened only when an implementation boundary needs exploration. Every child still requires an implementation spec before source mutation and verification against `dev/agent_rules/test_operations.md` before it is called delivered. The parallel enemy-sprite deliverable is asset production, not a fifth main plan.

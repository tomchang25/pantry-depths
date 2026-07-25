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
| Is the balance sane?                                           | The generated balance report |
| How do I add an enemy?                                         | The architecture report      |

When the design document and the codebase disagree about a number, the codebase is right and the design document does not need fixing.

## Layout

| Directory   | Contents                                         |
| ----------- | ------------------------------------------------ |
| `design/`   | Product design documents                         |
| `plans/`    | Active plans, sketches, and implementation specs |
| `reports/`  | Review, verification, and closeout reports       |
| `archived/` | Superseded plans and specs retained for history  |

## Lifecycle Scope For V1

V1 is a one-week prototype delivered by a single author. It runs the reduced lifecycle path that `dev/foundation/core/workflows/work_lifecycle.md` already permits: the design document serves as the draft, and work goes straight to a standalone implementation spec. No main plan, probe, or child sketch is opened unless a specific piece of work actually needs one.

The stages that remain mandatory are unchanged: an implementation spec before implementation, and verification against `dev/agent_rules/test_operations.md` before a change is called delivered.

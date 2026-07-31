# Development Documents

These files describe Pantry Depths' product intent and forward work. They do not replace durable rules under `dev/standards/` or the shared foundation.

- `design/`: **frozen.** The documents the plans were originally derived from. See `dev/standards/frozen_reference_directories.md`.
- `plans/`: active plans, sketches, and implementation specs. Start here, then `../../TODO.md`.
- `briefs/`: format-free material handed to a later session. Authorizes nothing, and is deleted once it has seeded a real artifact. See `dev/standards/work_lifecycle.addendum.md`.
- `reports/`: **frozen.** Snapshots of how the project looked when they were written. Same standard, same rule.
- `../../TODO.md`: forward work that no plan owns. Plan children are tracked in their plan's child overview, never here.
- `../../CHANGELOG.md`: append-only shipped-outcome history.

## Authority

| Question                                                       | Ask                                               |
| -------------------------------------------------------------- | ------------------------------------------------- |
| What is the actual number?                                     | `src/content/`                                    |
| What is the rule?                                              | `src/core/`                                       |
| Why is it this way, and what are we deliberately not building? | The plan that decided it, or `TODO.md` `## Draft` |
| What ships, in what order?                                     | `../../TODO.md` and the active plans              |

No row points at `design/` or `reports/`, and that is deliberate. Both are expected to contradict the codebase, and `dev/standards/frozen_reference_directories.md` owns why that is fine and why it must not be repaired.

## Layout

| Directory   | Contents                                                              |
| ----------- | --------------------------------------------------------------------- |
| `design/`   | Frozen source documents; append-only, never read by default           |
| `plans/`    | Active plans, sketches, and implementation specs                      |
| `briefs/`   | Format-free seeds for a later session; never an authority             |
| `reports/`  | Review, verification, and closeout reports                            |
| `archived/` | Completed or superseded plans, specs, and briefs retained for history |

## Lifecycle Scope For V1

V1 is a one-week prototype delivered by a single author, and its rules, presentation port, feel and endgame work, and final floor design used different evidence and landing sequences. Rules and Content, the Presentation Port, Feel and Endgame, and the optional Authoring Workbench have all shipped and are archived; Final Floor Design is the last critical-path plan still active, with Scene Authoring and Live Preview running alongside it.

Both documents that once sat above the plans — the design draft and the V1 milestone plan — are spent and frozen. Each existed to produce the layer below it, and that has happened. What still pointed forward from either was lifted into `TODO.md` before freezing, so the route is now:

```text
frozen source documents (never walked back up)
-> active plan or standalone sketch
-> focused implementation spec
-> implementation
-> verification
-> closeout
```

`TODO.md` is the forward-work authority and owns anything no plan does.

Child sketches remain optional and are opened only when an implementation boundary needs exploration. Every child still requires an implementation spec before source mutation and verification against `dev/agent_rules/test_operations.md` before it is called delivered. The approved minimal slime and gameplay sprite manifest is part of the Presentation Port rather than a separate delivery stream.

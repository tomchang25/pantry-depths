# Pantry Depths Rules and Content

## Goal

Build the deterministic gameplay model, authored progression content, fixed five-floor world, and inspection surfaces that make Pantry Depths playable and balanceable without depending on the final renderer. The rules must be observable from the first implementation slice so combat, turn order, and map topology can be debugged before presentation work lands.

## Requirements

1. Resolve every gameplay command deterministically from explicit state and authored content, because replayable outcomes are the basis of both balance analysis and reproducible playtest failures.
2. Keep mutable run state and gameplay formulas in the rules owner while authored numbers and layouts remain pure content; neither may depend on the browser, HUD, renderer, wall-clock timing, or random input.
3. Implement the complete V1 ruleset: four-direction grid movement, no backward movement, adjacency retaliation, deterministic combat, three key colors, six doors, four stat upgrades, bidirectional stairs, one breakable wall, one reusable hot spring, death, and the princess victory trigger.
4. Ship five fixed, hand-reviewed floors from an offline bake rather than generating maps during play, because runtime generation would add connectivity and recovery behavior outside the V1 budget.
5. Provide a development-only debug hub and focused viewers that consume the real command and snapshot boundaries; debug tools must never duplicate formulas, own gameplay truth, or mutate state through a bypass.
6. Prove the rules through focused domain tests, deterministic scenarios, topology checks, and a regenerable balance report that derives every displayed value from the same content and formulas used by play.

## Design

### Ownership and determinism

The rules owner is the sole authority for mutable run state, command validation, combat outcomes, door effects, floor transitions, death, and victory. Authored content supplies player baselines, enemy definitions, door effects, floor layouts, and other values without branches or mutable run fields. Presentation receives immutable snapshots and semantic events; animation completion never decides whether a rule occurred.

The following inputs are prohibited from gameplay resolution: randomness, browser state, frame duration, animation progress, audio state, and wall-clock time. Two runs beginning from the same state and applying the same command sequence must produce equal states and equal semantic-event sequences.

### Player stages and combat

| Stage | Trigger           | Attack | Defense |
| ----- | ----------------- | -----: | ------: |
| 0     | Start             |      3 |       0 |
| 1     | First blue door   |      5 |       0 |
| 2     | First yellow door |      5 |       2 |
| 3     | Large blue door   |     10 |       2 |
| 4     | Large yellow door |     10 |       6 |

Maximum health is 120 and never grows. The hot spring may restore current health to 120 but is not part of the required-route balance.

Both sides use the same damage rule: `max(0, attacker attack - defender defense)`.

For a stationary enemy that retaliates after each surviving hit:

- Hits to kill are the ceiling of enemy health divided by positive player damage.
- Damage per retaliation is enemy attack minus player defense, with a lower bound of zero.
- Kill cost is one fewer retaliation than hits to kill, multiplied by damage per retaliation.
- When player damage is zero, the enemy cannot be defeated and the attempted attack still consumes an Action and permits retaliation.
- An enemy killed by the player's current attack is removed before the adjacency scan and does not retaliate.

| Enemy    | Health | Attack | Defense |    Stage 0 |    Stage 1 |    Stage 2 | Stage 3 | Stage 4 |
| -------- | -----: | -----: | ------: | ---------: | ---------: | ---------: | ------: | ------: |
| Bat      |      3 |      2 |       0 |          0 |          0 |          0 |       0 |       0 |
| Goblin   |      6 |      4 |       0 |          4 |          4 |          2 |       0 |       0 |
| Skeleton |     10 |      6 |       1 |         24 |         12 |          8 |       4 |       0 |
| Guard    |     20 |     10 |       3 | Impassable |         90 |         72 |      16 |       8 |
| Princess |     30 |     14 |       5 | Impassable | Impassable | Impassable |      60 |      40 |

Every cell of this matrix, including every impassable case, is executable evidence rather than a copied report value.

An enemy definition contains only its cell, health, attack, defense, and appearance identifier. It has no movement speed, sight, behavior, target selection, reward, special ability, or status state.

### Command and retaliation order

One accepted player tick resolves atomically in this order:

1. Capture the surviving enemies edge-adjacent to the player's pre-tick cell.
2. Validate and apply the requested movement, turn, attack, or interaction.
3. If attacking, damage only the target in the facing-adjacent cell.
4. Remove any enemy reduced to zero health.
5. For every enemy captured in step 1 that survives, inspect whether it remains edge-adjacent to the player's post-tick cell and apply one retaliation only when that adjacency holds at both tick boundaries.
6. Enter the death outcome when player health reaches zero; otherwise emit the resulting snapshot and semantic events.

Diagonal enemies never retaliate. A solid wall or closed door prevents occupancy and adjacency across that cell. A forward request into either one is cancelled before a player tick begins, so it creates no Action and no retaliation. A surviving enemy directly attacked by the player remains adjacent at both boundaries and retaliates; an enemy killed by that attack does not. Entering an enemy's adjacency or leaving it during a successful forward movement produces no retaliation from that enemy, while a turn in place beside it does. Left-turn, right-turn, and interaction requests are Actions even when a locked door cannot open. A backward request is rejected before Action resolution and therefore causes no retaliation. The presentation of that rejection belongs to the feel plan.

### Keys, doors, and progression

Keys are counted by color and are not individually identified. Opening a door consumes one matching key, permanently makes its cell passable, applies its authored effect once, and then permits adjacency retaliation.

| Color  | Meaning | Keys | Doors and effects                                     |
| ------ | ------- | ---: | ----------------------------------------------------- |
| Red    | Route   |    2 | Access to the second floor; access to the fifth floor |
| Blue   | Attack  |    2 | Attack +2; attack +5                                  |
| Yellow | Defense |    2 | Defense +2; defense +4                                |

The fourth-floor convergence room presents the large blue, red, and yellow doors together. They are not mutually exclusive; the meaningful cost is acquiring their keys upstream. The large blue door is the only hard progression requirement because the princess cannot be damaged without it.

### Floors and specials

| Floor | Size    | Theme          | Required authored landmarks                               |
| ----- | ------- | -------------- | --------------------------------------------------------- |
| B1    | 11 x 11 | Wine cellar    | First red key and door, breakable wall, hidden hot spring |
| B2    | 13 x 13 | Ice cellar     | First blue key and attack door                            |
| B3    | 13 x 13 | Meat cellar    | First yellow key and defense door, second blue key        |
| B4    | 15 x 15 | Guard floor    | Second red and yellow keys, three-door convergence room   |
| B5    | 11 x 11 | Deep storeroom | Final red-door route, guard, princess, prison             |

The offline generator accepts a seed and arbitrary floor count, but it produces candidate content only and never enters the runtime module graph. The first floor-content slice commits a playable provisional five-floor set, an independent validator, a read-only viewer, and a development-only authoring workbench so generated JSON can be edited, revalidated, previewed, and explicitly saved without trusting or rerunning the generator. Structural validation must return a concrete solution path and prove stair connectivity, legal key and door ordering, valid entity placement, and start-to-goal solvability without making a health-budget promise.

The route-replay slice adds command-level replay and generated balance evidence against the provisional set. A final content slice then hand-reviews the five V1 layouts, locks entity placements and required-route annotations, and uses both topology and balance tooling to establish the final health budget. Runtime play always loads committed fixed JSON and never generates a floor.

The breakable wall uses the combat damage rule, has 6 health and no retaliation, and is the only hidden wall. The hot spring behind it occupies a non-passable water cell: the player stands beside it and faces it to restore health without a use limit. Bidirectional stairs also occupy non-passable interaction cells, preserving run state when the player faces one and uses it.

The baseline required route costs 90 of 120 health and reaches the end with 30 health when the hot spring is unused. This is the initial balance target, not a promise that prevents later playtest-driven tuning through authored content.

### Debug hub and viewers

The development build exposes a dedicated debug hub at `/debug`. A single catalog supplies both the hub listing and exact tool dispatch. Unknown debug paths fall back to the hub. Ordinary play never reads debug parameters or publishes a debug interface, and production builds contain no hub, catalog, scenario, or viewer code.

Debug tools obey these boundaries:

- A viewer reads the same immutable snapshots and semantic events as other consumers.
- A viewer that drives play sends commands through the canonical command boundary.
- Scenarios author starting state and inputs; they do not reimplement expected outcomes.
- Derived labels such as damage, route cost, and connectivity are computed by the real rule owner.
- The map view uses symbols or text in addition to color and remains understandable without final art.
- No placeholder 2.5D renderer is built; the debug surface stays deliberately simple and disposable only in appearance, not in its observation contracts.

| Viewer          | First available with             | Purpose                                                                                                                         |
| --------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Combat explorer | Combat model                     | Inspect damage, penetration, hit count, retaliation, and total cost for every player stage and enemy                            |
| Action viewer   | Grid and interaction rules       | Step commands on a small 2D grid and inspect before state, semantic events, and after state                                     |
| Floor viewer    | Provisional or fixed content     | Switch floors and inspect tiles, facing, entities, doors, stairs, directional wall hints, solution paths, and topology findings |
| Floor workbench | Provisional or candidate content | Generate, edit, validate, preview, and explicitly save floor-set JSON through development-only authoring boundaries             |
| Route replay    | Harness and report               | Replay an authored route and compare stage, health, keys, doors, and accumulated cost at each checkpoint                        |

### Child overview

| Child             | Focus                                                                                                                       | Current document form                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `pantry_rules_01` | Development-only debug hub, catalog, routing boundary, and production exclusion                                             | [Implementation spec](pantry_rules_01_debug_hub.implementation_spec.md)            |
| `pantry_rules_02` | Damage formula, kill-cost model, player stages, enemy and upgrade content, tests, and combat explorer                       | [Implementation spec](pantry_rules_02_combat_explorer.implementation_spec.md)      |
| `pantry_rules_03` | Grid facing, commands, retaliation, keys, doors, stairs, breakable wall, hot spring, terminal outcomes, and action viewer   | [Implementation spec](pantry_rules_03_action_viewer.implementation_spec.md)        |
| `pantry_rules_04` | N-floor offline generation, provisional layouts, topology validation, authoring workbench, floor viewer, and VS Code tasks  | [Implementation spec](pantry_rules_04_floor_pipeline.implementation_spec.md)       |
| `pantry_rules_05` | Forced-route scenarios, route replay, and generated balance-report tooling against provisional content                      | [Implementation spec](pantry_rules_05_route_replay_balance.implementation_spec.md) |
| `pantry_rules_06` | Final five-floor layout, entity placement, required-route annotations, and balance tuning                                   | Not started                                                                        |
| `pantry_rules_07` | Presentation-only environment features, wall-face anchoring, light and effect presets, and floor-content ownership refactor | Not started                                                                        |

Recommended landing order: `pantry_rules_01` -> `pantry_rules_02` -> `pantry_rules_03` -> `pantry_rules_04` -> `pantry_rules_05` -> `pantry_rules_06` -> `pantry_rules_07`.

## Non-Goals

1. Do not implement the final raycaster, presentation effects, HUD, audio, input timing, death screen, or ending sequence.
2. Do not add save/load, runtime map generation, randomness, enemy movement, AI, loot, inventory, equipment, experience, shops, or any stat source beyond the four upgrade doors.
3. Do not turn the debug hub into an editor, cheat-state owner, alternate game runtime, polished 2.5D client, or production feature.
4. Do not make the generated balance report or any viewer a second authority for rules or numbers.

## Acceptance Criteria

1. Equal initial states and command sequences produce equal final states and semantic-event sequences without browser or rendering support.
2. Every combat matrix entry, including zero-damage and impassable cases, agrees with the shared damage and retaliation rules.
3. Movement, turns, attacks, interactions, adjacency retaliation, door effects, stairs, the breakable wall, the hot spring, death, and victory follow the documented order and edge cases.
4. All five fixed floors pass connectivity, placement, key-order, door-order, and required-route health checks, while runtime play contains no map generator.
5. Development viewers expose combat, command traces, floor topology, and route replay from real snapshots and commands; ordinary and production play expose none of the debug surface.
6. The generated balance report reproduces the enemy table, cost matrix, required-route budget, floor placements, and topology findings from current authored content without hand-maintained numeric copies.
7. Presentation-only environment features remain outside gameplay entities and gain an authored floor-data contract before renderer-owned lights, emitters, or wall decorations depend on them.

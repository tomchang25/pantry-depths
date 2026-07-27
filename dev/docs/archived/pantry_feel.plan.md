# Pantry Depths Feel and Endgame

## Goal

Turn the deterministic rules and presentation capabilities into a complete keyboard-driven run from B1 to the B5 exit, with clear information, deliberate movement feel, readable feedback, death and restart, and a leaving sequence that closes the run. The runtime must make settled rules feel immediate without allowing animation timing or UI state to become gameplay authority.

## Requirements

1. Map keyboard input to discrete commands, lock input during movement and attack presentation, and retain only the latest buffered command so rapid input remains predictable rather than producing an uncontrolled queue.
2. Resolve each accepted Action when its presentation begins, because retaliation and terminal outcomes must depend on commands and state rather than frame rate or animation completion.
3. Show all raw combat and progression information needed for player calculation: health, attack, defense, three key counts, floor, the current floor's map, and the faced enemy's name, health, attack, defense, and penetration state.
4. Provide distinct feedback for normal damage, failed penetration, blocked retaliation, unseen side threats, doors, the breakable wall, the hot spring, stat upgrades, and a blocked step.
5. Complete the run lifecycle with a start/loading boundary, death summary and one-action restart, and a leaving sequence — exit interaction, loss of control, forward camera move, fade, and completion statistics.
6. Keep the complete interaction surface keyboard reachable, semantically labelled, understandable without color, responsive under zoom and narrow layouts, and stable under reduced-motion or unavailable-audio conditions.

## Design

### Runtime and input contract

| Input      | Requested behavior                                                                            | Gameplay Action |
| ---------- | --------------------------------------------------------------------------------------------- | --------------- |
| W          | Move into open floor; attack a faced enemy or breakable wall; rebound from another solid cell | Yes             |
| S          | Step backward one cell without changing facing                                                | Yes             |
| A / D      | Sidestep one cell left or right without changing facing                                       | Yes             |
| Q / E      | Turn left or right 90 degrees                                                                 | Yes             |
| F          | Interact with a faced door, stair, hot spring, or exit                                        | Yes             |
| Left click | Spend the faced cell: attack an enemy there, otherwise interact                               | Yes             |
| Mouse move | Lean the drawn view toward the pointer and let it settle back to centre                       | No              |

A blocked step in any direction is refused with feedback rather than consuming a tick. Splitting the sidestep away from the turn is what makes a one-cell lateral offset cost one input instead of a turn, a step, and a turn back, which a maze multiplies badly.

Pointer lock, free rotation, and running do not exist. The pointer lean is presentation only: `Facing` never leaves the four values Q and E produce, and the sword, every interaction, and every adjacency check read that discrete facing. Every pointer action has a keyboard binding, so the game stays completable on the keyboard alone.

A command accepted while no presentation is active resolves immediately and begins its animation from the previous snapshot to the settled result. During an active animation, only the most recent eligible input is retained; replacing or dropping a buffered command has no gameplay effect until that command is actually accepted.

| Presentation       |     Duration | Shape                                                           |
| ------------------ | -----------: | --------------------------------------------------------------- |
| Any step           | 0.22 seconds | Linear cell-center interpolation with movement-only walking bob |
| Left or right turn | 0.18 seconds | Ease-in-out quarter-turn interpolation                          |
| Attack             | 0.32 seconds | Existing sine-shaped long-sword swing                           |
| Blocked step       | 0.20 seconds | Recoil along the current facing with torch contraction          |

All four steps share one duration because they cover the same distance; a slower sidestep reads as the player wading.

Retaliation, enemy removal, health loss, death, and victory are already settled at animation start. Presentation may interpolate camera position or angle between snapshots, but no midpoint can be observed as an authoritative gameplay cell or facing.

A blocked step recoils the view backward a short distance, contracts torch light, plays a low chain sound, and displays the authored line. All player-facing text in V1 is English. The line accompanies every refusal rather than being rationed: a per-run appearance limit was tried and removed, because consecutive refusals share one on-screen message, so the limit was spent invisibly within seconds and the line then never returned. Repeated refusals must hold and extend that single message instead of replaying its entrance, so a held or mashed key never flickers or stacks popups. Reduced-motion mode replaces the recoil with a stable outline or opacity cue.

### HUD and information transparency

| Surface       | Information                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Player status | Current and maximum health with a bar, attack, defense                                                |
| Keys          | Separate red, blue, and yellow counts with shape or labels as well as color                           |
| Location      | Current floor                                                                                         |
| Floor map     | The whole current floor, the player's cell and facing, and its enemies, doors, keys, stairs, and exit |
| Faced enemy   | Name, current and maximum health with a bar, attack, defense, and explicit penetration warning        |

The map reveals the current floor outright rather than tracking exploration. That removes corner ambushes and makes a route plannable before walking it, at the deliberate cost of discovery tension; it also keeps the map a projection of world data rather than new run-owned state. Secrets stay off it: an intact breakable wall reads as ordinary stone and the hot spring behind it is never marked, because revealing a designed discovery is not what the corner-ambush problem needed.

Raw enemy values are always shown when facing a target; expected loss is not shown because calculating it is part of play.

Door failures name or visibly mark the missing key color rather than relying on a colored flash. Upgrade doors animate the changed number and pair the color flash with text and sound. Dynamic messages use status semantics only when an announcement is useful and must not repeatedly announce continuous presentation noise.

### Combat and world feedback

| Event               | Required feedback                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Player damaged      | The amount lost, shown as a number at the moment it is lost                                           |
| Normal hit          | Prepared white enemy flash, damage number, impact sound                                               |
| Cannot penetrate    | Knife rebound, sparks, high metallic sound, explicit penetration text                                 |
| Player damaged      | Camera shake, red radial flash, low impact sound                                                      |
| Retaliation blocked | Strong blue outline, short metallic deflection, no damage shake or red flash                          |
| Unseen side threat  | Directional edge slash, directional sound, and pulsing enemy marker on the explored map               |
| Breakable-wall hit  | Progressive crack, stone particles, low rubble sound, light camera shake, warm leak through the crack |
| Ordinary-wall hit   | Dull rebound and torch disturbance, with no crack, particles, or warm leak                            |
| Hot spring          | Warm lighting override, steam, restore-to-full confirmation                                           |

Every event remains distinguishable when color, audio, or large motion is unavailable. The strong block cue is especially important because it is the player's immediate proof that defense upgrades changed later costs.

### Death and restart

When health reaches zero, control stops and the death surface shows the deepest floor reached, final attack and defense, and opened-door count. Restart begins a completely new run from the original state in one keyboard-accessible action. No keys, opened doors, explored cells, defeated enemies, statistics, or hot-spring discovery carry over.

### Leaving

Interacting with the B5 exit is the only way to complete a run. No enemy defeat produces a terminal outcome; the purple slime guarding the final stretch is the hardest row of the enemy table and nothing more. That rule has already shipped as standalone work, so this plan owns only what leaving looks like.

On a completing interaction the runtime enters a leaving state:

1. Player control is disabled.
2. The passage opens and the camera moves forward through it.
3. The view fades to completion statistics.

Statistics include elapsed play time, remaining health, final attack and defense, opened-door count, and whether the hot spring was found. There is no boss fight, sixth floor, alternate ending, or new-game-plus state.

Reduced-motion mode replaces the opening passage and forward move with short, stable state changes while preserving order, text, and statistics.

### Accessibility and capability behavior

Native interactive elements own start, retry, mute, restart, and any overlay actions. Focus moves into a newly opened blocking surface, remains visible, and returns or resets predictably when the surface closes or the run restarts. Gameplay keys do not steal expected activation from a focused button.

Text, icons, shape, and layout accompany color-coded state. Core actions and information remain available at supported zoom and narrow viewport sizes. When audio is unavailable, the game remains fully playable and indicates silent mode without repeatedly prompting the player.

### Child overview

| Child            | Focus                                                                                                                                       | Current document form                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `pantry_feel_01` | Application composition, keyboard command flow, interpolation, input lock and buffering, backward rejection, and presentation-event routing | Shipped — `pantry_feel_01_runtime_and_input.implementation_spec.md` |
| `pantry_feel_02` | DOM HUD, player and enemy information, three-key display, floor label, and explored minimap integration                                     | Shipped — standalone `pantry_run_readout.implementation_spec.md`    |
| `pantry_feel_03` | Combat, side-threat, door, wall, hot-spring, upgrade, reduced-motion, and capability feedback                                               | Not started; reduced by the run readout, see below                  |
| `pantry_feel_04` | Leaving sequence, death surface, restart, and run statistics                                                                                | Not started; reduced to the leaving sequence, see below             |

Two children were partly delivered by work that ran outside this plan, because the plan's control contract had gone stale and a child under it would have inherited a false one. The standalone run readout shipped the whole of `pantry_feel_02` — with the map revealing the floor outright instead of tracking exploration — plus the parts of `_03` and `_04` a player cannot do without.

What those two children still own:

- `pantry_feel_03` keeps side-threat direction cues, breakable-wall crack stages, ordinary-wall rebound, hot-spring lighting, stat-upgrade presentation, and door-failure feedback. Damage numbers, failed penetration, and blocked retaliation have shipped.
- `pantry_feel_04` keeps the leaving sequence: control lockout, the opening passage, the forward camera move, and the fade. The death and victory surfaces, the run summary, and one-action restart have shipped.

Remaining landing order: `pantry_feel_03` -> `pantry_feel_04`.

## Non-Goals

1. Do not add save/load, checkpoint recovery, level selection, difficulty selection, a settings surface beyond mute, or progress retained after death.
2. Do not add pointer lock, free look that changes facing, running, configurable key bindings, or touch controls. Sidesteps, backward movement, and the pointer lean now exist; anything that lets the pointer set the discrete facing still does not.
3. Do not show computed expected combat loss, auto-play routes, hints for optimal progression, or a permanent tutorial system.
4. Do not add new gameplay rules, stat sources, enemy abilities, ending branches, or renderer improvements while integrating feel. What makes the exit terminal is a shipped rule this plan presents, not one it may change.
5. Do not introduce browser acceptance automation for gameplay; visual, motion, audio, and interaction feel remain explicit manual-playtest boundaries. The browser layer in `test/e2e/` covers the development console only.

## Acceptance Criteria

1. A keyboard-only player can start at B1, use every command and interaction, reach B5, leave through the exit, and reach the completion statistics.
2. Accepted commands settle gameplay exactly once at presentation start; input locking and last-command buffering never cause duplicate, reordered, or frame-rate-dependent Actions.
3. The HUD exposes all required player, key, floor, map, and faced-enemy information, including an explicit cannot-penetrate state, without relying on color alone.
4. Normal hits, health lost, failed penetration, blocked retaliation, side threats, door results, wall types, the hot spring, and upgrades are mutually distinguishable with audio off and reduced motion enabled.
5. Death displays the required run summary and restart resets every run-owned value; leaving disables control, presents the authored departure in order, and reports all required completion statistics.
6. Start, loading, retry, mute, death, restart, and completion surfaces remain keyboard reachable, visibly focused, semantically labelled, and usable at supported zoom and narrow layouts.

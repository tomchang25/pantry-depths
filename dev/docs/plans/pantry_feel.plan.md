# Pantry Depths Feel and Endgame

## Goal

Turn the deterministic rules and presentation capabilities into a complete keyboard-driven run from B1 through the princess, with clear information, deliberate movement feel, readable feedback, death and restart, and the final reversal. The runtime must make settled rules feel immediate without allowing animation timing or UI state to become gameplay authority.

## Requirements

1. Map keyboard input to discrete commands, lock input during movement and attack presentation, and retain only the latest buffered command so rapid input remains predictable rather than producing an uncontrolled queue.
2. Resolve each accepted Action when its presentation begins, because retaliation and terminal outcomes must depend on commands and state rather than frame rate or animation completion.
3. Show all raw combat and progression information needed for player calculation: health, attack, defense, three key counts, floor, explored map, and the faced enemy's health, attack, defense, and penetration state.
4. Provide distinct feedback for normal damage, failed penetration, blocked retaliation, unseen side threats, doors, the breakable wall, the hot spring, stat upgrades, and backward rejection.
5. Complete the run lifecycle with a start/loading boundary, death summary and one-action restart, princess defeat, prison reveal, ending line, fade, and completion statistics.
6. Keep the complete interaction surface keyboard reachable, semantically labelled, understandable without color, responsive under zoom and narrow layouts, and stable under reduced-motion or unavailable-audio conditions.

## Design

### Runtime and input contract

| Input | Requested behavior                                                                            | Gameplay Action |
| ----- | --------------------------------------------------------------------------------------------- | --------------- |
| W     | Move into open floor; attack a faced enemy or breakable wall; rebound from another solid cell | Yes             |
| A     | Turn left 90 degrees                                                                          | Yes             |
| D     | Turn right 90 degrees                                                                         | Yes             |
| S     | Reject backward movement and play feedback                                                    | No              |
| E     | Interact with a faced door, stair, or hot spring                                              | Yes             |

Mouse look, pointer lock, mouse attack, strafing, free rotation, and running do not exist. A command accepted while no presentation is active resolves immediately and begins its animation from the previous snapshot to the settled result. During an active animation, only the most recent eligible input is retained; replacing or dropping a buffered command has no gameplay effect until that command is actually accepted.

| Presentation       |     Duration | Shape                                                           |
| ------------------ | -----------: | --------------------------------------------------------------- |
| Forward movement   | 0.22 seconds | Linear cell-center interpolation with movement-only walking bob |
| Left or right turn | 0.18 seconds | Ease-in-out quarter-turn interpolation                          |
| Attack             | 0.32 seconds | Existing sine-shaped knife swing                                |

Retaliation, enemy removal, health loss, death, and victory are already settled at animation start. Presentation may interpolate camera position or angle between snapshots, but no midpoint can be observed as an authoritative gameplay cell or facing.

Backward rejection nudges the view backward by about 6 pixels, contracts torch light, plays a low chain sound, and displays the authored localized rejection line. The text appears at most three times per run; motion and sound continue afterward. Reduced-motion mode replaces the nudge with a stable outline or opacity cue.

### HUD and information transparency

| Surface         | Information                                                                         |
| --------------- | ----------------------------------------------------------------------------------- |
| Player status   | Current and maximum health, attack, defense                                         |
| Keys            | Separate red, blue, and yellow counts with shape or labels as well as color         |
| Location        | Current floor                                                                       |
| Exploration map | Discovered cells, player facing, doors, stairs, and previously seen enemies         |
| Faced enemy     | Name, current and maximum health, attack, defense, and explicit penetration warning |

The explored map reveals cells within roughly 2.5 cells of the player and retains discovered information for the run. Raw enemy values are always shown when facing a target; expected loss is not shown because calculating it is part of play.

Door failures name or visibly mark the missing key color rather than relying on a colored flash. Upgrade doors animate the changed number and pair the color flash with text and sound. Dynamic messages use status semantics only when an announcement is useful and must not repeatedly announce continuous presentation noise.

### Combat and world feedback

| Event               | Required feedback                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
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

### Princess and ending

The princess uses the normal deterministic combat rules. On defeat, her standing image changes to the dedicated fallen image and the runtime enters an ending state:

1. Player control is disabled.
2. The prison door opens slowly while the camera holds the authored composition.
3. The imprisoned demon walks into view.
4. The authored rescue-reveal line appears.
5. The view fades to completion statistics.

Statistics include elapsed play time, remaining health, final attack and defense, opened-door count, and whether the hot spring was found. There is no further fight, sixth floor, alternate ending, or new-game-plus state.

Reduced-motion mode replaces the slow door and walk with short, stable state changes while preserving order, text, and statistics.

### Accessibility and capability behavior

Native interactive elements own start, retry, mute, restart, and any overlay actions. Focus moves into a newly opened blocking surface, remains visible, and returns or resets predictably when the surface closes or the run restarts. Gameplay keys do not steal expected activation from a focused button.

Text, icons, shape, and layout accompany color-coded state. Core actions and information remain available at supported zoom and narrow viewport sizes. When audio is unavailable, the game remains fully playable and indicates silent mode without repeatedly prompting the player.

### Child overview

| Child            | Focus                                                                                                                                       | Current document form                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `pantry_feel_01` | Application composition, keyboard command flow, interpolation, input lock and buffering, backward rejection, and presentation-event routing | Not started; depends on grid rules and faithful presentation port |
| `pantry_feel_02` | DOM HUD, player and enemy information, three-key display, floor label, and explored minimap integration                                     | Not started                                                       |
| `pantry_feel_03` | Combat, side-threat, door, wall, hot-spring, upgrade, reduced-motion, and capability feedback                                               | Not started; depends on fixed-image presentation and HUD          |
| `pantry_feel_04` | Princess presentation, prison reveal, ending, death surface, restart, and run statistics                                                    | Not started                                                       |

Recommended landing order: `pantry_feel_01` -> `pantry_feel_02` -> `pantry_feel_03` -> `pantry_feel_04`.

## Non-Goals

1. Do not add save/load, checkpoint recovery, level selection, difficulty selection, a settings surface beyond mute, or progress retained after death.
2. Do not add mouse controls, pointer lock, free look, strafing, backward movement, running, configurable key bindings, or touch controls.
3. Do not show computed expected combat loss, auto-play routes, hints for optimal progression, or a permanent tutorial system.
4. Do not add new gameplay rules, stat sources, enemy abilities, ending branches, or renderer improvements while integrating feel.
5. Do not introduce browser acceptance automation for V1; visual, motion, audio, and interaction feel remain explicit manual-playtest boundaries.

## Acceptance Criteria

1. A keyboard-only player can start at B1, use every command and interaction, reach B5, defeat the princess, and reach the completion statistics.
2. Accepted commands settle gameplay exactly once at presentation start; input locking and last-command buffering never cause duplicate, reordered, or frame-rate-dependent Actions.
3. The HUD exposes all required player, key, floor, exploration, and faced-enemy information, including an explicit cannot-penetrate state, without relying on color alone.
4. Normal hits, failed penetration, blocked retaliation, side threats, door results, wall types, the hot spring, and upgrades are mutually distinguishable with audio off and reduced motion enabled.
5. Death displays the required run summary and restart resets every run-owned value; victory disables control, presents the authored reversal in order, and reports all required completion statistics.
6. Start, loading, retry, mute, death, restart, and completion surfaces remain keyboard reachable, visibly focused, semantically labelled, and usable at supported zoom and narrow layouts.

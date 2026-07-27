# Runtime, Keyboard Command Flow, and Presentation Pacing

Parent Plan: `pantry_feel.plan.md`

## Goal

Make the shipped rules and the shipped renderer into a playable keyboard run: discrete W/A/S/D/E commands resolve through one seam, settle exactly once at presentation start, and drive interpolated camera motion, held-forward repeat, and backward-rejection feedback. This is the first caller of the renderer's semantic-event path, which no code drives today.

## Summary

`GameSession` already owns the canonical command boundary and `GamePresentation` already owns the frame clock, but nothing connects them: `game-surface.ts` builds the presentation and never calls `present()`. This child builds the missing runtime and wires both ends.

What lands:

- **One command seam.** A new turn runner in `src/runtime/` translates a key into a `GameCommand`, dispatches it through `GameSession`, and hands the settled snapshot, its semantic events, and a presentation intent to the presentation layer. Gameplay settles when the animation _begins_; the animation only renders an already-decided result.
- **A real input lock with one buffer slot.** While an animation plays, no command resolves. A command arriving during it replaces whatever sits in the single buffer slot — never appends to a queue — and resolves when that animation completes. Pressing five keys during one 0.22 s step therefore produces two Actions, not five: the intermediate presses are discarded with no side effect. That discarding is the deliberate price of having no queue, and it is what keeps rapid input predictable. Every animation always plays its full authored duration; nothing is ever truncated, skipped, or rate-scaled.
- **Camera interpolation.** Forward movement tweens the camera linearly between cell centres over 0.22 s; turns tween the angle over 0.18 s along the quarter-turn the command names; attacks reuse the existing 0.32 s swing with no camera motion. The interpolated pose rides the `camera` parameter `createRenderScene` already accepts, so no gameplay state and no scene rebuild is involved.
- **Held-forward repeat that stops at a target.** Holding W steps at a fixed cadence while each step actually moves. The moment a step attacks, is blocked, or is rejected, the repeat stops and the player must press again. A held key can never grind a run down through repeated retaliation. A/D/E/S are single-fire per keydown.
- **Backward rejection.** S resolves through the same seam, is refused by core with `backwardNotAllowed`, and plays a short backward recoil of the presentation camera, a torch-light contraction, a low chain tone, and the authored English line `The dungeon does not allow you to retreat.` in a transient message strip. The line accompanies every refusal; repeated refusals hold the one message on screen and extend it rather than replaying its entrance, so leaning on the key never produces a flickering or stacking popup.
- **Two distinct bobs.** The existing always-on idle bob is kept at its current amplitude; a separate, stronger walking bob is added and appears only while forward movement is interpolating.
- **Reduced motion and silent audio.** Reduced motion collapses the tweens to an immediate settle, disables the walking bob, and replaces the backward recoil with a static screen-edge cue; the torch contraction, sound, text, and ordering are unchanged. An unavailable `AudioContext` already degrades to `silent` and stays fully playable.

The result is a run that can be played from B1 with the keyboard alone. The HUD, combat and world VFX, death, restart, and the leaving sequence stay with `pantry_feel_02` through `_04`.

## Relational Context

- `src/core/` is not modified. `resolveCommand` already returns `{accepted, snapshot, events}` with typed rejection reasons; the runtime consumes that contract and adds no rule.
- The turn runner is the single authority for input lock state, the one buffer slot, and held-repeat state. `GameSession` remains the single authority for the run snapshot. Presentation owns only the frame clock and interpolation phase and must never be read as gameplay truth.
- Boundary direction is fixed by `.dependency-cruiser.cjs`: `src/runtime/` may import `src/presentation/`, but `src/presentation/` may not import `src/runtime/`. The presentation-intent type is therefore owned by `src/presentation/` and imported by the runtime, never the reverse.
- The turn runner must not touch `window`, `document`, or `performance`; DOM listeners and the frame source are injected by `src/app/game-surface.ts`. This is what keeps the lock, buffer, and repeat rules observable in the Node unit environment, where DOM-dependent code is untestable.
- Held-forward repeat decides continuation from the **settled result**, not from a prediction: it continues only while the accepted forward emitted `playerMoved`. It must not re-derive "what is ahead" from world data, which would duplicate `inspectForwardTarget` outside `src/core/`.
- Feel numbers — the three durations, the repeat cadence, the recoil magnitude and duration, the torch-contraction amount, and the rejection line — are authored values and live in `src/content/`. `src/presentation/` and `src/runtime/` must not carry them as literals.
- The rejection recoil is a world-space pull-back of the presentation camera along its own facing, expressed in cells. It must not be a screen-space offset of the drawn frame: translating the finished frame slides every surface together, which reads as the walls bobbing rather than the view flinching.
- Per-frame camera interpolation must reuse the scene built at `present()` time and substitute only its `camera` field. Rebuilding via `createRenderScene` every frame reprojects all terrain, sprites, lights, and emitters and is the wrong shape.
- Backward rejection produces no `SemanticEvent`, so its audio cannot ride `ProceduralAudio.play(events)`. It needs a narrow non-event cue entry point; `pantry_feel_03` will extend that surface rather than re-open it.
- The transient message strip in `src/app/` is not the HUD. `src/ui/` stays empty in this child; `pantry_feel_02` owns the HUD and may re-home the strip.
- Floor transitions (`playerTransitioned`) relocate the camera to another floor and must snap, never tween.
- Presentation reports that an animation finished; the turn runner owns the lock and drains the buffer on that report. Presentation must never hold the lock or decide what resolves next, or animation timing becomes gameplay authority — the exact failure this child exists to prevent.
- Because a command only ever resolves while nothing is animating, no tween is ever replaced mid-flight. There is no carry-over, no fast-forward, and no speed multiplier anywhere in this design.

## Scope

### Included

- Runtime turn runner: key-to-command mapping, single command seam, input lock, one-slot buffer, held-forward repeat.
- Camera interpolation for forward and turn, driven by an intent produced at settle time, with a completion report back to the runtime.
- Backward-rejection feedback: camera recoil, torch contraction, chain cue, authored line, reduced-motion substitute.
- Movement-only walking bob alongside the retained idle bob.
- Authored feel values and the rejection line in `src/content/`.
- Keyboard, message-strip, and frame wiring in `src/app/game-surface.ts`.
- Focused unit coverage for the keymap and the turn runner.

### Excluded

- The HUD, minimap, key counts, floor label, and faced-enemy panel (`pantry_feel_02`).
- Combat, door, wall, hot-spring, upgrade, and side-threat feedback, including the ordinary-wall rebound VFX (`pantry_feel_03`).
- Death surface, restart, leaving sequence, and completion statistics (`pantry_feel_04`).
- Any change to `src/core/`, to gameplay rules or numbers, or to what makes the exit terminal.
- Mouse input, pointer lock, strafing, backward movement, configurable bindings, and touch.
- Browser acceptance coverage for gameplay; input feel stays a manual playtest boundary.

## Files to Change

| File                                           | Change Size | Purpose                                                                                |
| ---------------------------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `src/content/presentation/action-timings.ts`   | Small       | Authored durations, repeat cadence, recoil, torch contraction, rejection line          |
| `src/runtime/keymap.ts`                        | Small       | Key normalization and key-to-`GameCommand` mapping                                     |
| `src/runtime/turn-runner.ts`                   | Medium      | Command seam, lock, one-slot buffer, held-forward repeat, intent emission              |
| `src/presentation/game-presentation.ts`        | Medium      | Intent-driven camera interpolation, completion report, rejection and walk effect state |
| `src/presentation/canvas-gameplay-renderer.ts` | Small       | Torch contraction, walking bob, reduced-motion rejection cue                           |
| `src/presentation/procedural-audio.ts`         | Small       | Non-event cue entry point and the chain rejection tone                                 |
| `src/app/game-surface.ts`                      | Medium      | Keyboard listeners, message strip, runtime-to-presentation wiring, listener teardown   |
| `src/app/game-surface.css`                     | Small       | Message strip layout and fade                                                          |
| `test/unit/runtime/keymap.test.ts`             | Small       | Key normalization and mapping, including unmapped keys                                 |
| `test/unit/runtime/turn-runner.test.ts`        | Medium      | Settle-once, buffer replacement, repeat stop conditions, rejection reporting           |

## Execution Outline

1. Add the authored feel values and the rejection line to `src/content/presentation/action-timings.ts`, so every later beat reads them instead of inventing literals.
2. Add `src/runtime/keymap.ts` with its unit test. It is pure and has no dependency on the rest of the change.
3. Extend `src/presentation/game-presentation.ts` with the presentation-intent type, per-frame camera interpolation over the retained scene, a completion report, and the walk and rejection effect values. Export the intent type here because the boundary forbids the reverse direction.
4. Add `src/runtime/turn-runner.ts` against injected session, presentation-port, and frame-source dependencies, then write its unit test before wiring any DOM. The lock, buffer, repeat, and rejection-reporting rules are all provable at this point.
5. Extend `src/presentation/canvas-gameplay-renderer.ts` for torch contraction, the walking bob, and the reduced-motion rejection cue, and `src/presentation/procedural-audio.ts` for the chain cue.
6. Wire `src/app/game-surface.ts`: keydown and keyup listeners, blur and visibility release, the message strip, and disposal of every listener the surface adds. Style the strip in `src/app/game-surface.css`.
7. Run `npm run verify`, then a manual playtest per `dev/agent_rules/test_operations.md`.

## Implementation Notes

**Turn runner.** A buffered command resolves through the same seam the moment the presentation reports completion, so ordering never depends on the caller. A rejected command still consumes the buffer slot — S is buffered like any other key. Only commands with a presentation duration take the lock: interact settles immediately and never blocks the next command. Held repeat tracks one key at a time and cancels on keyup, blur, and visibility change; its cadence matches the forward duration, so a held key never contends with the lock.

**Turn interpolation.** Track the camera angle unwrapped and accumulate the command's quarter turn (`turnLeft` is −90°, `turnRight` is +90°) instead of interpolating between two `FACING_ANGLES` values. `west` is `π` and `north` is `−π/2`, so a naive interpolation spins 270° the wrong way. The renderer takes the angle through `Math.cos`/`Math.sin`, so an unbounded value is safe.

**Camera recoil.** Apply the backward recoil to the presentation camera pose only, never to the snapshot, and keep the magnitude small enough that the camera stays inside its own cell — the cell behind the player is frequently solid, and a camera inside a wall breaks the raycast. Do not implement it by translating the drawn frame instead; that moves every surface in lockstep and reads as bobbing walls, not as a recoiling view.

**Rejection message.** The DOM strip is one reused element, so a refusal while the line is already visible must extend its lifetime rather than restart its entrance animation, which would flicker under a held or mashed key.

**Renderer.** The torch term is computed per row in `#drawProjectedPlanes` and per column in `#drawWalls`; the contraction multiplies both so the two stay consistent. Keep the existing idle bob amplitude untouched and add the walking bob as a separate term.

**Reduced motion.** Read it per frame from the existing media query rather than caching it at construction, matching how the renderer already behaves.

## Edge Cases

| Case                                                 | Expected Handling                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Several commands pressed during one animation        | Only the last survives the single slot; it resolves when the animation completes        |
| Held W meets an enemy or a breakable wall            | The step resolves as one attack, then repeat stops until the key is released            |
| Held W meets a solid cell                            | The command is rejected, repeat stops, no Action and no retaliation                     |
| Held key while the window loses focus or is hidden   | Repeat cancels and no command fires until the key is pressed again                      |
| S pressed while the rejection line is still visible  | Recoil, torch contraction, and sound replay; the message holds without flicker or stack |
| Turn crossing the west/north angle boundary          | Quarter-turn sweep in the direction the command names                                   |
| Interact that changes floor                          | Camera snaps to the new floor pose with no tween                                        |
| Any command after the run reaches a terminal outcome | Core rejects it as `terminal`; no Action, no animation, no feedback                     |
| Reduced motion enabled mid-run                       | The next frame settles immediately; no animation is left stranded, no lock is stuck     |
| Reduced motion makes commands resolve faster         | Accepted: enemies never move and nothing is timed, so a higher action rate wins nothing |
| `AudioContext` unavailable                           | Capability stays `silent`; every visual cue and the text still play                     |

## Acceptance Criteria

1. A keyboard-only player can move, turn, attack, and interact through a run, and every accepted command changes the run exactly once regardless of how fast keys are pressed.
2. Rapid input never queues more than one pending command, never reorders results, and never produces an Action that the player did not press.
3. A command pressed during an animation takes effect when that animation finishes; when several are pressed, only the last one takes effect and the rest are discarded without any other consequence. Every animation always plays its authored duration.
4. Holding the forward key advances continuously down open floor and stops on its own at an enemy, a breakable wall, or a solid cell.
5. Refused backward movement recoils the view backward, contracts the torch light, plays its sound, and shows the authored line every time, without the message flickering or stacking when the key is pressed repeatedly.
6. With reduced motion enabled the same commands, ordering, sounds, and text occur, with tweens and the recoil replaced by stable state changes.
7. With audio unavailable the run remains fully playable and every cue remains distinguishable without sound.

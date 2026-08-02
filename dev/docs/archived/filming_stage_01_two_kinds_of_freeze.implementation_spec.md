# Two Kinds Of Freeze

Parent Plan: `filming_stage.plan.md`

## Goal

Split the demo's single enemy-pause switch into two: one that stops what a body decided, and one that stops time. The single switch skips the pass that also decays every per-body timer, so a body held still keeps its hit flash lit, its strike pose held, and its stun and cooldown frozen — which makes the switch useless for the one thing it is reached for most, looking at a body while hitting it.

## Summary

**Why.** Striking a held body today leaves it lit white permanently. The white is the hit flash, a 0.28-second timer that decays inside the enemy pass; the pause skips that pass wholesale, so the timer never runs. The same skip strands the stun countdown, the strike-pose hold, the attack cooldown, and the repath timer. Anyone who pauses to look at a body and then hits it sees a frozen white statue rather than a body being hit.

**What changes.** One boolean on the world becomes two, with two keys and two rows on the instrument panel:

| Switch       | Key | Stops                                                                                                      | Keeps running                                                                  |
| ------------ | --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Mind freeze  | `P` | Deciding, moving, turning, committed wind-ups, committed charges, reinforcement arrivals, emplacement fire | Per-body timers, knockback, unsticking, deaths, projectiles already in the air |
| World freeze | `O` | Everything the current switch stops today, unchanged                                                       | Nothing inside the enemy pass                                                  |

`P` keeps the key and the label it has, because "enemy pause" is what mind freeze actually is and what the chip has always claimed. World freeze is the behaviour that exists today, unchanged, moved to its own key and its own name.

**How.** The enemy pass gains an early return: under mind freeze it still clears the moving flag, decays the timers, applies knockback, and settles the body out of geometry, then returns before anything the body chose. Under world freeze the whole pass is skipped exactly as now. The instrument panel, the workbench that previews it, and the screenshot harness's frozen scene follow the field rename.

**Result.** Hit a body under `P` and it flashes, is shoved, flinches, and the flash fades — while it neither moves, turns, nor strikes back, and nothing new arrives. Press `O` and the picture stops dead, hit flash included, which is stopped time rather than a defect.

## Relational Context

- `DemoWorld` is the single owner of both switches; the simulation and the enemy module read them and never write them. The surface writes them from key handling and the instrument panel reads a projection.
- The enemy pass currently owns two unrelated jobs: decaying per-body timers and running per-body decisions. Splitting the pass is the whole change; do not move the timer decay out into the simulation's top level, because it must stay per-body and stay ordered before the decisions that read those timers.
- Deaths, projectiles, hazards, drowning, room business, and the player already run outside the pause guard and must keep doing so under both switches — a death that stopped playing under mind freeze would defeat the purpose.
- The instrument-panel model is a read-only projection: the workbench that previews the panel drives it from its own checkboxes and owns no world, so a field added to the model must be added to that workbench's literal or the build fails.
- The screenshot harness drives the demo through the same keys a person uses. Its frozen-crowd scene wants a still frame, so it wants world freeze; leaving it on `P` would silently change what that scene photographs.
- Wrong shape to avoid: one switch with a mode, or mind freeze implemented as world freeze plus a catch-up pass. Two independent booleans, both legal at once.

## Scope

### Included

- Two switch fields on the world, two keys, two panel rows.
- The early return in the enemy pass, and the reinforcement and emplacement guards.
- The panel model, the workbench literal that previews it, and the harness scene.

### Excluded

- Any change to what world freeze does. Its behaviour is preserved exactly.
- God mode, which stays a session property carried across restarts.
- Any change to which timers exist or how long they run.

## Files to Change

| File                                    | Change Size | Purpose                                                            |
| --------------------------------------- | ----------- | ------------------------------------------------------------------ |
| `src/demo/world.ts`                     | Small       | The two switch fields and their initial values                     |
| `src/demo/enemy-ai.ts`                  | Small       | The early return that divides the pass                             |
| `src/demo/simulation.ts`                | Small       | Which guard skips the enemy pass, reinforcements, and emplacements |
| `src/demo/demo-dev-overlay.ts`          | Small       | A second row and a second model field                              |
| `src/demo/demo-surface.ts`              | Small       | The second key and the panel projection                            |
| `src/app/debug/hud-attack-workbench.ts` | Small       | The previewed panel model and its checkbox row                     |
| `dev/tools/capture/scenes.mjs`          | Small       | The frozen-crowd scene presses the world-freeze key                |

## Execution Outline

1. Rename the world's switch field to name mind freeze and add the world-freeze field beside it, initialised the same way. Both are plain booleans on the world.
2. In the enemy pass, take the mind-freeze switch and return after the timer decay, the knockback, and the settle — before the charge, wind-up, and decision branches. Read the switch once per pass rather than per body.
3. In the simulation, move the enemy pass out from under the world-freeze guard and leave the reinforcement clock and the emplacement pass under it; gate the reinforcement clock on mind freeze as well, so a stage does not fill itself.
4. Add the second row to the instrument panel and the second field to its model, keeping one chip shape per row.
5. Add the second key beside the existing one on the surface, each announcing its own state, and extend the panel projection.
6. Add the field and the checkbox row to the workbench that previews the panel, then run typecheck to confirm nothing else consumes the model.
7. Point the harness's frozen-crowd scene at the world-freeze key and correct its note to say which freeze it wants.
8. Run the aggregate gate, then play: pause with `P`, hit a body, watch the flash fade; press `O` and confirm the picture stops dead.

## Implementation Notes

- The enemy pass's head is load-bearing in order: clearing the moving flag, decaying timers, applying knockback, the drowning early-out, and the settle all run before the split. The mind-freeze return goes after the settle and before the charge branch.
- Reinforcement arrival is a clock plus a spawn inside the simulation's guarded block; splitting it means the clock stops under either switch. A stage that kept ticking would place bodies the author did not.
- The emplacement pass stops under both, for the reason the existing comment gives: a pause held to look at something is worthless if a shell lands during it.
- Both switches announce on toggle through the existing message channel, and each announcement names its own key so a person who pressed the wrong one can tell.

## Edge Cases

| Case                                       | Expected Handling                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Both switches on                           | Legal. World freeze subsumes mind freeze; turning world freeze off leaves bodies still held. |
| A body mid-charge when mind freeze goes on | The charge holds where it is and resumes on release. It is an action the body chose.         |
| A body killed while mind freeze is on      | Dies and plays its death through, exactly as unfrozen.                                       |
| A body drowning while mind freeze is on    | Keeps drowning; drowning already runs outside the enemy pass.                                |
| Restarting the run                         | Both switches return to off, unlike god mode, which is deliberately carried.                 |

## Acceptance Criteria

1. Striking a body under mind freeze flashes it, shoves it, and the flash fades on its own, while the body neither moves, turns, nor strikes back.
2. Nothing new arrives and no emplacement fires while mind freeze is on.
3. Under world freeze the picture holds still exactly as it does today, and a body struck immediately before it was thrown stays lit.
4. Both switches can be on at once, and releasing world freeze leaves the bodies held.
5. The instrument panel shows one row per switch, each naming its own key and state.
6. The screenshot harness's frozen-crowd scene still produces a still frame.
7. The aggregate verification gate passes and no test file is added.

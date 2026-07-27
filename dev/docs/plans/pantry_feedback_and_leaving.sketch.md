# World Feedback and Leaving

Parent Plan: none (standalone sketch)

## Goal

Finish the two things a run still cannot show the player: what just happened to the world around them, and that they got out. This carries the residue of `pantry_feel_03` and `pantry_feel_04` after the run readout shipped the information layer, and it exists as one artifact because what remains of each is too small to be a plan child and too coupled to separate.

## Summary

The run is playable and legible. Health, keys, the faced enemy, damage numbers, the floor map, death, and restart all landed with the run readout. What is missing is the world's own voice: hitting a breakable wall looks the same as hitting stone, opening a door on a colour you lack fails silently, a stat upgrade changes a number with no ceremony, an enemy beside you that you never turned to face announces nothing, and the hot spring restores health without the room ever feeling different. Then, at the end, interacting with the exit jumps straight to a summary panel — the player wins by seeing a dialog, not by leaving.

Most of the renderer capability this needs already shipped and has never executed. The presentation port implemented hurt and attack poses, the white hit flash, the two-piece death, and impact audio, and its closeout recorded them as built but unexercised. The run readout then delivered the first two of the eight feedback events. So the bulk of this work is authoring and wiring against paths that exist, not building new rendering.

The leaving sequence is the one genuinely new mechanism: a presentation state in which the player has no control while the camera moves on its own. Nothing in the runtime currently models that, because every camera motion so far belongs to a command the player issued.

This is a standalone sketch because its parent plan closed. `pantry_feel.plan.md` shipped its other two children and was archived rather than left open around a remainder; its requirements for this slice are carried below.

## Requirements

1. Normal damage, failed penetration, blocked retaliation, an unseen side threat, a breakable wall, an ordinary wall, a door refused for a missing key, a stat upgrade, and the hot spring are mutually distinguishable, because a player who cannot tell which of those happened cannot learn the rule behind it.
2. Every one of those remains distinguishable with colour unavailable, with audio unavailable, and with reduced motion enabled. The blocked-retaliation cue matters most: it is the player's immediate proof that a defence upgrade changed later costs.
3. A threat the player never faced still announces itself, because adjacency costs health regardless of facing and the readout only describes the cell ahead.
4. Interacting with the exit plays an authored departure — control ends, the way opens, the view travels through it, and the run resolves into its statistics — because leaving is the only way to win and it currently reads as a dialog appearing.
5. Reduced motion preserves the departure's order, text, and statistics while replacing the travel with stable state changes.
6. Nothing here becomes gameplay authority. The exit rule, the damage formula, and the terminal outcome are already settled and this work only presents them.

## Sketch

### What already exists and should not be rebuilt

- Enemy hurt and attack sprite states, the white silhouette flash, the two-piece death animation, and impact audio all shipped with the presentation port and have executed since the runtime landed. Verify their current trigger points before adding anything parallel to them.
- `entityDamaged` and `entityRetaliated` already carry zero-damage cases, and the readout consumes both. The remaining events — door refusal, upgrade application, hot-spring restore, wall damage — should be checked for existing semantic events before any new event type is proposed; the run state already emits a rich set.
- The blocked-step cue — recoil, torch contraction, chain sound, message — is shipped and generalised to all four directions. The ordinary-wall rebound in requirement 1 may already be satisfied by it; verify rather than duplicating.
- The readout's damage feedback is transient and event-driven, and its overlay already owns a timer for that. A second transient channel probably belongs in the same place rather than in a new one.

### The side-threat problem

The readout describes the faced cell only, and the map marks every enemy on the floor, so a player who plans from the map is already warned. What remains uncovered is the player who is not looking at the map when something adjacent but unfaced strikes. A directional cue at the screen edge is the obvious shape; the map marker the original plan also called for is largely redundant now that every enemy is drawn from the start.

Worth resolving early: whether this cue fires on every retaliation from an unfaced cell, or only the first time a given enemy strikes. Firing every time may be noise once the map already showed the enemy.

### The leaving sequence

This needs a presentation state that outlives a single command: control disabled, camera moving on its own, then resolution. Candidate seams to inspect are the existing intent set that the turn runner sends to presentation, and the terminal-outcome path that currently makes the readout show its summary immediately. The summary surface exists and should be reused as the destination rather than replaced.

The risk is ownership drift: a departure animation is the first thing in the project whose duration is not bounded by a settled command, so it must not become a place where gameplay state waits on a frame clock. The run is already over when it starts.

### Candidate files to inspect

- The presentation intent set and the turn runner's command seam, for where a control-less state would attach.
- The readout's overlay and terminal surface, for the transient-feedback channel and the summary destination.
- The run state's semantic events, for which of the remaining feedback events already have a signal.
- The renderer's sprite state and VFX paths, for what the presentation port already built.

## Non-Goals

1. Do not change the exit rule, the damage formula, adjacency, or any terminal outcome. This work presents settled rules.
2. Do not add fog, exploration tracking, or any change to what the map reveals.
3. Do not add a sixth floor, a boss, an alternate ending, or post-run progression.
4. Do not rebuild the enemy sprite states, hit flash, death animation, or impact audio; they shipped with the presentation port.
5. Do not introduce browser automation for gameplay feel. It stays a manual-playtest boundary.
6. Do not treat this sketch's codebase claims as decided; the spec author verifies them.

## Acceptance Criteria

1. Normal damage, failed penetration, blocked retaliation, a side threat, a refused door, a breakable wall, an ordinary wall, a stat upgrade, and the hot spring are mutually distinguishable in play.
2. Each of those stays distinguishable with colour unavailable, with audio unavailable, and with reduced motion enabled.
3. An enemy that strikes from a cell the player is not facing is announced with its direction.
4. Interacting with the exit disables control, presents the authored departure in order, and resolves into the run statistics.
5. With reduced motion enabled the departure keeps its order, text, and statistics without the travel.
6. A keyboard-only player reaches the statistics and can restart from them.

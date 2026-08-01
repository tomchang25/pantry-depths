# Keyboard Volume And Mute

Parent Plan: `synthesised_sfx.plan.md`

## Goal

Give the player control of how loud the game is, and let that choice survive a reload. Without it the demo is take-it-or-leave-it, which is the one thing that cannot ship to anybody else.

## Summary

A demo-half change: shape and hazards below, the rest read just in time.

**Why keys and not a slider.** The pause is deliberately taken without giving up the pointer, so there is no cursor on screen while paused and a slider could not be dragged; and the overlay is a single button whose click relocks the pointer, so a control nested inside it would be invalid markup with its clicks swallowed. Every other player-facing toggle in the demo is already a key for the same reason. So: `M` mutes, `[` and `]` step the level by a tenth, and the new state is announced on the message line — a volume nobody can see and nobody can hear would read as a key that does nothing.

**Where the setting lives.** In the audio facade, not the mixer, which is deliberately settings-blind and only ever has levels pushed at it. Muting is expressed as a master level of zero rather than as a second concept the mixer has to know about. Two storage keys carry it across reloads, both reads and writes wrapped so a browser with storage disabled degrades to a session-only setting instead of throwing on startup.

**One behavioural decision worth naming.** Stepping the volume while muted unmutes. Reaching for the volume is a statement about wanting to hear something, and a step that silently moved a level nobody could hear would read as broken.

## Relational Context

- The mixer owns no settings and never reads storage; the facade owns the player's setting and pushes it. Nothing else may push a master level and expect it to stick.
- The setting is applied at module load, before any unlock, so a muted player never hears the first sound of the session.
- The key handler dispatches on the lowercased key and each branch prevents default and returns, matching the existing chain. The three new keys are free: the chain already takes escape, tab, r, t, k, n, b, l, p, and g, and the movement table takes wasd and the arrows.
- Announcing goes through the message line, which itself raises an interface cue — so the mute key makes exactly one sound as it turns sound back on, which is the confirmation.

## Scope

### Included

- Mute toggle, volume step, and the current setting, owned by the audio facade.
- Persistence across reloads, degrading to session-only where storage is unavailable.
- Three key bindings and their on-screen report.

### Excluded

- Any overlay control, slider, or settings screen.
- Separate effect and music levels for the player — one master is the whole surface.

## Files to Change

| File                            | Change Size | Purpose                                            |
| ------------------------------- | ----------- | -------------------------------------------------- |
| `src/presentation/audio/sfx.ts` | Medium      | The setting, its persistence, and the two mutators |
| `src/demo/demo-surface.ts`      | Small       | The three keys and their announcement              |

## Execution Outline

1. Add the setting, its storage, and the two mutators to the facade, applying it at load.
2. Bind the keys and report the result.
3. Run the gate.

## Implementation Notes

- Round the stepped level so repeated steps cannot accumulate floating-point drift into a value that never quite reaches one or zero.
- Clamp on read as well as on write: a hand-edited storage value must not be able to push a level out of range.

## Edge Cases

| Case                               | Expected Handling                                   |
| ---------------------------------- | --------------------------------------------------- |
| Storage unavailable or refused     | Setting works for the session and is not persisted  |
| A stored value that is not a level | Falls back to full volume                           |
| Volume stepped while muted         | Unmutes and applies the new level                   |
| Keys pressed before unlock         | Setting is recorded and applies when the audio arms |

## Acceptance Criteria

1. Mute silences the game immediately and unmutes it again, from inside locked play.
2. The volume steps up and down in tenths and is reported on screen each time.
3. Both survive a reload.
4. A browser with storage unavailable still plays and still responds to the keys.
5. The verification gate passes and no test covers the demo half.

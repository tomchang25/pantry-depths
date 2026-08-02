# The Stage

Parent Plan: `filming_stage.plan.md`

Status: Draft implementation spec

## Goal

Ship the stage itself: a small room that exists to be filmed in, and the dressing that makes arriving on it repeatable — the same arrival facing the same way, nothing standing in it that was not placed, no way to descend by accident, bodies held still, a screen clear of development furniture, and a way to stand the cast back up as whichever body is being filmed, without moving the person filming.

## Summary

**Why.** The three children before this one make it possible to place a known body on a known cell and hold it still. What they do not do is make the room itself filmable. An ordinary floor drops the arrival on a random cell, puts the plinth on that same cell whenever no room on the floor holds one, hides the way down somewhere in the room, and descends the moment a person standing near it has met the floor's task — which on a stage is a body count, so filming a fight trips it.

**What ships.** Two content files as a starting point: a stage room seven cells square, open throughout, holding no crowd and no scatter, and a stage map of the same extent with that room in the main slot. Both libraries discover their directories, so nothing registers them. From then on the room is edited like any other, its extent included — nothing here depends on it staying that size.

**The dressing**, applied when a stage is entered and again on every restart:

| What                                              | Instead of                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| The arrival is one fixed cell, facing the room    | A cell drawn at random from the room's floor                              |
| The way down and the plinth sit outside the walls | The plinth on the arrival cell and the stairway loose in a five-cell room |
| Mind freeze is on                                 | Bodies walking the moment the floor loads                                 |

Moving the way down outside the walls is what makes the descent unreachable, which matters more than it looks: the floor's main task is a body count, and a person filming kills bodies.

**Resetting a take, in two parts.** One key returns the cast to where it was painted without moving the player, because standing still and wanting the bodies alive again is the commonest thing a person filming does and restarting cannot say it. Two more step a held selection backwards and forwards through the body kinds, and the instrument panel shows what is held — so filming every kind of body dying in turn is: choose, re-place, kill, choose the next.

The selection has eight states, not seven: **as authored** plus the seven kinds. As authored is where it starts and means each body keeps the kind its room declares, so a mixed cast is the default and overriding it is a deliberate act with a way back. Choosing a kind means every body placed is that kind, standing on the cells the room declares. The selection is session-only and never touches the room file.

One further key clears the readouts and the instrument panel from the screen.

**Why the dressing is not content.** A room describes a dungeon. Where the arrival is, whether the bodies are held, and whether the panel is on screen are statements about a session. The dressing is therefore keyed to the stage by name in the demo half; if a second stage is ever wanted the name becomes a list, and if the dressing is ever wanted on an ordinary map it becomes an address the game is opened at. Neither is built now.

**Result.** Open the game at the stage, and the same shot loads every time: standing in the same place, facing the same way, with the painted cast held still in front of you and no furniture on screen.

## Relational Context

- The assembled floor record is read-only, so the dressing rebuilds it rather than mutating it, and it runs after assembly — both floor refusals have already passed by then, so moving the way out afterwards refuses nothing.
- The world is built in two places on the surface: once at mount and once on restart. The dressing must be called from both, or restarting a stage produces an undressed floor.
- Restart deliberately carries god mode across, as a session property. Mind freeze is not carried: it belongs to the staged scene, so restarting a stage puts it back on whether or not the bodies had been released.
- The re-place key shares the placement operation the floor population child added, and clears standing bodies by emptying the list rather than through the ordinary death path — a reset is not a death and must leave no corpse, drop, or stain. This is the opposite of the existing kill-everything key, whose whole point is that it does go through that path.
- The selection is session state held beside the world, not on it: it survives a restart the way god mode does, because it describes what the person filming is currently shooting rather than what the floor is. Placement reads it; nothing else does, and nothing writes back to content.
- The instrument panel is a read-only projection of a model the surface builds. Showing the selection means one more field on that model, and the workbench that previews the panel drives that model from its own controls, so a field added there must be added to the workbench's literal too — the same coupling the freeze child already pays.
- The instrument layer is two mounted elements appended to the surface. Hiding is a flag on the surface with a rule per element, not an unmount, so the state survives and nothing is rebuilt.
- Keys are the real control on the play surface because the pointer is locked for all of play; the panel's buttons cannot be reached while it is. Every key added here is announced through the existing message channel.
- Wrong shapes to avoid: a field on the room or map contract for any part of the dressing; the dressing applied inside floor assembly, which serves every map; the selection written back into the room file; the selection applied to bodies already standing.

## Scope

### Included

- The stage room and stage map content files.
- The dressing module and its two call sites.
- Four keys: step the selection back, step it forward, re-place the cast, hide the instrument layer.
- The selection itself, its eight states, and the panel row that shows it.
- The panel rows and messages those keys need.

### Excluded

- Any recording, camera path, or cinematic system.
- Any second stage, or the dressing on any other map.
- Any change to the room or map contract.
- Any change to what the cast declaration means, which the contract child owns.

## Files to Change

| File                                    | Change Size | Purpose                                                                   |
| --------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| `src/content/rooms/stage.room.json`     | Small       | The stage room, as a starting point to be edited                          |
| `src/content/maps/stage.map.json`       | Small       | The map that holds it                                                     |
| `src/demo/stage.ts`                     | Medium      | The stage's name, the dressing, the selection, and the re-place operation |
| `src/demo/demo-surface.ts`              | Small       | Both call sites, the four keys, and the hidden-instrument flag            |
| `src/demo/demo-dev-overlay.ts`          | Small       | The row that shows the held selection                                     |
| `src/app/debug/hud-attack-workbench.ts` | Small       | The previewed panel model gains the same field                            |
| `src/demo/world.ts`                     | Small       | The cast placement extracted so the dressing can call it again            |
| `src/demo/demo.css`                     | Small       | The rule that hides the readouts and the panel                            |

## Execution Outline

1. Write the two content files and confirm the game opens at the stage map before anything else changes — a file whose name and declared name disagree is refused by its library, and that is the cheapest failure to find first.
2. Add the dressing module holding the stage's name as a named constant with the reason it is named rather than inferred, following the existing precedent for the default map's name.
3. In it, rebuild the assembled floor record with a fixed arrival, and with the way down and the plinth on a boundary cell; set the player's position and facing, and the world's plinth to match; turn mind freeze on.
4. Call the dressing from both places the surface builds a world, and confirm restarting reproduces the shot exactly.
5. Extract the cast placement so it can be run again against a live world, then add the re-place operation on top of it, clearing standing bodies by emptying the list.
6. Add the selection and its two stepping keys, show it on the instrument panel, and add the same field to the workbench that previews the panel.
7. Add the re-place key and the hide key, each announcing what it did, and the flag plus rule that hides the readouts and the panel together.
8. Run the aggregate gate, then film a take: paint a cast, walk in, kill it, re-place it, step to another kind, re-place it again, hide the furniture.

## Implementation Notes

- The arrival cell and facing are the stage's, not the room's: choose them so the room is in front of the player, and derive them from the assembled room's bounds rather than from the shipped extent, so editing the room's size does not strand the arrival outside it.
- A boundary cell is outside every room's interior and is never walkable, which is what makes both the descent check and the plinth unreachable. Confirm by looking that neither draws through the wall; if either does, move it to the furthest corner instead and say so.
- The selection steps through the content vocabulary's own order with "as authored" ahead of the first kind, wrapping in both directions, so the order a person steps through is the order the vocabulary declares.
- The panel row names the selection in the same words a person would use for it — the body's own name for a kind, and something that reads as an absence of override for "as authored" — because a row showing an internal identifier is a row that has to be translated every time it is read.
- Stepping the selection does not move anything already standing. The selection decides what the next placement produces, so it is read at placement rather than applied on change; a selection that reshaped the live bodies would make the key destructive and unable to be pressed while looking for the right kind.
- Clearing bodies for a reset also clears anything holding a reference to one — a carried body and a body being skewered are the two — or the reset leaves a body in hand that no longer exists.
- Hiding the instrument layer is one flag read by a rule per element rather than per-element state, so the two cannot drift apart.

## Edge Cases

| Case                                              | Expected Handling                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| The stage room edited to a different extent       | The dressing derives the arrival from the assembled room, so it follows the new extent.                  |
| The stage room given a crowd                      | Legal. The crowd fills as it would anywhere; nothing about the dressing depends on the room being empty. |
| Re-placing while holding a body                   | The held body is dropped and cleared with the rest before the cast is placed again.                      |
| Stepping the selection with bodies standing       | Nothing on the floor changes. The selection decides the next placement, not the current one.             |
| Re-placing on a room that declares no cast        | Nothing is placed, and the floor is left empty rather than filled with a default.                        |
| Re-placing on a map that is not the stage         | The key does nothing, because the operation places a room's declared cast and the dressing owns the key. |
| The hide key pressed while the pause screen is up | The pause screen is part of the readouts and hides with them; the world is still paused.                 |
| Opening any other map                             | The dressing does not run and nothing about that map changes.                                            |

## Acceptance Criteria

1. Opening the game at the stage puts the arrival at the same cell facing the same way every time, with the painted cast standing where it was painted and nothing else in the room.
2. Bodies are held still on arrival, and releasing them is one key.
3. No plinth and no stairway is visible in the room, and killing enough bodies to meet the floor's task does not descend.
4. Restarting reproduces the staged state, including bodies held still, whether or not they had been released.
5. One key returns the cast to where it was painted without moving the player, leaving no corpse, drop, or stain.
6. Two keys step a selection backwards and forwards through "as authored" and the seven body kinds, wrapping in both directions, and the instrument panel names what is held.
7. Re-placing while a kind is selected stands every body of that kind on the cells the room declares; re-placing on "as authored" stands each body as its room declares it. The room file is unchanged either way.
8. One key clears the readouts and the instrument panel from the screen, and returns them.
9. Editing the stage room's extent moves the arrival with it rather than stranding it.
10. Every other map behaves exactly as before.
11. The aggregate verification gate passes and no test file is added.

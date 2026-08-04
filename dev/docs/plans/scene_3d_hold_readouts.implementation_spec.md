# Putting The Hold Readouts Where They Can Be Seen

Parent Plan: none (standalone spec)

## Goal

Give the blessing claim and the extraction hold a readout a player can actually see while standing on the pad. Both rooms tell the player nothing today: one has a readout painted underneath the fixture that covers it, and the other has one carried by a light this renderer's ground cannot brighten.

## Summary

**What is wrong, and it is not what it first looked like.** Both side-room holds were reported as having lost the shipped game's filling readout. The first explanation — that the room lights grow but this renderer takes the strongest single light and clamps it at one, so the player's own torch swallows the growth underfoot — is true and is recorded in `three_scene_graduation_06_the_fidelity_tail.implementation_spec.md`. It is not the whole story. The extraction room still has its filling square, ported faithfully and drawn every frame, and nobody can see it either: the runtime's extraction fixture builds a solid pad box across the whole three-cell pad, and the square is painted on the floor beneath it. The shipped game's extraction fixture was a canister standing on bare stone, which is exactly why it painted its ground.

So both readouts are missing for the same reason in the end. The runtime rebuilt these fixtures as raised pads — correctly, as shapes — and in doing so it covered the ground the readouts are drawn on, and the lighting model that used to carry the rest cannot.

**Why this is a repair and not a new feature.** Nothing here invents a cue. The extraction's filling square is already authored, already the right colour, already fed by the right number; it is moved up eight centimetres so it lands on top of the pad instead of under it. The blessing gets the same treatment for the first time because the shipped game never needed to give it one — its dais brightened through an accumulation buffer this runtime does not have. Both end up with the readout the shipped game gave them, by the only means this renderer offers.

**What changes.**

| Room       | Today                                                      | After                                                                        |
| ---------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Blessing   | Light grows; nothing on the dais; torch swallows the light | A patch on the dais top filling from the middle as the five-second hold runs |
| Extraction | Filling square painted on the floor under the pad box      | The same square, same colours, on top of the pad where it is visible         |
| Extraction | Green plumes vent at a fixed rate                          | Plumes vent harder as the share runs, at the shipped game's own numbers      |

**How it lands.** The readouts move to the module that owns the fixtures covering them, as two flat quads kept outside the cached geometry rebuild and resized every frame. The floor-decal pass loses the extraction block it can no longer be seen through. The effects pass reads the share for its plume density. Four beats, one gate run, then a playtest — this is a change whose entire subject is whether a person standing on a pad can tell it is working.

**What it looks like landed.** You step onto the blessing dais and a pale patch grows out from under your feet to the edge of it over five seconds. You step onto the extraction pad and a green one does the same while the plumes thicken around you. Neither room is a place you have to read the HUD to understand any more.

## Requirements

1. Each of the two holds shows its progress on the fixture the player is standing on, filling from the middle outward, because the pad is where the player is looking and the HUD bar is not.
2. The extraction readout keeps the colours, opacities and growth it already has. It is being un-hidden, not redesigned, and a colour change here would be a second decision riding on a repair.
3. The blessing readout is built from the extraction's own idiom rather than a new one, so the two rooms teach the same thing about what a filling patch means.
4. Neither readout may force the cached structure geometry to rebuild. Structure rebuilds cost every fitting on the floor and the holds move every frame; that is the reason the shipped game put the readout in the lighting rather than the geometry, and the constraint outlives the mechanism.
5. Nothing about the room lights changes. They stay as they were ported, correct and largely swallowed, and they are not retuned to compensate — a light pushed past the clamp to make a point would blow out everything else the room lights.

## Relational Context

- `world-structures.ts` owns both fixtures and is therefore the only module that knows a readout is covered. It caches its geometry against a signature and rebuilds wholesale on a change; the readout quads must live outside that rebuild and be updated every frame regardless of whether the signature moved. Its rebuild clears the group it owns, so a persistent child of that group has to be re-added after every clear or it silently disappears the first time a wall comes down.
- Only the floor plane's material samples the decal buffer. Boxes do not, and giving them the ability to would put every blood stain and every blast warning on top of every fitting on the floor. That is why the readout is geometry rather than a decal, and it is the wrong shape to reach for instead.
- `floor-decals.ts` stops emitting the extraction pad entirely rather than keeping it as a base layer. Two owners for one readout is how the visible and invisible halves drift apart, and the buffer holds thirty-two marks with anything past that dropped — a mark nobody can see is a mark taken from something a player is running away from.
- Materials come from `SceneLighting`. The readout needs an unlit, self-coloured one, since a lit material would be clamped by exactly the mechanism that hid the light growth. That factory belongs beside the others rather than as the one material in the scene built inline.
- `world-effects.ts` already builds the extraction plumes and already runs every frame; it reads the share directly, the same way the light does.

## Scope

### Included

- A per-frame hold readout on the blessing dais and on the extraction pad.
- Removal of the extraction floor decal the fixture covers.
- Extraction plume density following the share.
- One unlit material factory for the readouts.

### Excluded

- Any change to the room lights, including retuning them.
- Any change to the fixtures' own geometry or colours.
- The hot spring, which has no hold in either renderer.
- A readout for the altar, the stairs or anything else that is not a timed hold.
- Making box materials decal-aware.
- Any new test of any kind.

## Files to Change

| File                                            | Change Size | Purpose                                                        |
| ----------------------------------------------- | ----------- | -------------------------------------------------------------- |
| `src/presentation/scene-3d/world-structures.ts` | Medium      | Owns both readout quads and resizes them every frame           |
| `src/presentation/scene-3d/scene-lighting.ts`   | Small       | One unlit, self-coloured material for a mark laid on a fixture |
| `src/presentation/scene-3d/floor-decals.ts`     | Small       | Drop the extraction pad paint the fixture covers               |
| `src/presentation/scene-3d/world-effects.ts`    | Small       | Plume density follows the extraction share                     |

## Execution Outline

1. Add the unlit mark material to `SceneLighting`, taking a colour and an opacity, writing no depth so two stacked quads do not fight.
2. In `world-structures.ts`, create a readout group held outside the cached rebuild, re-added whenever the rebuild clears the root, holding one base quad and one fill quad per hold room. Do this before wiring the values, so the ordering hazard is closed while the quads are still invisible.
3. Drive them from the frame: the blessing pair from the held fraction, pinned full once the blessing is taken; the extraction pair from the share. Both fills scale from the middle. A room a floor does not have hides its pair rather than building nothing, so a floor change cannot leave a stale quad lit.
4. Remove the extraction block from `floor-decals.ts` in the same change the readout replaces it, and raise the plume density in `world-effects.ts` to the shipped numbers.
5. `npm run verify`, then a playtest of both rooms: stand on each pad, watch it fill, step off before it completes, and step back on.

## Implementation Notes

**Heights.** The blessing dais tops out at 0.07 with a raised inlay reaching 0.1 across its middle; the extraction pad tops out at 0.08. The readouts sit just clear of the highest surface they cover — above the inlay on the blessing side, above the pad on the extraction side — so a single quad per room covers the whole pad without intersecting the fixture under it. The blessing quad therefore floats a few centimetres over the dais's outer ring, which is invisible from standing height because nothing casts a shadow onto it.

**Values.** The extraction keeps exactly what its decal used: the dim colour at half strength for the base and the hot one at nine-tenths for the fill, both spanning the pad's own half-width and the fill scaled by the share. The blessing takes the same shape in the colour its own light already throws. The plumes take the shipped game's numbers: the centre plume runs from twenty to forty-two across the hold and each of the four corner plumes from ten to twenty-two.

**Ordering.** The quads are updated before the signature check that skips the geometry rebuild, not after it, or they stop moving the moment a floor settles — which is most of the time a player is on a pad.

## Edge Cases

| Case                                      | Expected Handling                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| Floor has no blessing or extraction room  | That room's quads are hidden, not built and left lit somewhere           |
| Blessing already taken                    | Fill stays at full width rather than collapsing when the hold resets     |
| Player steps off a pad mid-hold           | Fill falls back with the hold on the next frame, because the hold resets |
| Hold at zero                              | Base showing, fill at nothing — the pad reads as present but not running |
| A wall comes down while standing on a pad | Geometry rebuilds; the readouts survive it and keep their current size   |
| Player standing on the fill               | Their own body occludes part of it, as it does the extraction's today    |

## Acceptance Criteria

1. Standing on the blessing dais shows a patch growing from the middle to the edge of the pad over the five seconds of the claim, and it stays full once the blessing is taken.
2. Standing on the extraction pad shows the same growth in the extraction's own green, and stepping off drops it back.
3. The extraction's green plumes visibly thicken as the hold runs.
4. Neither readout is visible from a room that has no such fixture, and neither survives a floor change as a stale mark.
5. Breaking a wall while a hold is running does not interrupt, reset or hide the readout.
6. Nothing else about either room's lighting, geometry or colour has changed.
7. The aggregate verification gate passes and a playtest of both rooms confirms the above.

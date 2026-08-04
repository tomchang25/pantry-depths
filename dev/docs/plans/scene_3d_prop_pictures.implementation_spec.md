# Giving The Crossbow And The Javelin Their Own Pictures Back

Parent Plan: none (standalone spec)

## Goal

Draw the crossbow and the javelin as themselves wherever this renderer draws a picture of them — in the hand and on the floor — instead of the hammer and the stick they currently borrow. The pictures already exist; the renderer that used them was deleted and its sprite catalogue was ported without them.

## Summary

**What is wrong.** The 3D renderer keeps its own canvas sprite catalogue, and that catalogue was ported with four carryable pictures in it: a stick, a rock, a bomb and a hammer, plus four authored PNGs for the skeleton's own drops. Nothing was ported for the crossbow or the javelin. Both prop tables therefore point those kinds at the nearest picture that exists — the crossbow at the hammer, the javelin at the stick — so a player holding a crossbow is holding what reads as an axe, and a javelin on the floor is a stick.

**Why it matters more than a wrong picture.** The loaded and the spent crossbow are the same prop kind chain, and the shipped renderer told them apart by their pictures: one has a bolt in the groove and a taut string, the other an empty groove and a string hanging slack. Both currently draw the same hammer. That difference is the weapon's entire ammunition readout at the moment a player is looking down the aim rather than at the HUD. The straight and cracked javelin have the same problem for the same reason — the prop contract expresses wear by handing back a different kind, and the picture is what makes that visible.

**What is already correct, and must stay correct.** In the air, the javelin, the cracked javelin and the bolt already fly as properly coloured bone rods, and the spent crossbow already tumbles as one. Flight is not broken and this change does not touch it. The wrong picture appears in exactly two places: the pickup standing on the floor, and the object held in the viewmodel's hand. The loaded crossbow is the one kind that also flies as a picture, so it is the one kind whose flight appearance changes as a side effect of being given its own sprite.

| Kind                     | Held today | On the floor today | In flight today       | After                                |
| ------------------------ | ---------- | ------------------ | --------------------- | ------------------------------------ |
| `crossbow`               | Hammer     | Hammer             | Hammer, tumbling      | Its own loaded picture, all three    |
| `crossbowSpent`          | Hammer     | Hammer             | Pale rod, tumbling    | Its own spent picture; rod unchanged |
| `skeletonJavelin`        | Stick      | Stick              | Bone rod, point first | Its own picture; rod unchanged       |
| `skeletonJavelinCracked` | Stick      | Stick              | Bone rod, point first | Its own bent picture; rod unchanged  |
| `crossbowBolt`           | Never held | Never dropped      | Bone rod, point first | Its own picture; rod unchanged       |

**How it lands.** The drawings are recovered from git — they were deleted with the interim renderer, not lost — and copied into the 3D sprite catalogue, which uses the same canvas size and the same surface helper, so they compile unchanged. The sprite id vocabulary gains five ids, and the two tables that map a prop kind to a picture are repointed. No sizing work: the per-kind floor and hand scales were authored against these exact pictures and are already in the content layer.

**What it looks like landed.** You pick up a crossbow and you are holding a crossbow, with a bolt lying in it. You shoot it and what is left in your hand has a slack string and an empty groove, and you can see that without reading a number. A javelin on the floor is a barbed bone shaft, and the one that has a throw left in it has a visible kink at the middle.

## Requirements

1. Every prop kind that can be held or can lie on the floor is drawn as the object it is. A picture that names a different weapon is worse than no picture, because it is read and believed.
2. The loaded and the spent crossbow are distinguishable at a glance, without the HUD. That difference is the weapon's ammunition readout, and the moment it matters is the moment the player is looking at the world rather than at a count.
3. The straight and the cracked javelin are distinguishable the same way, because the prop contract already expresses wear as a different kind and the picture is the only place that becomes visible.
4. The pictures are the ones the shipped renderer drew, recovered rather than redesigned. This is a port that was left incomplete; a new drawing here would be a second decision riding on a repair.
5. Nothing about how anything flies changes. The rod tables are correct and are not this change's subject.

## Relational Context

- `scene-sprites.ts` is the sole owner of drawn pictures for this renderer. `SceneSpriteId` is its id vocabulary and `SceneSprites` is a total record over it, so an id added to the union must be built in `createSceneSprites` or the module does not compile.
- Two separate tables map a prop kind to a picture, and both are total records over `PropKind`: `PROP_SPRITES` in `world-effects.ts` covers pickups on the floor and objects flying as pictures, and `CARRIED_SPRITES` in `viewmodel.ts` covers the object in the hand. They are not derived from each other and must be edited together; the current bug is present identically in both.
- Flight in `world-effects.ts` resolves in a fixed precedence: `FLYING_RODS`, then `TUMBLING_RODS`, then `PROP_SPRITES`. The javelin, the cracked javelin and the bolt are in the first table and the spent crossbow is in the second, so those four never reach the sprite path in the air. Only the loaded crossbow does. Neither rod table is touched by this change.
- The viewmodel draws the held prop by compositing it into a 2D canvas, so the hand needs a canvas picture and cannot be served by a mesh. The javelin and crossbow meshes that exist in the skeleton armature belong to the enemy's hand and are not a substitute here.
- `prop-display.json` already carries `floorScale`, `handScale` and `handRotation` for all five kinds, authored against these pictures when they last existed. Sizes and rotations are correct once the pictures are right and must not be retuned as part of this change.
- The source drawings are not in the working tree. They are recoverable from git at `3e579c4^:src/demo/demo-sprites.ts` — `skeletonJavelin(bent)`, `crossbow(spent)` and `crossbowBolt()`. That file's `SPRITE_SIZE` and `surface()` are identical in meaning to the ones in `scene-sprites.ts`, so the function bodies copy across without adaptation.
- `createSceneSprites()` is called independently by the viewmodel, the body pass and the effects pass; each builds its own full set. Five new pictures therefore cost five canvases three times over. This is existing behaviour of the module and is not changed here.
- `PropForm` in `prop-contract.ts` declares `billboard | tumbling | rod` and nothing reads it; the presentation encodes the same distinction across its three tables. Unifying them is a separate question and must not be started here.

## Scope

### Included

- Five recovered canvas pictures in the 3D sprite catalogue: loaded crossbow, spent crossbow, javelin, cracked javelin, bolt.
- Five new sprite ids, built in the sprite factory.
- Both prop-kind picture tables repointed at them.

### Excluded

- Any change to `FLYING_RODS`, `TUMBLING_RODS` or how anything flies.
- Any change to the per-kind floor or hand display values.
- Any new drawing, recolour or restyle of a recovered picture.
- Reading `PropForm` from the content layer, or merging the three presentation tables.
- Replacing any billboard with a mesh.
- Any new test of any kind.

## Files to Change

| File                                         | Change Size | Purpose                                                              |
| -------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| `src/presentation/scene-3d/scene-sprites.ts` | Medium      | Holds the five recovered drawings, their ids, and their construction |
| `src/presentation/scene-3d/world-effects.ts` | Small       | Floor pickups and flying pictures point at the new ids               |
| `src/presentation/scene-3d/viewmodel.ts`     | Small       | The object in the hand points at the new ids                         |

## Execution Outline

1. Recover the three drawing functions from `3e579c4^:src/demo/demo-sprites.ts` and paste them into `scene-sprites.ts` beside the other carryable pictures, keeping their doc comments — the crossbow's comment is the record of why the loaded and spent pictures differ.
2. Extend `SceneSpriteId` with the five ids and build them in `createSceneSprites`, taking the two-argument drawings twice each. Do this before touching the tables, so the compiler catches a missing id rather than a table pointing at nothing.
3. Repoint `PROP_SPRITES` in `world-effects.ts` and `CARRIED_SPRITES` in `viewmodel.ts` in the same change. Leave every `authored` entry alone.
4. `npm run verify`, then a playtest: pick up each of the four weapons, look at what is in the hand, shoot the crossbow dry and look again, throw a javelin and look at what comes back, and look at all of them lying on the floor.

## Implementation Notes

**Naming.** The sprite ids follow the catalogue's convention of naming the object rather than the prop kind: `javelin`, `javelinCracked`, `crossbow`, `crossbowSpent`, `crossbowBolt`. The prop-kind side keeps its `skeletonJavelin` naming; the tables are where the two vocabularies meet, and they already do this for the stick and the hammer.

**The bolt.** A bolt is never picked up and never dropped, and it flies as a rod, so its picture is unreachable today. It is ported anyway because both tables are total records over every prop kind, and the alternative is two entries that name a different object and have to be recognised as deliberate lies by every later reader. If that trade is rejected on review, the entry points at the javelin instead and the drawing is not ported — but it is not left pointing at the stick.

**The spent crossbow needs its picture even though it flies as a rod.** It is a throwable object that sits in the hand and lies on the floor, which is where its slack string is read. The rod covers only the second or so it is in the air.

**Do not touch the authored entries.** The four skeleton drops resolve through a separate PNG path keyed on the same prop kind. That branch is unrelated and a kind that is `authored` in one table and a sprite id in the other would silently fall through to a missing texture.

## Edge Cases

| Case                                        | Expected Handling                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| Crossbow shot dry while held                | The held picture becomes the spent one on the same frame the kind changes |
| Javelin thrown and the cracked one returned | The cracked picture is what comes back, on the floor and in the hand      |
| Loaded crossbow thrown rather than shot     | It flies as its own picture, tumbling, since it is in neither rod table   |
| A stack of javelins on the floor            | Drawn fanned, as every stacked pickup already is, from the new picture    |
| Bolt somehow reaching the floor             | Drawn as a bolt rather than as a stick                                    |

## Acceptance Criteria

1. A crossbow in the hand reads as a crossbow, and a javelin on the floor reads as a barbed shaft rather than as a stick.
2. Firing the last bolt visibly changes what is in the hand: the string goes slack and the groove empties, with no HUD reading required.
3. A javelin that has one throw left in it is visibly kinked, both in the hand and where it lies.
4. Every weapon that flew as a rod before still flies as the same rod, at the same colours and the same pitch.
5. The size and tilt of every carried and dropped object are unchanged from before the change, apart from being a different picture.
6. The aggregate verification gate passes, and a playtest confirms the above.

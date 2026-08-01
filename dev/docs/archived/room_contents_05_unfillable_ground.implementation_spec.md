# The Trench: Ground That Cannot Be Filled

Parent Plan: `room_contents.plan.md`

## Goal

Add one new kind of ground: a trench a body cannot cross, cannot break through, and cannot close with anything. An author places it in a room's cells and nothing else ever does.

## Summary

Water is the only ground that stops a walk, and it has a way out — three bodies close one cell and it is floor again. An authored room has no way to say a gap is permanent.

The trench is water minus the ways out. It is walked around, seen across, thrown across and immune to a swing, exactly as water is. It differs in three places, and all three are the point: no blood ever settles on it, a body that lands in it dies at once and the trench is unchanged, and nothing anywhere may open it — not the stranding repair, not the walks the floor clears to its rooms, not a weapon.

**None of this can lean on the compiler**, which is the finding that shapes the work. The maze module's header claims a tile kind added to the content list without a branch in the demo fails to compile; it does not. The tile factory ends in a fallthrough and every consumer is an if-chain naming water explicitly, so a new kind compiles cleanly and inherits a wrong default at each one. Left alone the trench would be visible as plain flagstone, block line of sight, hold blood, and — loudest — break under one swing, because the wall-damage handler's early return names water and not it. Every site is therefore visited by hand. The tracker's `One Tile, One Record` draft records that this enumeration is the disease and the data-driven record is the deferred cure.

A body landing in one dies with cause `slain`, which the death-sprite chooser already maps to the collapse animation — so no asset is authored and no new death cause is introduced. That chooser is the one chain in this area that _is_ exhaustive, and it stays untouched.

## Relational Context

- The kill goes through the ordinary kill path, so the run's counters, the bone scatter and anything watching a death behave as they do for any other. A trench death must not be special-cased anywhere downstream.
- The stranding guarantee from child 03 treats water as isolating and repairs it by opening the water in the way. The trench is isolating and **must not be reachable by that repair**: both of its searches have to refuse to cross it, or the walk-back would step through a cell it cannot open and leave the ground stranded anyway.
- A region sealed behind trench is caught when the room file is saved, because the authored-cell enclosure check runs there. That check currently names water; it must name both. This is what keeps the runtime repair from ever facing a seal it cannot open.
- The walks the floor clears to each room open every hazard on the route. The trench must not be a hazard by that definition, or the guarantee would erase authored ground. It is not floor either, so those searches simply cannot cross it — which is correct, and is why an authored room must leave a way to its own doorway.
- The doorway line is forced open through whatever a room authored, the trench included. An author running a trench across the cell their doorway needs will find it opened; that is the assembly keeping its promise, not a defect.
- A new floor material must join the renderer's material order but must **not** join the watery-patch set, which drives sliding, wobbling and shoreline foam.
- Nothing in the pool task changes. It counts cells a pool has swallowed, and the trench swallows without counting.

## Scope

### Included

- The trench tile kind, and its treatment as impassable by both the authored-cell check and the built-floor stranded check.
- Every demo branch that names water visited, and the trench given its own answer at each.
- A body landing in one killed immediately through the ordinary path with the collapse death.
- The stranding repair refusing to cross or open it.
- A floor material and its procedural texture, in the strata form chosen from rendered candidates.
- An authored room and a map that uses it, since no generated room can produce one.

### Excluded

- Any generation of the trench, and any rule forbidding it later.
- Any change to water, its drowning, its fill count, or its repairability.
- Any new death cause, animation, particle kind or sound.
- Any data-driven tile record — the tracker's deferred draft.
- Any change to the tasks or the HUD.
- New tests.

## Files to Change

| File                                                           | Change Size | Purpose                                                        |
| -------------------------------------------------------------- | ----------- | -------------------------------------------------------------- |
| `src/content/maps/room-schema.ts`                              | Small       | The kind, and the authored-cell check naming both grounds      |
| `src/content/maps/map-schema.ts`                               | Small       | The stranded check naming both grounds                         |
| `src/demo/maze.ts`                                             | Medium      | Vision, projectiles, stains, and a repair that cannot cross it |
| `src/demo/actions.ts`                                          | Small       | A swing at it does nothing                                     |
| `src/demo/demo-scene.ts`                                       | Small       | No wall face, and its own floor material                       |
| `src/demo/impacts.ts`                                          | Small       | A body landing in one dies at once                             |
| `src/presentation/render-scene.ts`                             | Small       | The material name                                              |
| `src/presentation/canvas-gameplay-renderer.ts`                 | Small       | Its slot in the material order, and out of the watery set      |
| `src/presentation/procedural-textures.ts`                      | Medium      | The strata texture                                             |
| `src/content/rooms/*.room.json`, `src/content/maps/*.map.json` | Small       | An authored room that proves it                                |

## Execution Outline

1. Content: add the kind, and widen the authored-cell enclosure check and the built-floor stranded check to name both unfillable grounds.
2. `maze.ts`: give the trench its answers for vision, flat projectiles and stains, and make both searches in the stranding repair refuse to cross it.
3. `actions.ts` and `demo-scene.ts`: no damage, no wall face, its own floor material.
4. `impacts.ts`: a third arm beside the caltrops and the water, killing at once with a dust burst and no blood.
5. Presentation: the material, its slot, and the strata texture.
6. Author a room with a trench across it and a map naming that room.
7. Run `npm run verify`, then open the map and look at it, and shove a body in.

## Implementation Notes

- **The repair's two searches both need it.** One finds what is reachable ignoring water; the other crosses water to walk back. The trench belongs on the impassable side of both — in the first because it genuinely cuts ground off, in the second because a route through it is not a route.
- **The kill uses the existing `slain` cause.** The death-sprite chooser maps it to the collapse animation and ends in an exhaustiveness check; adding a cause there would be work for no gain.
- **Nothing counts a trench death differently.** It is a kill like any other.
- **The texture's `scale` argument is a pixel size, not a count of cells**, which is the one easy thing to get wrong when translating a candidate into the shipped helper.

## Edge Cases

| Case                                            | Expected Handling                                            |
| ----------------------------------------------- | ------------------------------------------------------------ |
| A swing at a trench                             | Nothing happens, and no message claims otherwise             |
| A body thrown across a narrow trench            | Flies over and lands beyond it                               |
| A body landing exactly in one                   | Dies at once; the trench is unchanged                        |
| An authored trench across a room's doorway line | The doorway is forced open through it, as through anything   |
| An authored room sealing ground behind trench   | Refused when the file is saved                               |
| A trench beside water                           | Each keeps its own behaviour; only the water can be repaired |

## Acceptance Criteria

1. An authored room places trench cells and they appear exactly where the cells put them; no generated floor holds one.
2. A body cannot walk into a trench, can see across it, and can throw across it; a swing changes nothing.
3. A body knocked or thrown into one dies immediately with the collapse death, and the trench is unchanged.
4. No blood mark appears on a trench.
5. No built floor holds ground cut off behind a trench, and the stranding repair never opens one.
6. The verification gate passes, and no test file is added.

# A Mortar Emplacement That Shells The Whole Floor

Parent Plan: `pantry_demo_telegraphs.plan.md`

## Goal

Add a fixed, breakable emplacement to the floor that picks a random body more than two tiles away — the player or any enemy, without preference — locks onto where it stands, paints a red circle there, and shells it five seconds later. It is the floor's own weapon rather than any creature's, and it fights everyone.

## Summary

The floor already has one static hazard, the iron barricade, and its whole contribution is that it hurts whatever gets shoved into it. The mortar is the active version: it does something on its own schedule, to whoever happens to be standing in the open, and it does not care which side they are on.

The cycle is four beats. It picks a target from every body on the floor beyond its own two-tile dead zone, locks the point that body is standing on, and paints a circle there. Five seconds later it launches an arcing shell at that point, which flies over walls and detonates in a two-tile-wide blast. Then it stands idle for three seconds and picks again.

The point is locked, not tracked, so the answer to a circle appearing under you is simply to walk. With fourteen to twenty enemies on a floor and no targeting preference, the emplacement mostly shells the enemies — which is the intended feel. It is a chaos generator that works for the player far more often than against them, and the times it does pick the player, they get five seconds and a circle drawn on the ground.

It occupies its cell as a solid block, and it can be broken down like a barricade. Standing next to it is safe by construction — the dead zone means it cannot shell anything within two tiles of itself — so closing on it and smashing it is always an available answer, and a deliberately safe one.

## Relational Context

- This replaces the shooter-lob design that this child originally carried. The shooter keeps only its direct bolt; no enemy archetype gains a lobbed attack.
- Two owners, one per concern, and they must not be merged. The maze tile owns solidity and durability: a new tile kind, blocking walk and projectiles, with health, damaged and destroyed through the same authority a barricade already uses. A world-level list owns the firing cycle: phase, timer, and locked point, one entry per live emplacement. Do not put timers on tiles, and do not put health in the list.
- When the tile is destroyed, its entry leaves the list. The tile is the authority on whether an emplacement still exists; the list follows it.
- **Adding a tile kind is silent. Nothing in the build will point at the work.** The tile-kind union carries no exhaustiveness check anywhere — every site that dispatches on it is a predicate or an if-chain with an ordinary fallthrough, so a new kind compiles cleanly and inherits whatever each fallthrough happens to give it. A green build after step one means nothing has been verified. The enumerated table below is the checklist, because the compiler will not produce one.
- Where the fallthrough is already correct, leave it alone rather than adding a branch that restates it. Four of the blocking predicates and the walkable-cell pool already treat an unknown solid kind exactly as the emplacement needs; a redundant branch there is one more place to update the next time the union grows.
- The barricade is the working template for nearly all of that: placement by the generator into open floor and spread apart, health, destruction, drawn as boxes rather than as a wall face, its own minimap colour. Follow it rather than inventing a second pattern.
- Targeting reads live positions to _choose_, then stores a position. Everything after the lock reads the stored point. An emplacement that re-aims during the five seconds would make the circle a lie, which is the failure this whole plan exists to remove.
- The shell's flight uses the same height curve the player's throws use; extract that formula so both callers share one rather than writing a second that drifts.
- Blast resolution belongs to the impacts module beside the bomb and the rock. The blast hurts the player and every enemy in radius with no distinction, which is the only place in the demo where one damage call must reach both. Settled at promotion: the player's half arrives as an injected function rather than an import, because the impacts module and enemy behaviour already point at each other and importing player damage directly closes the loop into a cycle the boundary check rejects. The blast path already takes its wall damage the same way, so this is the established shape rather than a new one.
- Settled at promotion: the debug enemy pause freezes the emplacements along with the enemies. They are terrain and could defensibly keep running, but a pause held in order to look at something is worth little if a shell lands during it.
- The shell is airborne: it ignores walls and passes over bodies, resolving only on arrival. It must not be run through the enemy-fire stepping that terminates on the first blocking cell.
- **Scene sprites carry no per-instance alpha.** The circle's ring and its growing fill are two separate baked assets; the fill expresses time through scale.
- The centre bead column reuses child 02's helper, walked upward instead of along a line.
- **Boxes are axis-aligned and cannot be rotated.** An angled barrel is therefore not buildable from them, which is why the tube points straight up — see the shape note below. Do not reach for a rotation field on the box record; there is none, and a billboard would turn to face the camera and stop being a fixed object.
- A kill the shell makes goes through the ordinary enemy-death exit, so it counts toward the run's kills, heals under the lifesteal blessing, and rolls the drop table exactly as a kill by the player's hand does. That is intended: the emplacement is a weapon the player learns to aim by positioning, and a weapon that pays nothing is one they would rather were not there.

## Scope

### Included

- A new tile kind for the emplacement, placed by the floor generator, solid and breakable.
- The world-level firing cycle: target selection beyond the dead zone, a five-second lock, launch, a three-second idle, repeat.
- The arcing shell, which ignores walls and detonates on arrival.
- The floor circle, its growing fill, and the centre bead column.
- A blast that damages and knocks back the player and every enemy inside it.
- The emplacement's appearance as standing geometry — a squat mortar tube on a carriage — and its minimap colour.

### Excluded

- Any lobbed attack for any enemy archetype. The shooter's bolt is untouched.
- Damage to walls, barricades, or other emplacements from the shell's own blast — demolition stays the charger's and the bomb's job. The player's bomb destroying an emplacement is the reverse direction and is included.
- Any drop or reward for destroying an emplacement.
- Any change to the presentation layer.

## Files to Change

| File                       | Change Size | Purpose                                                                          |
| -------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `src/demo/maze.ts`         | Medium      | The tile kind, its blocking and stain rules, and generator placement             |
| `src/demo/world.ts`        | Medium      | The emplacement record and list; the shared flight-height formula                |
| `src/demo/actions.ts`      | Small       | Destroying an emplacement through the existing wall-damage authority             |
| `src/demo/simulation.ts`   | Medium      | The firing cycle, the airborne shell, and resolution on arrival                  |
| `src/demo/impacts.ts`      | Small       | The arrival blast, hurting the player and enemies alike                          |
| `src/demo/demo-scene.ts`   | Medium      | The emplacement's geometry, its charging glow, the circle, and the centre column |
| `src/demo/demo-sprites.ts` | Small       | The ring and fill assets                                                         |
| `src/demo/demo-surface.ts` | Small       | The minimap colour for the new tile kind                                         |

## Execution Outline

1. Add the tile kind and walk the dispatch table below by hand, site by site. Land this beat with the emplacement inert — solid, breakable, visible on screen and on the minimap — before any behaviour exists, and confirm each row by playing rather than by the build passing.
2. Extract the flight-height formula so it can be shared, leaving the player's throws behaving identically.
3. Add the emplacement list, populated from the generated floor, and the four-beat cycle with no shell yet: lock a target, hold, idle, repeat. Draw the circle here, so the targeting can be judged before anything is fired.
4. Add the airborne shell and the arrival blast.
5. Add the charging glow and the geometry's own reaction to its cycle.
6. Run `npm run verify`, then play: stand in the open until a circle lands on you, walk out of it, and confirm the shell still comes down where the circle is. Then close to melee range and confirm nothing can be fired at you there.

## Implementation Notes

### The tile-kind dispatch table

Every site that branches on a tile kind, what the new kind silently inherits there, and whether that is the wanted answer. Verify each against the live code before acting on it; the state below was read at authoring time and earlier children do not touch these files.

| Site                                                                       | Silent fallthrough for the new kind         | Wanted                                                                                                                                |
| -------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| The floor-kind test and the walk, projectile, vision, and flung predicates | Solid: blocks all four                      | Correct as-is. Add nothing                                                                                                            |
| The walkable-cell pool and the test-arena flatten                          | Excluded from spawning; kept when flattened | Correct as-is                                                                                                                         |
| The height-aware projectile test                                           | Returns "does not stop", at every height    | **Wrong.** It must stop a flat throw like a wall and be cleared by a lob, which is the barricade's rule with its own clearance height |
| The wall-damage authority                                                  | Falls into the masonry branch               | **Wrong.** Needs its own branch beside the barricade's, with its own destruction and debris                                           |
| The blast's wall shatter                                                   | Skipped entirely                            | **Wrong.** A bomb should be able to destroy an emplacement                                                                            |
| The scene's terrain builder                                                | Emitted as a damage-laddered wall face      | **Wrong.** Like the barricade, it is standing geometry, not a wall face                                                               |
| The minimap colour table                                                   | Falls back to the open-floor colour         | **Wrong.** Needs its own colour                                                                                                       |
| The stain rule                                                             | Blood settles on it                         | Minor, but it is a solid block; exclude it                                                                                            |

### What it looks like

A squat mortar tube standing on a carriage, built entirely from the scene's box primitive the way the stair mouth already is.

- The tube points **straight up**, and that is a design answer rather than a compromise. Boxes cannot rotate, so an angled barrel is not buildable from them; but a mortar that shells every direction around itself has no reason to be angled, and a vertical tube is rotationally symmetric, so it looks correct from every approach and tells no lie about which way it is about to fire.
- Build the tube as a short stack of boxes, widest at the muzzle and narrowing toward the breech, so the silhouette tapers rather than reading as a post.
- Build the carriage as a low frame with a cheek piece on each side, in timber tones against the tube's iron, so the thing reads as mounted rather than as growing out of the floor.
- The muzzle glows through the five-second lock, brightening as it approaches launch, and the shell visibly leaves it upward. Take the glow from the same cycle timer the circle uses, so the emplacement and its mark can never disagree about how long is left.

### Everything else

- Starting numbers: two to three emplacements per floor, health equal to a barricade's, a two-tile dead zone, a five-second lock, a three-second idle, a blast two tiles across, 24 damage, and knockback below a bomb's. All are to be judged by playing.
- Target selection is uniform across every eligible body with no side preference. With fourteen to twenty enemies alive, that means the player is picked rarely, and the emplacement spends most of its time thinning the floor. That is the intended feel, not an accident to correct.
- The idle beat begins at launch, not at detonation. The emplacement's cycle is its own; the shell in the air belongs to nobody once it leaves.
- If no eligible body exists — everything is dead or inside the dead zone — hold in the idle beat and try again next tick rather than locking onto nothing.
- Place emplacements the way barricades are placed: into open floor, never adjacent to each other, and away from where the player arrives.
- The blast reaches the player and enemies through the same call. Do not add a side check; the whole design rests on there not being one.
- Nothing is dropped when one is destroyed. Ammunition already comes off walls and bodies, and a hazard that pays out turns "smash it" from a choice into an obligation.
- No test may be added. `src/demo/` is verified by playing it.

## Edge Cases

| Case                                                   | Expected Handling                                                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| The locked body dies or is picked up during the lock   | The shell still lands on the locked point. It was aimed at a place, not at a body                     |
| The locked point is inside a wall                      | Cannot happen from a live body's position; if reached some other way, it simply lands and hits nobody |
| The emplacement is destroyed mid-lock                  | Its entry leaves the list and no shell is fired; the circle disappears with it                        |
| The emplacement is destroyed while its shell is in air | The shell completes and detonates normally                                                            |
| Every body is inside the dead zone                     | Hold idle and retry; do not lock                                                                      |
| The player descends while a shell is in flight         | Cleared with the rest of the floor's transient state                                                  |
| A shell lands on a pool or on spikes                   | The existing hazard rules resolve whatever the knockback pushes into them                             |
| Two emplacements lock the same point                   | Two circles overlap and two shells land. Nothing needs to deduplicate                                 |
| The test-arena key flattens the floor                  | Emplacements are kept, like barricades and pools                                                      |
| A flat throw is aimed at an emplacement                | Stopped by it as a barricade stops one; a lob clears it at its own clearance height                   |
| A bomb goes off beside an emplacement                  | It takes the blast damage and can be destroyed by it                                                  |

## Acceptance Criteria

1. Two or three solid, breakable emplacements stand on every generated floor and are visible on the minimap.
2. An emplacement locks a random body beyond two tiles, paints a red circle where that body stood, and fires there five seconds later regardless of where the target went.
3. The circle is readable from inside it, at an ordinary viewing pitch, and walking out of it avoids all damage.
4. The shell visibly arcs over walls rather than passing through them.
5. Enemies caught in the blast take it exactly as the player does, and the emplacement targets them just as often.
6. Standing within two tiles of an emplacement cannot be shelled by it, so closing to melee is always safe.
7. An emplacement can be broken down by melee and by a bomb, stops firing when it is, stops flat throws while it stands, and is visible on the minimap in its own colour.
8. `npm run verify` passes.

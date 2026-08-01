# A Room States Its Composition As Shares Of Itself

Parent Plan: `room_contents.plan.md`

## Goal

Let a room say how open it is, what its walls are made of, and how much of it is water — each as a share of the room rather than a rate buried in the generator or a count of cells. The two constants that decide the first two move onto the room, and water stops being a number of pools.

## Summary

Three numbers decide what the shipped map's main region is made of, and none of them is authorable. A fixed proportion of the walls the backtracker leaves is knocked out, wherever that lands. Each wall is drawn timber or stone against a constant. Water arrives as a count of pools, so a room half the size gets the same amount.

This child turns all three into shares the room states. Measured over two thousand floors, the region's 361-cell interior comes out **59.2% open, 21.8% stone, 15.7% wood, 1.7% water** today; the bare backtracker alone leaves **55.1%** open before anything is knocked out.

**The openness changes meaning, not just ownership.** Today a proportion of the surviving walls is removed and the result lands where it lands. Instead the room names the openness it wants and walls are opened until it is reached — which makes it a floor the generator works up towards, never a ceiling it cuts down to, because the backtracker's own corridors are already the minimum and closing them would sever the room. A room asking for less than its corridors already give simply gets its corridors.

**Where walls go is still the generator's.** A share says how much masonry a room holds and can never say where it goes; drawing each cell against a percentage produces isolated blocks on open ground with no corridors, dead ends or loops. So the backtracker keeps deciding shape and the share only decides how far that shape is opened up.

The shipped region takes an openness of 0.6 — slightly tighter than the 62.3% today's perforation lands on — and water at 0.05, which is 18 of its 361 cells against today's six. Its wall mix keeps today's ratio rather than moving to even, because the openness and the water were decided explicitly and the mix was only illustrative.

**This is the first child in this plan that changes what a floor looks like**, which it is meant to do. The seeded floors the capture harness photographs will differ, and that is the result rather than a regression.

## Relational Context

- The perforation constant and the wall-material constant both live in the floor assembly; the first is read inside the carved branch of the room painter, the second inside the wall-tile factory, which takes no arguments today and will need the room's mix passed down to it.
- The wall-tile factory is also called from the assembly's authored path indirectly through the tile factory; only the carve's own walls take the mix, because an authored cell already names its own kind.
- Water is scattered, not carved. It runs after the walls exist and after the ways between rooms are opened, on cells that are open at that moment and not on a way between rooms. It cannot be drawn from the same distribution as the walls and must stay in the scatter declaration.
- A share of a room means a share of its interior, which is its extent less the wall ring on every side. The scatter functions already receive the block they are working inside, so the area is derivable there and must not be taken from the whole floor.
- The quantity reader added in the first child answers whole numbers and ranges of them. A share is a fraction, so it needs its own reader; the reader is already parameterised over what a single value must satisfy, so this is a third caller rather than a new mechanism.
- The share is a plain fraction rather than a range of fractions, because the existing roller returns whole numbers and a fractional range would need a second one. Pool sizes already vary, so a fixed wet total still produces a different number of pools of different shapes on every floor.
- Structure fields belong on the carved variant only. A room that is open floor throughout has no walls to make and nothing to perforate; stating either on one is a mistake, and refusing it is better than ignoring it.
- The stranded-ground repair from the previous child will fire more often at three times the water. It is correct at any amount, but if pools are routinely holed to keep a floor connected then the share is too high for the room and that is worth measuring rather than assuming.

## Scope

### Included

- A fractional share reader beside the whole-number quantity reader.
- An openness and a wall mix stated on a carved room, required there and refused on an open one.
- Perforation that opens walls until the stated openness is reached rather than at a fixed rate.
- Wall material drawn against the room's mix, normalised so the two numbers need not sum to one.
- Water stated as a share of the room's interior rather than a count of pools.
- The shipped main region migrated to an openness of 0.6 and water of 0.05.

### Excluded

- Any new kind of ground — child 05.
- Any change to where the backtracker puts corridors, or to how rooms attach and doorways open.
- Bodies as a density. A room has one size, so a cap written for it is already written for that size.
- Any change to caltrop, emplacement or ground-kit counts, which stay count ranges.
- Preserving today's seeded floors. This child changes them on purpose.
- New tests.

## Files to Change

| File                                      | Change Size | Purpose                                                               |
| ----------------------------------------- | ----------- | --------------------------------------------------------------------- |
| `src/content/maps/room-schema.ts`         | Medium      | The share reader, the structure fields, and water as a share          |
| `src/demo/maze.ts`                        | Medium      | Perforate towards a target, draw walls from the mix, flood to a share |
| `src/content/rooms/main-region.room.json` | Small       | The shipped region's composition                                      |

## Execution Outline

1. `room-schema.ts`: add a unit-interval reader and a share parser built on the existing parameterised quantity reader.
2. `room-schema.ts`: give the carved structure variant a required openness and wall mix, refusing both on the open variant, and refusing a mix whose two numbers are both zero.
3. `room-schema.ts`: change the pool declaration from a count to a share, keeping its size.
4. `maze.ts`: replace the fixed-rate perforation with one that opens randomly chosen walls until the room's openness is met, and does nothing when the carve is already at least that open.
5. `maze.ts`: pass the room's mix to the wall-tile factory and draw against the normalised ratio.
6. `maze.ts`: flood pools until the share of the block's interior is wet, bounded so an unreachable target cannot spin.
7. Migrate the shipped region, then run `npm run verify` and look at both maps.

## Implementation Notes

- **Openness is a floor, not a target to hit exactly.** Count the open interior cells the carve left, subtract from the target, and open that many of the remaining walls chosen at random. A negative difference means the carve is already more open than asked and nothing happens — closing a corridor would sever the room the backtracker just guaranteed was connected.
- **Normalise the wall mix rather than validating that it sums to one.** An author writing 20 and 20 means the same as 0.5 and 0.5, and refusing one of those spellings buys nothing.
- **Flooding to a share needs an attempt bound.** A room whose open cells are nearly all on a way between rooms can never reach its target, and the loop has to give up rather than spin. Count attempts, not successes.
- **The area a share is taken against is the block's interior**, not the whole floor and not the block including its ring.

## Edge Cases

| Case                                                       | Expected Handling                                              |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| A room asks to be less open than its corridors already are | It gets its corridors, unchanged                               |
| A room asks to be completely open                          | Every interior wall is opened; the carve leaves nothing behind |
| A wall mix names one material as zero                      | Every wall is the other one                                    |
| A wall mix names both as zero                              | Refused when the room file is read                             |
| Openness or a wall mix stated on an open room              | Refused when the room file is read                             |
| A water share the room cannot reach                        | As much as fits is placed, and the assembly moves on           |
| A room with other rooms hanging off it                     | Pours its full share; the guaranteed walks then reopen part    |
| A water share of zero                                      | No water, the same as omitting the declaration                 |

## Acceptance Criteria

1. A room states how open it is, and the built floor is at least that open unless its own corridors already exceed it.
2. A room states what its walls are made of, and the built floor's walls follow that ratio.
3. A room states how much of it is water, and that share of its interior is poured. A region with rooms hanging off it keeps less, because the floor's guarantee of a walk to each of them opens whatever stands on those routes — measured at roughly two cells per room attached, which is the same toll the caltrops and emplacements have always paid.
4. A room that is open floor throughout cannot state either an openness or a wall mix.
5. The shipped map still plays: it starts, its rooms are reachable, and no floor holds ground nothing can walk to.
6. The verification gate passes, and no test file is added.

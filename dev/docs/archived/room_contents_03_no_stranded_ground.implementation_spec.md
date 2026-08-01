# No Floor Holds Ground Nothing Can Walk To

Parent Plan: `room_contents.plan.md`

## Goal

Guarantee that every piece of walkable ground on a built floor can actually be walked to, with water — the one thing a player cannot reliably get through — as the only thing that counts as cutting ground off. A floor that would fail is repaired rather than refused.

## Summary

Nothing checks this today. The refusal that looks like it does asks a different question: whether the way out can be reached at all, and to answer that it treats every breakable thing as already broken, so the only thing that can fail it is the boundary — which is why it never fires. Meanwhile pools are placed with no connectivity check whatsoever. They are bounded to one room and kept off the ways between rooms, which stops one sealing a doorway, but nothing stops one closing a ring around a corner of a room's own floor.

This child adds a second question beside the first rather than changing it. Two refusals, two definitions of what stops a walk, each honest about which it means: the existing one asks "can the stairs be reached, given that masonry comes down", and the new one asks "is any ground cut off by something that does not come down".

What counts as cutting ground off is settled by what a player can do about it. Masonry, caltrops and emplacements all come down to a weapon, so ground behind them is reachable and the floor is legal. Water does not, reliably — closing one cell costs three bodies, and a floor early in a run may not have three to spend — so ground behind water is not.

**A floor that would fail is repaired, not refused.** Refusing means a run that does not start because of a roll, which is the worst way to spend a guarantee. The repair walks back from the stranded ground toward the ground that can be reached and opens the water in the way, which is the move the assembly already makes to keep the ways between rooms clear. It draws no randomness, so a seeded floor is the floor it was unless it genuinely needed repairing.

The content layer answers whether a floor is legal; the assembly is what makes it so. So the query that finds stranded ground and the refusal built on it live beside the existing refusal, and the repair lives with the assembly that caused the problem.

## Relational Context

- The existing floor refusal is untouched. Its passability treats everything but the boundary as passable, which is deliberate and correct for the question it asks; widening it would turn a check about the stairs into a check about pools and answer neither well.
- The new question's passability is the one the authored-cell check already uses: boundary and water stop a walk, everything else does not. Those two are the same rule asked at two moments — once of cells an author wrote, once of a floor a generator built — and they should stay recognisably the same.
- Only ground is asked about. A cell that holds a caltrop or an emplacement is not ground somebody stands on, and the boundary and the unpainted corners are not either. What must be reachable is open floor and floor a pool has been filled back into.
- The repair runs after the ways between rooms have already been cleared, because that pass opens hazards along those paths and so fixes some strandings for free. Running before it would repair things that were about to be repaired anyway.
- The repair only ever turns water into floor. It never removes a caltrop or an emplacement, because those never strand anything by this definition.
- It draws no random number, so the seeded sequence is untouched, and the descent is chosen from a list of cells captured before it runs — a list the repair can only add to, never invalidate.
- Both refusals run last, on the finished floor, which is where the module's whole reasoning puts them: the declarations were checked when the file was saved, and what is visible only now is a property of this particular draw.

## Scope

### Included

- A query over a built floor answering which ground nothing can walk to.
- A refusal built on it, beside the existing one and not replacing it.
- A repair in the assembly that opens the water responsible, run until nothing is stranded.
- Both refusals running on every built floor.

### Excluded

- Any change to the existing stairs-reachable refusal.
- Any new ground that cannot be filled — child 04.
- Any change to where pools are placed, how large they grow, or what a room may declare.
- Treating a caltrop, an emplacement or masonry as cutting anything off.
- New tests.

## Files to Change

| File                             | Change Size | Purpose                                                    |
| -------------------------------- | ----------- | ---------------------------------------------------------- |
| `src/content/maps/map-schema.ts` | Medium      | The query for stranded ground, and the refusal built on it |
| `src/demo/maze.ts`               | Medium      | The repair, and both refusals run on the finished floor    |

## Execution Outline

1. `map-schema.ts`: add the query — a flood from the arrival over everything but boundary and water, then every unreached cell of ground.
2. `map-schema.ts`: add the refusal, throwing when the query answers anything, naming the map and what was cut off.
3. `maze.ts`: add the repair — a search from the arrival that may cross water, then a walk back from each stranded cell opening the water until it meets ground already reachable.
4. `maze.ts`: run the repair after the ways between rooms are cleared, looping until nothing is stranded, then run both refusals.
5. Run `npm run verify`, measure the seeded fingerprint, and measure how often the repair actually fires across many floors.

## Implementation Notes

- **Repairing changes what is reachable, so it has to settle.** Opening one cell of water can expose more ground that is still stranded behind a different pool. Loop the whole find-and-repair pass until it finds nothing, with a bound so a mistake shows up as a refusal rather than a hang.
- **Stop the walk-back as soon as it meets reachable ground**, rather than opening every water cell between the stranded ground and the arrival. The difference is a pool the floor keeps.
- **The refusal after the repair is not redundant.** It is what makes the repair's correctness checkable rather than assumed, and it is the thing a later child that adds unfillable ground will trip over first if it gets that wrong.

## Edge Cases

| Case                                                | Expected Handling                                   |
| --------------------------------------------------- | --------------------------------------------------- |
| Nothing is stranded, which is the usual floor       | The query answers nothing and no cell changes       |
| A pool rings a corner of a room's floor             | The water between the corner and the rest is opened |
| Ground sits behind masonry only                     | Reachable, untouched — masonry comes down           |
| Ground sits behind a caltrop or an emplacement only | Reachable, untouched, for the same reason           |
| Opening one pool exposes ground stranded by another | The pass repeats until nothing is stranded          |
| A room with no ground at all                        | Nothing to strand, and nothing to repair            |

## Acceptance Criteria

1. No built floor holds open ground that cannot be walked to from where the run arrives, treating masonry, caltrops and emplacements as passable and water as not.
2. A floor that would have held such ground has the water responsible opened, and keeps the rest of its pools.
3. The existing refusal about reaching the stairs behaves exactly as it did.
4. The same seed produces the same floor as before, except where a floor genuinely needed repairing.
5. The verification gate passes, and no test file is added.

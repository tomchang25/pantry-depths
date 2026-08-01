# A Room Declares How Its Bodies Start And How They Arrive

Parent Plan: `room_contents.plan.md`

## Goal

Make the crowd say more than it can today. How many bodies a room starts with, how long between arrivals, and how many arrive each time all become quantities a room states — any of them a range — and a room may hold bodies without ever topping up.

## Summary

A crowd is three exact numbers, and only one of them describes arrivals. Exactly one body appears per interval, everywhere, always, so the only pressure a room can dial is how often one comes — "a wave" and "a trickle" are the same thing at two speeds rather than two different things. And every floor starts with the same count, because the starting number cannot vary.

This child reshapes the crowd around the quantity reader the previous child built. The cap stays an exact number, because a cap is a promise about the room and a random promise is not one. The starting count becomes a quantity. The two numbers that describe arrivals move into a `reinforcement` group of their own — how long between waves, and how many come in one — and that group is optional, so a room can hold bodies that are never replaced.

That optionality also cleans something up. A room with no crowd at all is currently expressed to the runtime as a cap of zero paired with an infinite interval — the exact contradiction the previous plan added the optional crowd to avoid, reintroduced one layer down because the runtime's crowd had nowhere to put "nothing arrives". With reinforcement optional, it simply has none.

Depth is untouched: how much a floor's depth adds to a room's starting count stays exactly the arithmetic it is today, because what a depth should do is the tracker's open question and this plan's first non-goal keeps it out.

Nothing the shipped map plays changes. Every migrated value is written as a bare number, which the quantity roller never draws randomness for, so the seeded floors are the same floors.

## Relational Context

- The quantity roller and the equal-ends short circuit landed in the previous child and are what make this migration free. A bare number costs no randomness, so writing today's exact values as bare numbers leaves the random sequence untouched — this is measurable and must be measured, not assumed.
- Seconds are not counts. The existing interval is validated as a finite number above zero rather than a whole number, so the quantity reader needs a second form that keeps that rule; forcing whole seconds would be a tightening nobody asked for.
- The demo layer's own crowd type is a structural copy of the content layer's. It becomes an alias instead, the way the tile and role vocabularies already are, so the two cannot drift as the shape changes.
- The interval is rolled at each arrival rather than once per floor, which is what makes a range mean "somewhere between four and six seconds" rather than "this floor's rate".
- The crowd in force is the one belonging to the room the player is standing in, and that changes as they walk. So the spawn clock has to cope with walking from a room that reinforces into one that does not, and back — it cannot be parked at infinity when the answer may change a second later.
- A wave stops early when the cap is reached: three into two free places is two. The announcement has to say how many actually arrived rather than how many were asked for, and it must read exactly as it does today when that number is one.
- Both places that top a floor up to its cap on a debug key read the cap directly and are unaffected.

## Scope

### Included

- A seconds-shaped quantity beside the whole-number one.
- A crowd of an exact cap, a quantity of a starting count, and an optional reinforcement group of interval and wave size.
- Waves of more than one body, stopping at the cap, announced by how many arrived.
- A room that holds bodies and never replaces them.
- The runtime's no-crowd case expressed as an absence rather than an infinite interval.
- The five shipped rooms migrated.

### Excluded

- Any change to depth scaling.
- Any change to where a reinforcement is allowed to appear, or how far from the player.
- Bodies as a density rather than a count — child 04.
- Any change to what an enemy is or does.
- New tests.

## Files to Change

| File                              | Change Size | Purpose                                                   |
| --------------------------------- | ----------- | --------------------------------------------------------- |
| `src/content/maps/room-schema.ts` | Medium      | The reshaped crowd and a seconds-shaped quantity          |
| `src/demo/world.ts`               | Small       | Rolling the starting count and the first interval         |
| `src/demo/simulation.ts`          | Small       | A wave rather than a single body, and what it announces   |
| `src/demo/maze.ts`                | Small       | The crowd type aliased, and no-crowd stated as an absence |
| `src/content/rooms/*.room.json`   | Small       | Five rooms migrated to the new shape                      |

## Execution Outline

1. `room-schema.ts`: generalise the quantity reader over what a single value must satisfy, add the seconds form, and reshape the crowd.
2. `maze.ts`: alias the demo's crowd to the content layer's, and restate the no-crowd constant as a cap and start of zero with no reinforcement.
3. `world.ts`: roll the starting count and the first interval, treating an absent reinforcement as a clock that has nothing to wait for.
4. `simulation.ts`: roll the wave size, spawn up to it, and announce what arrived.
5. Migrate the five room files, every value a bare number.
6. Run `npm run verify`, measure the seeded fingerprint against the previous commit, then play the default map and a room authored with a wave.

## Implementation Notes

- **The clock when nothing reinforces.** Do not park it at infinity. The crowd in force follows the player between rooms, so a clock parked when they stand in an empty room would never restart when they walk back into a busy one. Let it come due, find nothing to do, and set itself a short re-check instead.
- **Carrying the overshoot.** The interval is added to whatever is left rather than assigned, which is what keeps the rate honest across a frame that ran long. Keep that for the wave case.
- **The singular announcement is load-bearing for the shipped map.** One body arriving must produce exactly the sentence it produces today; only a wave of more than one gets the new wording.

## Edge Cases

| Case                                                     | Expected Handling                                           |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| A room declares a crowd but no reinforcement             | Its starting bodies stand, and none are ever replaced       |
| A wave is larger than the room has space under cap       | As many as fit arrive, and that is the number announced     |
| A wave finds nowhere far enough from the player          | Fewer arrive; nothing is announced when none did            |
| The player walks from a reinforcing room to an empty one | The clock finds nothing to do and keeps re-checking cheaply |
| An interval is stated as a fraction of a second          | Legal, as it is today                                       |
| A starting count's range exceeds the cap                 | The cap wins, as it does today                              |

## Acceptance Criteria

1. A run with no map named plays the floor it plays today, and the same seed produces the same floor, bodies and kit as before this change.
2. A room stating a wave larger than one receives that many bodies at once, and the message says how many arrived.
3. A room stating a range for its starting count begins with different numbers on different floors.
4. A room declaring a crowd but no reinforcement never gains a body.
5. The verification gate passes, and no test file is added.

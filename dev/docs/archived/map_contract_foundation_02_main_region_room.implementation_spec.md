# The Main Region Becomes A Room

Parent Plan: `map_contract_foundation.plan.md`

## Goal

Make the middle of the floor a room like the four hanging off it, and move the crowd numbers — the cap, the starting count, and the reinforcement interval — off the module that owns bodies and onto the rooms that hold them. Nothing observable changes: every room declares the same three numbers, so the crowd a player meets is the crowd they met before.

## Summary

Today the floor has four rooms and a middle. The middle is not a room, it is whatever is left after the four are subtracted, so nothing that varies per region has anywhere honest to live — which is why the enemy cap, the starting count, and the respawn interval are three module constants in the module that spawns bodies. A cap owned by the whole floor can state a total and can never say what any part of it holds.

After this child a floor carries five rooms. They differ by what they hold and how they are built, never by kind: a side room hangs off a side, has a role, and has a doorway; the main region hangs off nothing, holds no business, and is carved rather than laid open. Every one of the five declares a crowd — a cap, a starting count, and a respawn interval — and the numbers in force at any moment are the ones belonging to the room the player is standing in.

The behavioural target is exact and the whole child is judged by it. All five rooms declare 20 / 14 / 5, which are today's `MAX_ENEMIES`, `BASE_ENEMY_COUNT`, and `SPAWN_INTERVAL_SECONDS`, so wherever the player stands the answer is the number the constant gave. Moving a number onto a room and changing it in the same child is what would make an unchanged run impossible to prove.

## Approach

- `DemoRoom` keeps its extent and centre and makes `role`, `side`, and `doorway` optional — the three things a side room has because it hangs off something. It gains a required `crowd`.
- `DemoCrowd` is `Readonly<{ cap; starting; respawnSeconds }>`. The generator declares one and gives the same one to all five rooms.
- `roomAt` now answers for the main region too. `standingRoom` is the total form of it: the room whose interior holds the cell, or the main region when the cell is between rooms — the two cells a doorway punches through belong to neither interior and the region everything hangs off is what owns them.
- The three exported constants in `src/demo/world.ts` are deleted. Their four consumers — floor population, the reinforcement tick, the debug top-up, and the flatten-arena key — read the standing room instead.
- `padRoomAt` gains a role filter. A pad is where a room's business stands, and a room with no business has none; without the filter the main region would report a pad at its centre that no consumer could ever use.

## What It Replaces

- `MAX_ENEMIES`, `BASE_ENEMY_COUNT`, and `SPAWN_INTERVAL_SECONDS` in `src/demo/world.ts`, and their imports in `src/demo/simulation.ts` and `src/demo/demo-surface.ts`.
- The rule that `maze.rooms` means "the side rooms", which held in five loops across the scene and in the room-visited task.

## Shapes To Avoid

- Letting the main region count towards the rooms-visited task. That task asks for four side rooms entered; it keys off `side`, and a room without one is not an answer to it.
- Giving the main region a role so it fits the existing branches. Every branch over roles is a fixture standing in a room, and the main region stands nothing up; falling through them cleanly is the correct outcome, not a gap.
- Deriving a floor-wide cap by summing the rooms. The cap in force is a property of where the body is standing, not an aggregate — the aggregate is the number this change exists to stop pretending is meaningful.
- Changing any of the three numbers while moving them.

## Verification

`npm run verify`. The run is the other half: same crowd size on arrival, same interval between reinforcements, same four rooms counted by the task.

## Acceptance Criteria

1. The main region reports as a room, with its own extent and its own crowd, and is told from the four side rooms by what it holds rather than by kind.
2. The enemy cap and respawn interval in force at any point are the ones belonging to the room the body is standing in.
3. The rooms-visited task still asks for and counts exactly the four side rooms.
4. A run's crowd is indistinguishable from before: same number standing there on arrival, same rate of reinforcement, same ceiling.

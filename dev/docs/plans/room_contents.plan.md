# What A Room Holds

## Goal

Give a room authority over what stands in it. Today the quantities that fill a floor — the pools, the caltrops, the emplacements, the things lying on the ground, and the bodies walking around — are constants in the code that assembles a floor, they are applied only to the region every other room hangs off, and every one of them is an exact number. A room cannot ask for fewer, cannot ask for none, and cannot ask for a range. This plan moves those declarations onto the room, lets them be ranges rather than fixed counts, guarantees that nothing they place can strand a piece of floor, and finally states terrain as a share of the room rather than a tally.

## Requirements

1. A room declares what is scattered into it, and a room that declares nothing receives nothing. The quantities are constants today and they land only in the region everything else hangs off, so a room a third the size receives a large room's worth, and no room has any way to say it wants an empty floor. The first thing that needs one is a place to stand and measure in, and there is no way to author it.
2. A quantity a room states may be a range as well as an exact number. Every quantity today is exact, which makes each floor's furniture identical in count and different only in position — and an author who wants "two or three of these" has to pick one and live with it.
3. Reinforcements arrive in the number the room asks for. Exactly one body arrives per interval, everywhere, always, so the only pressure a room can dial is how often — and "a wave" and "a trickle" are the same thing at different speeds rather than different things.
4. No floor is built holding a piece of walkable ground nothing can walk to. Only what cannot be broken through counts as cutting ground off: masonry, caltrops and emplacements are the player's business and there are ways through every one of them, while water costs bodies the floor may not have yet. Today nothing checks this at all — the one refusal that looks like it does treats every breakable thing as already broken, so it fires only on the boundary, which is never.
5. What plays today keeps playing identically, including the floors the capture harness photographs from a fixed seed. Moving a number from code to content changes where it is written and nothing else.
6. A room's terrain is stated as a share of its floor rather than a count of cells. A count is what made a small room unplayable when it received a large room's tally, and terrain is the part of a room that should thin out or thicken with its size rather than arriving in a fixed lot.
7. Ground that cannot be filled is authored, never generated. Water has a way out — bodies close it over — so a generator that makes a mistake with it makes a floor that is hard rather than dead. Ground with no such escape has no margin for a generator's mistake, so the only hand allowed to place it is an author's.

## Design

### Two kinds of quantity, and why they are not the same

What fills a room divides cleanly, and the division decides how each is stated.

| Kind                                         | Stated as     | Why                                                                         |
| -------------------------------------------- | ------------- | --------------------------------------------------------------------------- |
| Terrain — water, and ground like it          | A share       | It is a field. A field that arrives as a tally is dense or absent by luck   |
| Objects — caltrops, emplacements, ground kit | A count range | An author means "one emplacement in this room", never "three percent of it" |
| Bodies                                       | A count range | A cap is a promise about the room, and a promise is not a percentage        |

The share is the last child's business, because the same question — how does what a room holds scale with the room — has to be answered once for terrain and bodies together rather than twice with different answers.

### Everything a room states may be a range

One rule, everywhere: wherever a room states a quantity, it may write the number, or it may write the two ends of a range. That covers how many bodies start, how many arrive together, how long between arrivals, and how much of each thing is scattered.

The exact number stays legal and stays the common case, because most quantities have one right value and a range would be noise around it. What the range buys is the quantities that should not be identical every floor.

### A room that says nothing

The same rule the crowd already follows: a room that omits a declaration receives none of that thing. This is what makes an empty room authorable, and it is why the second half of the sandbox — the half that could not be written before — becomes two lines.

It also moves a rule out of the code and into the content. Hazards land only in the main region today, and the reason given is that a pool in the hot spring is noise on top of the one thing that room is for. That reasoning is right and it is a content decision, so the four side rooms will say it themselves.

### Ground nothing can reach

A floor can already strand ground. What is scattered into a room is bounded to that room and kept off the ways between rooms, which is what stops a pool sealing a doorway — but nothing stops one closing a ring around a corner of a room's own floor. Today the pools are small enough that it is rare rather than impossible, and nothing would notice if it happened.

The refusal that looks like it covers this does not. It asks whether the way out can be reached at all, and to answer that it treats every breakable thing as already broken — which is deliberate and correct for the question it asks, and useless for this one. So this plan adds a second question beside it rather than changing it: two refusals, two definitions of what stops a walk, each honest about which it means.

**What counts as cutting ground off** is settled by what a player can do about it. Masonry, caltrops and emplacements all come down to a weapon, so ground behind them is reachable and the floor is legal. Water does not, reliably — closing one cell costs three bodies, and a floor early in a run may not have three to spend — so ground behind water is not reachable and the floor is not legal.

**A floor that fails is repaired, not refused.** Refusing means a run that does not start because of a roll, which is the worst possible way to spend a guarantee. The repair is the one the assembly already performs to keep the ways between rooms open: walk back from the stranded ground to the ground that can be reached, and open what was in the way. It always succeeds, and it costs one pool cell.

### The proof

An empty room, eleven cells square, with nothing standing in it and nothing arriving — the map the previous plan could not finish, because nothing could say "nothing". It lands with the first child, and it stays the thing every later child is checked against: whatever a room can now declare, the room that declares none of it is still empty.

### Children

| Child | Focus                                                             | Form              |
| ----- | ----------------------------------------------------------------- | ----------------- |
| 02    | A room declares how its bodies start and how they arrive          | Spec              |
| 03    | No floor holds ground nothing can walk to                         | Spec              |
| 04    | Terrain is a share of the room, and unfillable ground is authored | Sketch, then spec |

Landing order is 01 → 02 → 03 → 04. The first two move quantities from code to content and are proved by nothing changing; the third adds a guarantee neither of them needed but the fourth cannot do without; the fourth is the only one that changes what a floor looks like. Child 01 has shipped; its spec is archived as `room_contents_01_a_room_declares_its_scatter.implementation_spec.md`.

**This plan is not goal-executable.** Child 04 carries taste — what share of a room should be water, and whether unfillable ground earns its place at all — and a child whose shape is open is a stop that has to be taken rather than written down. Children 01 through 03 may be authorized to run continuously if that is wanted; the fourth needs its own conversation first.

## Non-Goals

1. No change to depth scaling or to run difficulty. How much a floor's number adds to a room's is the tracker's open question and this plan does not answer it.
2. No new enemy, no change to what one does, and no change to where a reinforcement is allowed to appear.
3. No change to how a floor's blocks are laid out, how rooms attach to each other, or how doorways are opened.
4. No editor, and no workbench for any of this. It is authored by editing files.
5. No new tile beyond the one unfillable ground the last child may introduce, and that one is authored-only.
6. No new tests. Existing tests whose subject this moves are updated or deleted as part of the change.

## Acceptance Criteria

1. A room declaring nothing scattered into it is built with no water, no caltrops, no emplacements and nothing lying on its ground.
2. Starting the game with the sandbox named plays an empty walled room, eleven cells square, with nothing in it and nothing arriving.
3. A run started with no map named plays exactly the floor it plays today, and the capture harness photographs the same floors it photographed before.
4. A room can state any of its quantities as a range, and two floors built from the same room differ in that quantity.
5. A room can state how many bodies arrive together, and a room asking for more than one gets more than one.
6. No floor is built holding walkable ground that cannot be walked to from where the run arrives.
7. Ground behind masonry, caltrops or an emplacement is never treated as cut off; ground behind water always is.
8. A room states its terrain as a share of its own floor, and the same room at two sizes holds proportionally the same amount.
9. The verification gate passes at every child, and no test file is added.

## Execution

Perishable: this records the codebase on 2026-08-01, immediately after `map_library.plan.md` shipped its first two children. Re-check every coordinate against live code before acting on it.

Every child lands in `src/content/maps/room-schema.ts` and `src/demo/`. The demo half is verified by playing it and by `npm run verify`; there is no automated coverage for `src/demo/` and none is to be added.

**One constraint applies to every child and is easy to miss.** `npm run capture` seeds `Math.random`, and `buildDemoFloor` already records that the draw's position in the random sequence is load-bearing. Every roll this plan adds must therefore be skipped when a range's two ends are equal — `between` in `src/demo/maze.ts` (about line 286) consumes a random number even when minimum equals maximum, so a range of 14 to 14 would shift every subsequent roll and change every seeded picture. Short-circuit it, and give every migrated file today's exact numbers as equal-ended ranges, and the sequence is untouched.

### Child 02 — A room declares how its bodies start and how they arrive

- `MapCrowd` in `src/content/maps/room-schema.ts` (about line 33) is three exact numbers. `starting` and `respawnSeconds` become number-or-range using child 01's reader; `cap` stays exact, because a cap is a promise about the room and a random promise is not one.
- A fourth field states how many arrive together. Today `spawnReinforcement` in `src/demo/world.ts` (about line 857) adds exactly one and answers whether it managed; the caller in `src/demo/simulation.ts` (about line 977) fires it once per interval. The count is rolled at the caller and the loop stops early when the cap is reached, so a wave of three into two free places is two.
- `populateFloor` in `src/demo/world.ts` (about line 728) computes `Math.min(crowd.cap, crowd.starting + world.depth - 1)`. The depth term stays exactly as it is — how much a floor's depth adds is the tracker's open question and Non-Goal 1 keeps it out.
- The announcement in `src/demo/simulation.ts` (about line 982) says "Another one crawls out"; a wave of more than one needs it to say the number, or it reads as a bug.
- `crowdHere` in `src/demo/world.ts` (about line 535) answers the room the player stands in, and `flattenFloorForTesting` (about line 844) and the surface's fill-crowd key both top up to `cap`. None of those change.
- The migrated `crowd` values are today's numbers as equal-ended ranges, so the seeded sequence is unchanged.
- Verify by playing: the default map's pressure has to feel the same, and a room authored with a wave of three has to deliver three.

### Child 03 — No floor holds ground nothing can walk to

- `validateDrawnFloor` in `src/content/maps/map-schema.ts` (about line 444) is **not** changed. Its `passable` is `tiles[index] !== "border"`, which is deliberate: it asks whether the way out can be broken through to, and treating masonry as already broken is the right answer to that question.
- The new refusal sits beside it in the same module and takes the same `DrawnFloor`. Its passability is the one `waterEnclosesRegion` in `src/content/maps/room-schema.ts` (about line 184) already uses — `border` and `water` impassable, everything else passable — and the two should be read together, because they are the same rule asked at two moments.
- The repair belongs in `src/demo/maze.ts`, not in the content layer: the content layer answers whether a floor is legal, and the assembly is what makes it so. `clearWalkToRooms` (about line 651) is the pattern to copy — a came-from breadth-first search from the entrance, then a walk back along the path opening what is in the way. It already searches over floor and hazards together for exactly this purpose.
- Run the repair after the three scatters and after the entrance is picked, before `validateDrawnFloor` is called. The entrance is picked from `walkableCells` of the main block, so it is open ground by construction.
- The repair converts water, and only water. Caltrops and emplacements are passable to this check, so they never trigger it.
- Verify by playing several floors and by `npm run capture`: the repair opening a cell shifts no roll, so the pictures should be identical unless a floor actually needed repairing.

### Child 04 — Terrain is a share, and unfillable ground is authored

- Needs a sketch first. What share of a room should be water, whether a second unfillable ground earns its place at all, and whether bodies should also be stated as a density are all taste, and this plan deliberately does not answer them.
- What is already decided and does not need re-deciding: unfillable ground is authored only, never generated, per Requirement 7; and if it is added, it joins `water` in both the room's authored-cell check and child 03's refusal, in `src/content/maps/room-schema.ts` and `map-schema.ts` respectively.
- `MAP_TILE_KINDS` in `src/content/maps/room-schema.ts` (about line 22) is the list a new ground would join, and `src/demo/maze.ts` aliases it as `DemoTileKind` so that a kind added there without a branch here fails to compile. The branches to expect: `tileOfKind` (about line 505), `isFloorKind` (929), `blocksWalk` (951), `blocksVision` (934), and the renderer's own tile handling in `src/presentation/`.

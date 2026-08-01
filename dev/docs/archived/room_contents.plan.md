# What A Room Holds

## Goal

Give a room authority over what stands in it. Today the quantities that fill a floor — the pools, the caltrops, the emplacements, the things lying on the ground, and the bodies walking around — are constants in the code that assembles a floor, they are applied only to the region every other room hangs off, and every one of them is an exact number. A room cannot ask for fewer, cannot ask for none, and cannot ask for a range. This plan moves those declarations onto the room, lets them be ranges rather than fixed counts, guarantees that nothing they place can strand a piece of floor, and finally states terrain as a share of the room rather than a tally.

## Requirements

1. A room declares what is scattered into it, and a room that declares nothing receives nothing. The quantities are constants today and they land only in the region everything else hangs off, so a room a third the size receives a large room's worth, and no room has any way to say it wants an empty floor. The first thing that needs one is a place to stand and measure in, and there is no way to author it.
2. A quantity a room states may be a range as well as an exact number. Every quantity today is exact, which makes each floor's furniture identical in count and different only in position — and an author who wants "two or three of these" has to pick one and live with it.
3. Reinforcements arrive in the number the room asks for. Exactly one body arrives per interval, everywhere, always, so the only pressure a room can dial is how often — and "a wave" and "a trickle" are the same thing at different speeds rather than different things.
4. No floor is built holding a piece of walkable ground nothing can walk to. Only what cannot be broken through counts as cutting ground off: masonry, caltrops and emplacements are the player's business and there are ways through every one of them, while water costs bodies the floor may not have yet. Today nothing checks this at all — the one refusal that looks like it does treats every breakable thing as already broken, so it fires only on the boundary, which is never.
5. What plays today keeps playing identically, including the floors the capture harness photographs from a fixed seed. Moving a number from code to content changes where it is written and nothing else.
6. A room states its composition as shares of itself: how much of it is floor, what its walls are made of, and how much of it is water. **The original reason for this has been spent and the honest one is narrower.** Shares were asked for because a small room used to receive a large room's tally, but the first child cured that by moving the quantities onto the room. What remains is that composition is one statement — an author describing a room says "mostly open, half its walls timber, a little water", not three numbers in two unrelated units — and that a room resized should not need its contents recomputed.
7. A share never places a wall, only decides how many there are. A distribution can say what proportion of a room is masonry and cannot say where masonry goes; sprinkling walls to hit a percentage produces isolated blocks on open ground, with none of the corridors, dead ends and loops that make a room worth walking through. So the generator keeps deciding shape and the share decides how far it opens that shape up.
8. Ground that cannot be filled is authored, never generated. Water has a way out — bodies close it over — so a generator that makes a mistake with it makes a floor that is hard rather than dead. Ground with no such escape has no margin for a generator's mistake, so the only hand allowed to place it is an author's.

## Design

### Two kinds of quantity, and why they are not the same

What fills a room divides cleanly, and the division decides how each is stated.

| Kind                                         | Stated as     | Why                                                                         |
| -------------------------------------------- | ------------- | --------------------------------------------------------------------------- |
| Terrain — water, and ground like it          | A share       | It is a field. A field that arrives as a tally is dense or absent by luck   |
| Objects — caltrops, emplacements, ground kit | A count range | An author means "one emplacement in this room", never "three percent of it" |
| Bodies                                       | A count range | A cap is a promise about the room, and a promise is not a percentage        |

Bodies were considered for a share too and deliberately kept as counts. A room has one fixed size, so an author writing a cap is already writing it for that room; a density would be the same number in a longer form. Terrain earns a share for a different reason — it sits beside the wall mix and the openness, and those three are one description of what a room is made of.

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

### Composition is three questions, and only two of them take a share

A room's make-up looks like one table — so much floor, so much timber, so much stone, so much water — and writing it as one would be wrong, because the three questions underneath are answered at different moments by different things.

| Question                     | Answered by                | Stated as         |
| ---------------------------- | -------------------------- | ----------------- |
| Where are the walls?         | The generator's own shape  | Not stated at all |
| How much of the room is open | Opening up that shape      | A share           |
| What is each wall made of    | A draw per wall            | A share           |
| How much of the floor is wet | Scattering onto open floor | A share           |

**Where the walls go cannot be a share**, and that is the whole reason this is not one table. The generator runs a backtracker and leaves corridors, dead ends and — once opened up — loops; a room built by drawing each cell against a percentage instead is static, and static is not a room. Measured on the region the shipped map hangs everything off: the bare carve leaves just over half the interior open, and that is the tightest the room can be. A share cannot ask for less, because the corridors are already the minimum.

**How open the room is** is therefore a target the opening-up works towards rather than a rate applied blindly. Today a fixed proportion of the surviving walls is knocked out and the result lands wherever it lands; stating the destination instead means a room says how open it wants to be and the generator gets it there.

**Water is scattered, not drawn.** It can only go on ground that is already open, and never across the ways between rooms, so it cannot come out of the same draw the walls do — it happens later, on what the walls left. It takes a share because it is terrain, but it stays where the other scattered things are, and a file that puts the two blocks next to each other reads as one recipe without pretending they are one operation.

### The proof

An empty room, eleven cells square, with nothing standing in it and nothing arriving — the map the previous plan could not finish, because nothing could say "nothing". It lands with the first child, and it stays the thing every later child is checked against: whatever a room can now declare, the room that declares none of it is still empty.

### Children

| Child | Focus                                             | Shipped as                                                            |
| ----- | ------------------------------------------------- | --------------------------------------------------------------------- |
| 01    | A room declares what is scattered into it         | `room_contents_01_a_room_declares_its_scatter.implementation_spec.md` |
| 02    | A room declares how its bodies start and arrive   | `room_contents_02_how_bodies_start_and_arrive.implementation_spec.md` |
| 03    | No floor holds ground nothing can walk to         | `room_contents_03_no_stranded_ground.implementation_spec.md`          |
| 04    | A room states its composition as shares of itself | `room_contents_04_composition_as_shares.implementation_spec.md`       |
| 05    | Ground that cannot be filled, authored only       | `room_contents_05_unfillable_ground.implementation_spec.md`           |

Landing order is 01 → 02 → 03 → 04 → 05. The first two move quantities from code to content and are proved by nothing changing; the third adds a guarantee neither of them needed but the last two cannot do without; the fourth is the first that changes what a floor looks like.

**The fourth and fifth were one child until the fifth's cost was measured.** A new kind of ground is not a tile added to a list: it needs a procedural floor texture, which is an asset, and around ten separate answers about whether a body can see over it, throw over it, fall into it, bleed into it or drown in it. Every one of those is judged by looking, which is a person's call and not something a spec can settle in advance. Composition needs none of that and ships on its own.

**All five have shipped, and three of them found something the plan had assumed away.**

Child 03's stranding was real rather than theoretical — eight floors in four thousand held ground nothing could walk to, and none do now.

Child 04 found that a room never keeps everything it scatters: the floor's guarantee of a walk to each room hanging off it reopens whatever stands on those routes, at roughly two cells per room, so the shipped region pours eighteen cells of water and keeps about thirteen. That has always been true of the caltrops and the emplacements too; stating water as a share is what made it visible. Delivering the declared amount exactly would mean scattering after those walks are cleared rather than before, which would keep pools off the routes between rooms entirely — a decision about how a floor should feel, and one this plan deliberately did not take.

Child 05 found that the compile-time guard this repository believed it had does not exist. The floor assembly's own header claims a tile kind added to the content list without a branch beside it fails to compile; every consumer is an if-chain with a fallthrough, so a new kind compiles cleanly and inherits a wrong default at each one. Six of a dozen were wrong for the trench, and the loudest would have let one swing break something nothing can break. The tracker now carries a `One Tile, One Record` draft: the enumeration is the disease, a data-driven record is the cure, and it waits behind the same gate as the enemy record beside it.

**This plan was never goal-executable**, and child 05 is why: whether unfillable ground earned its place, and how it should answer each of the game's verbs, were decisions a spec could not settle in advance. Each child was authorized in its own right.

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
8. A room states how open it is, what its walls are made of, and how much of it is water, each as a share of itself, and the built floor matches what it asked for.
9. A room asking to be more open than its own corridors already make it gets those corridors and no less, rather than a refusal or a run that does not start.
10. Ground that cannot be filled appears only where an author placed it, never where a generator did.
11. The verification gate passes at every child, and no test file is added.

## Execution

Perishable: this records the codebase on 2026-08-01, immediately after `map_library.plan.md` shipped its first two children. Re-check every coordinate against live code before acting on it.

Every child lands in `src/content/maps/room-schema.ts` and `src/demo/`. The demo half is verified by playing it and by `npm run verify`; there is no automated coverage for `src/demo/` and none is to be added.

**One constraint applies to every child and is easy to miss.** `npm run capture` seeds `Math.random`, and `buildDemoFloor` already records that the draw's position in the random sequence is load-bearing. Every roll this plan adds must therefore be skipped when a range's two ends are equal — `between` in `src/demo/maze.ts` (about line 286) consumes a random number even when minimum equals maximum, so a range of 14 to 14 would shift every subsequent roll and change every seeded picture. Short-circuit it, and give every migrated file today's exact numbers as equal-ended ranges, and the sequence is untouched.

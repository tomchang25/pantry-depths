# Four Skeletons, One Death Set, And Slimes That Only Block

## Goal

The demo has one authored body and every way it can die is a baked clip of its own, so a second authored body costs what the first did and a fourth costs four times as much. This plan makes the death set shared content owned by no single type, cuts each type's private clips down to the ones only that type can show, adds three more skeletons built around the weapons they drop, and reduces the slimes to the one job they are actually for — a body in the doorway.

## Requirements

1. Every skeleton type shares one death set, classified by the situation that killed the body rather than by the injury it depicts — the injury naming is what produced a clip called "severed right arm" and then reused it for two unrelated deaths, and a situation is the thing the simulation actually knows.
2. Each type privately owns only the clips where its weapon is in motion: standing, walking, being hurt, being stunned, winding up, striking, and recovering. The weapon is modelled as part of the body, so a shared walk would put a swordsman's blade in a hammer-bearer's hands.
3. Frames per clip become a per-clip decision instead of a fixed eight, because most of these clips do not need eight — a body driven into masonry holds one pose, and a walk cycle reads in four.
4. Pursuit and attacking become independent, and every attack state — winding up, striking, recovering — holds the body still and shows which one it is in. Today the standing still already happens but only as an accident of the cooldown check, so it is invisible: a swordsman that has just swung looks exactly like one that has not noticed you, and the most valuable window in the fight is the one the player cannot see.
5. Each slime colour is its own entity with its own health, drawn size, and footprint, sharing one behaviour with the others. None of them attacks and none of them drops anything; what a slime costs the player is position, not health.
6. Three more skeletons: a hammer-bearer that charges, and two ranged types with identical behaviour separated only by wind-up and cooldown — same behaviour with different timing is a different threat, and it costs no new AI.
7. Every skeleton rolls on one drop table shape with per-type numbers, and a bone burst leaves nothing behind — one table is the only place to look for what killing something is worth, and bones that were both scenery and loot made a bomb through a crowd carpet the floor in weapons.
8. The thrown axe becomes a single-use hammer that spends itself breaking through masonry — with bombs held back for a later system, demolition needs a tool, and a tool that opens three walls once is a decision the player makes rather than an item they hoard.

## Design

### The clip budget

Eight directions and a 256-pixel cell are unchanged. An atlas is as wide as its frame count and as tall as its direction count, so frames are the only knob and each clip sets its own.

Shared death set, one copy for every skeleton type:

| Death    | Situation                                          | Frames | Decoded     |
| -------- | -------------------------------------------------- | ------ | ----------- |
| Collapse | Cut down by anything ordinary                      | 8 × 8  | 16.8 MB     |
| Drowning | Gone under water                                   | 8 × 8  | 16.8 MB     |
| Cleaved  | Opened by a thrown blade                           | 8 × 4  | 8.4 MB      |
| Slammed  | Driven into masonry, thrown or pinned there        | 8 × 1  | 2.1 MB      |
| Impaled  | Run through — riding a shaft, or dropped on spikes | 8 × 1  | 2.1 MB      |
| Blasted  | Blown apart                                        | none   | 0           |
|          |                                                    |        | **46.2 MB** |

Private action set, one copy per type, every clip 8 × 4:

| Action   | Decoded     |
| -------- | ----------- |
| Idle     | 8.4 MB      |
| Walk     | 8.4 MB      |
| Hurt     | 8.4 MB      |
| Stunned  | 8.4 MB      |
| Wind-up  | 8.4 MB      |
| Strike   | 8.4 MB      |
| Recovery | 8.4 MB      |
| Per type | **58.7 MB** |

Four types come to 234.9 MB, and with the shared deaths the whole set is **281 MB decoded and roughly 84 MB on disk across 33 atlases**. Today's single body is 168 MB and 49 MB across 10. Four bodies built the way the first one was would be about 672 MB. So four skeletons cost 1.67 times what one costs now, and 42 percent of the naive figure.

Two of those numbers are choices worth naming. Collapse and Drowning keep all eight frames because they are the two deaths the player watches from beginning to end — one is the ordinary outcome of every fight and the other runs for over a second while the water closes. Blasted has no artwork at all: a body a bomb reached does not fall over, it stops existing, so the death is entirely a burst and the cheapest thing in the set is also the most correct.

### The three attack clips, and why recovery is one of them

The current body has one attack clip doing two jobs, with the first two-thirds read as the wind-up and the last third as the release. It becomes three clips, because there are three states and the player needs to tell them apart:

| State    | What the body does                    | What the player reads |
| -------- | ------------------------------------- | --------------------- |
| Wind-up  | Frozen, aim locked, weapon rising     | Get out of the way    |
| Strike   | Frozen, the attack resolving          | Too late              |
| Recovery | Frozen, weapon down, gathering itself | Free hits, now        |

Recovery is the one that does not exist today. The body already stands still for the whole cooldown, but it stands still in its idle pose, so the single most useful window in a melee fight is indistinguishable from an enemy that has not noticed you. Giving it a clip is what turns the cooldown from a hidden number into a thing the player hunts for.

Splitting wind-up from strike is also what lets the two keep different timing, and the long wind-ups need it: three seconds spread evenly over four frames is a slideshow. A wind-up plays quickly to its final pose and holds it for whatever is left, so the raise reads as a raise and the wait reads as a body committed and waiting. Recovery plays the same way in reverse. The strike plays at its own rate and does not stretch.

### Pursuit and attacking as two systems

Today a body's reach decides whether it walks: inside reach it either attacks or returns without moving, and returning without moving is what it does for the whole cooldown. That single early exit is the coupling, and everything below follows from removing it.

Pursuit runs for any body that is not in an attack state, and reads one thing — the distance band this type wants to hold. Attacking runs only for bodies that have an attack, reads only its own timers, and while it is running it suppresses pursuit entirely.

| Body            | Band it holds                                               |
| --------------- | ----------------------------------------------------------- |
| Slime           | None — it wants to be inside the player                     |
| Melee skeleton  | Its own reach                                               |
| Ranged skeleton | Four to seven cells, backing off inside and closing outside |

A slime has no attack, therefore no attack states, therefore nothing that can ever suppress its pursuit. It walks into the player forever. That is the whole reason the split is worth doing rather than special-casing the slime: the slime is not an exception to the rule, it is the case where half the rule is simply absent.

The consequence for the skeletons is deliberate and worth stating plainly, because it is the shape of every fight on the floor: **a skeleton spends most of its life standing still.** A javelineer holds a three-second wind-up and a three-second recovery; a crossbowman holds one second and six. The floor becomes a set of committed, readable statues that the player walks between and dismantles, with the slimes providing the only continuous pressure. That is the intended feel — the same trade the charger already made when its wind-up went to three seconds — and it is why recovery needed its own picture.

The sidestep the shooter performs today while on cooldown is removed by this. It existed so a shooter would not be a target painted onto the floor; the answer now is that being exactly that is the price of a six-second cooldown.

### The slimes

Three separate entities sharing one behaviour, not one entity with three appearances. Each carries its own numbers, so a colour is a thing you tune rather than a tier you derive:

| Slime | Health | Drawn height | Footprint | Shove |
| ----- | ------ | ------------ | --------- | ----- |
| Green | 20     | 0.30         | 0.22      | 0.45  |
| Blue  | 34     | 0.42         | 0.30      | 0.60  |
| Red   | 52     | 0.56         | 0.38      | 0.80  |

Starting values, monotonic on purpose — the three today are not, and a set where the tallest is the second-weakest teaches the player nothing.

No attack, no wind-up, no reach, no cooldown. A slime walks into the player and shoves them off the line they were holding — a push and never a block, so a crowd drags at the player and steers them somewhere they did not choose but can never seal them in.

The footprint drives the drawn body, the strength of the shove, and the size of the target a thrown object has to hit. It deliberately does **not** drive wall clearance, which stays one number for every body on the floor: a large slime with a large clearance radius wedges in corridor corners, and a body that cannot get through a doorway cannot block one either. Those two circles are different on purpose, so the workbench draws both.

Slime drops are removed outright. Bombs keep their behaviour, their flight, and their blast, and simply have no source — they are parked, not deleted, so whatever picks them up later changes nothing but where they come from.

That leaves two sources of weapons, which is the point: skeletons and walls. Killing a skeleton yields bones and, on a roll, its armoury. Breaking masonry yields stakes from timber and stones from stone. Anything better than a rock has to be taken off something that was carrying it.

### The four skeletons

| Type          | Behaviour                                        | Wind-up | Cooldown | Weapon   |
| ------------- | ------------------------------------------------ | ------- | -------- | -------- |
| Swordsman     | Closes and cuts a cone it cannot turn inside     | 1 s     | 1.8 s    | Sword    |
| Hammer-bearer | Charges a lane it locks and cannot leave         | 3 s     | 3.5 s    | Hammer   |
| Javelineer    | Holds a standoff band, throws in a straight line | 3 s     | 3 s      | Javelin  |
| Crossbowman   | Same band, same straight line                    | 1 s     | 6 s      | Crossbow |

The two ranged types are one behaviour with two rhythms. The javelineer is a long, obvious commitment that repeats often; the crossbowman is a short commitment that rarely comes again. Which of the two is standing in a room changes how the player crosses it without changing a line of how it thinks.

Their projectiles differ, and the numbers describing a shot move onto the type rather than staying one shared set. A javelin is slower and heavier, hits harder, and shoves the player slightly — a small push, enough to cost them the ground they were standing on and nowhere near enough to take control away, which is what makes a three-second telegraph worth respecting rather than merely surviving. A bolt is fast, flat, and cheaper.

**Neither ranged type has a contact attack.** Walking up to one and standing in its face is completely safe. That is not an oversight: a body whose whole threat is at four to seven cells should have nothing at all at zero, and the reward for closing that distance is that the thing stops being dangerous.

The hammer-bearer inherits the charger's whole arrangement, which was already built for a three-second commitment — it paints its lane, burns while it gathers, damages what it fails to get through, and lies stunned for five seconds if it stalls. Nothing about that changes; it stops being a slime.

### Drops

One table shape for every skeleton, with per-type numbers. The defaults are the same for all four:

| Roll | Leaves         |
| ---- | -------------- |
| 40%  | Nothing        |
| 30%  | Skull          |
| 20%  | Femur          |
| 10%  | Its own weapon |

The situation that killed the body no longer selects anything — a skeleton that drowned and one that was cut down roll the same table. The bone burst that plays on the four scattering deaths leaves nothing collectable at all; it is decoration, and this table is the only source of loot from a corpse.

A dropped crossbow carries three shots and then the stock itself is throwable, which is the behaviour it already has at a different count.

### Bone shatter

Four of the six deaths lean on a burst of bones rather than on baked frames: Cleaved needs its two halves separating, Blasted is nothing but the burst, and Slammed and Impaled are single frozen poses with the scatter doing the rest of the work.

Cleaved is the one visual risk in the set. A single frame cannot show two halves parting, which is why it gets four rather than one — the sprite starts whole and comes apart, and the burst carries the rest. If four still does not sell it, that clip is the first place to spend more frames.

A body driven into masonry leaves no mark on the masonry. The wall stain that exists today belongs to a soft body bursting against stone; bones do not stain, and a skeleton slammed into a wall is a heap at the foot of it.

### The hammer

The thrown axe becomes the hammer, and it is the demolition tool that bombs are being taken away from.

- Bodies do not stop it, do not count against it, and do not survive it. It kills outright through as many as stand in its line, whatever their health.
- It carries a budget of three. Stone costs one and timber costs one, and it must break each of them, so it strikes hard enough to open either in a single hit.
- Everything else costs the whole budget and stops it dead: a barricade, a mortar emplacement, the outer boundary, and the floor if the throw was aimed down.
- One use. It is gone when it stops, wherever it stopped.

One number and one rule, with no exceptions list: everything the hammer can meet either costs one or costs three. A player who throws it down a corridor gets three walls and every body between them; a player who throws it at their feet gets nothing.

Three parts of that are new rather than a different set of numbers. A wall currently ends any throw the moment it is touched and the damage is settled afterwards, so a projectile that spends walls as it flies is a new flight rule. "Breaking through" has to mean the wall actually opens, which sets the strike hard enough to overlap what a bomb used to do — that overlap is intended, because the bomb has no source any more. And a throw currently has no notion of touching the floor at all: flat weapons end when their range runs out, so aiming one down and having it stop where it lands is a stopping condition that does not exist yet.

### What the workbench must show

The workbench is the only place any of this is verified, since the demo half takes no automated tests.

- A third coverage state beside available and missing: procedural. Blasted has no artwork by design, and a matrix that reads absent artwork as a gap will show a permanent false alarm forever.
- The shared state disappears. Every situation now owns its own clip, so nothing is borrowed and nothing can report as borrowed.
- Both slime circles at once — the drawn footprint and the wall clearance — because they are deliberately different and the author has to see by how much.
- The full clip list per type at its own frame count, so a four-frame walk is scrubbed as four frames rather than as half of an eight-frame sheet.
- The three attack states as three separately reachable clips, with the wind-up held at its final pose and checked at three seconds as well as at one.
- Recovery reachable on its own, at each type's cooldown length, because whether it reads as "free hits" at six seconds and at 1.8 is the whole question that clip exists to answer.

### Child overview

Every child has shipped. The table is empty because it is forward-only: a row is cut when its work lands, and the last of them has. What remains is the pass this plan cannot do for itself — playing the floor against the Acceptance Criteria above, and judging in the entity workbench whether the baked poses read.

## Non-Goals

1. No weapon layer separated from the body. It was costed: sharing the low-motion clips across types and compositing a weapon over them saves roughly a quarter of the memory, and cutting frames already took most of what it would have won — that quarter is not worth a new sprite capability, a per-frame hand-anchor table, and a per-direction draw-order rule.
2. No 3D layer. The memory case for one is much weaker once four bodies fit in 1.67 times the space one takes today. What would still force the question is the cost of the authoring loop, not the cost of the pixels, and that is a separate decision.
3. No movement during any attack state, for any type. The strafe-while-recovering behaviour the shooter has today is removed rather than generalised — standing still is the cost of a committed attack and the player is owed the chance to see it.
4. No new slime behaviour. The slimes lose things; they gain nothing. A slime that pushes as it advances is a later idea and needs pursuit and attacking separated first, which is what child 01 delivers.
5. No replacement source for bombs. They keep every behaviour they have and simply cannot be found.
6. No death cause influencing drops. One table, rolled the same way whatever killed the body.
7. No automated tests for anything the player sees. The one existing exemption — the asset manifest's loader, where a wrong-sized image becomes a startup failure no amount of playing reveals — is updated in place and does not grow. Authored content definitions keep the unit coverage they already have.
8. No change to eight directions or to the 256-pixel cell. Frame counts are the only dimension this plan moves.
9. No change to how the player's own attacks work. The hammer is a thrown object; the swing is untouched.

## Acceptance Criteria

1. All four skeleton types die through the same six situations, and no situation borrows another's artwork.
2. A body a bomb kills leaves no corpse — only a burst of bones — and that burst leaves nothing that can be picked up.
3. A body opened by a thrown blade visibly comes apart rather than falling over intact, and a body driven into a wall leaves no mark on the wall.
4. A skeleton winding up, striking, and recovering are three states told apart by the body alone, and none of the three moves it.
5. A skeleton that has just attacked is visibly recovering rather than idling, at every type's cooldown length.
6. A slime never attacks, never stops advancing, and cannot be walked through; the three colours are visibly three sizes and demonstrably three healths.
7. No slime drops anything, and no bomb is found anywhere on a floor.
8. Every skeleton rolls the same drop shape, none of them drops a bone that the burst put on the floor, and a dropped crossbow fires three times before the stock is all that is left.
9. A javelineer and a crossbowman in the same room are told apart by rhythm alone, and standing in either one's face is safe.
10. A javelin that connects moves the player slightly off the ground they were standing on.
11. A hammer thrown down a line of bodies kills all of them whatever their health and keeps going, opens up to three walls, and is gone afterwards; thrown at a barricade, an emplacement, the outer boundary, or the floor it stops at the first one.
12. Every clip is scrubbable in the workbench at its own frame count, a three-second wind-up holds its final pose rather than crawling, and the coverage matrix reports no false gap.
13. Four authored bodies ship in under 300 MB of decoded sprite memory.
14. Verification passes, and the manual playtest confirms each criterion above.

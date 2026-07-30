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

| Child | Focus                                                                        |
| ----- | ---------------------------------------------------------------------------- |
| 01    | Split pursuit from attacking; attack states suppress movement and show which |
| 02    | Three slime entities: no attacks, no drops, own health, size, and footprint  |
| 03    | Per-clip frame counts and atlas dimensions, generator through loader         |
| 04    | The shared death set, the bone burst, and the workbench's procedural state   |
| 05    | The private action set, the three attack clips, a parameterised generator    |
| 06    | The hammer-bearer, the javelineer, and the crossbowman                       |
| 07    | The hammer: unlimited bodies, a budget of three, one use                     |

Landing order is 01 through 07. Child 01 is a hard prerequisite for 02 — a slime with no attack under the current coupling would stop dead at a reach it no longer uses. Child 03 is a hard prerequisite for 04 and 05, which are the two re-bakes and are otherwise independent of each other. Child 06 needs 04, 05, and 01 together, because a new type is an action set plus a band. Child 07 needs only 01 and can land any time after it; its supply arrives with 06.

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

## Execution

Coordinates recorded against the codebase as it stands when this plan was written. Re-check each one against the live code before executing its child; a stale line here is expected as earlier children land. Each subsection is cut when its child ships, in the same change that cuts its row from the child overview.

**What children 04 and 05 deliver is structure, not finished animation.** Both bake atlases, and the poses in the first bake are provisional by agreement: what those children own is the clip tables, the per-clip dimensions, the projection and precedence, the parameterised generator, and a bake that runs end to end. Judging whether a pose reads is a separate pass through the entity workbench against Acceptance Criteria 4, 5, and 12, and it is expected to replace keyframes rather than confirm them. Nothing in either child should be read as a claim that the artwork is right.

### 01 — Pursuit and attacking

`src/demo/enemy-ai.ts` is the whole change.

The coupling is the bare `return` at line 596, at the end of `stepMelee`'s in-reach branch. Reaching it means "in reach, cooldown running", and it exits without calling `walk`, leaving `enemy.moving` at the `false` set by line 485 — which is why a recovering body plays idle.

New shape for `stepEnemies` (line 483), replacing the archetype-id branch chain at 564–579:

1. Existing preamble unchanged: `decayTimers`, `applyPush`, drowning skip, `unstick`, charge step, stun skip.
2. If any attack state is live — `windupSeconds > 0`, `attackPoseSeconds > 0`, or `attackCooldown > 0` — run only that state's tick and `continue`. No `walk` call on any of these paths.
3. Otherwise run pursuit toward the archetype's band, then test whether the attack can begin.

`attackCooldown` is already decayed by `decayTimers` (line 49) and its total is `archetype.attackCooldown`, so recovery progress is `1 - attackCooldown / archetype.attackCooldown` with no new field. `attackPoseSeconds` is set to `windup + 0.2` in `beginWindup` (line 228) — that arithmetic goes away, the strike clip owns its own length, and `attackPoseSeconds` becomes the strike timer only.

Bands go on `DemoEnemyArchetype` in `src/demo/enemy-archetypes.ts` as `band: { near: number; far: number } | undefined`. `RANGED_STANDOFF` at line 246 is deleted and becomes `{ near: 4, far: 7 }` on the two ranged rows; a melee row is `{ near: contactRange * 0.85, far: contactRange }`; a slime row omits it. `stepRanged` (line 615) and `stepMelee` (line 583) collapse into one `pursue` that reads the band: inside `near` walk away, beyond `far` walk toward, inside the band stand. The sidestep at line 644 is deleted per Non-Goal 3.

Attack triggers keep their current predicates, just relocated: melee needs `distance <= contactRange` and `meleeWindup`; charge needs `distance <= CHARGE_TRIGGER_DISTANCE`, line of sight, and cooldown clear (line 569); ranged needs line of sight and `distance <= band.far` (line 622).

Delete the contact-damage fallback at lines 627–631 — that is the ranged melee poke, and Requirement 6 removes it. It is currently the only reason a shooter reads `contactRange` at all.

Animation precedence in `skeletonAnimation`, `src/demo/demo-scene.ts` line 553, becomes: drowning, hurt, **stunned**, wind-up, strike, recovery, walk, idle. Stunned must move above wind-up. Today it sits below (line 581 after 571), and `stepEnemies` skips a stunned body at line 502 before the wind-up block, so `windupSeconds` stays non-zero through the stun — a skeleton stunned mid-wind-up currently shows the wind-up pose with stars orbiting it. That is a live defect this reordering fixes.

### 02 — Three slime entities

`src/demo/enemy-archetypes.ts`: `DemoArchetypeId` (line 17) drops `walker` and gains `slimeGreen`, `slimeBlue`, `slimeRed`. The `WALKER` constant (line 96) becomes three rows. Each omits `contactDamage`, `meleeWindup`, `windupIntent`, `attackCooldown`, `windup`, `contactRange`, and `band`; those fields become optional on the type, and their absence is what "has no attack" means — no boolean flag. `ENEMY_ARCHETYPES` at line 217 gains the three and loses `walker`.

The three existing weight rows redistribute by size rather than by behaviour: today's `RANGED` weight (line 127, light and long) goes to green, `DEFAULT_BODY_WEIGHT` to blue, today's `CHARGER` weight (line 156, heavy and short) to red.

Footprint is a new `footprint: number` on the archetype, defaulting to `ENEMY_RADIUS` for anything that omits it. Readers to change:

- `jostlePlayer`, `src/demo/simulation.ts` line 105: `PLAYER_RADIUS + ENEMY_RADIUS` becomes `PLAYER_RADIUS + footprint`.
- `PROJECTILE_HIT_RADIUS` tests in `skewerWithJavelin` (line 344), `cleaveThrough` (371), `bargeThrough` (420), `hitsSomeone` (439): add the target's footprint.
- `SLIME_BODIES` in `src/demo/demo-scene.ts` line 989: `radius` is deleted from the record and read from the archetype instead, so drawn and bumped cannot drift. `height` and `color` stay keyed by appearance.

`ENEMY_RADIUS` at `src/demo/world.ts` line 418 keeps its current value and its current role in every `slideMove` and `unstick` call — wall clearance only. Do not thread footprint into `src/demo/movement.ts`.

`pickArchetype()` at `src/demo/world.ts` line 471 becomes two rolls: slime or skeleton, then which. Starting split is 40 percent slime — even thirds across the colours — and 15 percent each skeleton, which needs child 06 before the second roll has four faces.

Delete `DROP_TABLE` at `src/demo/world.ts` line 912 and its roll. Bomb and axe entries both go; every prop kind stays in the union and stays throwable.

Retune the three slime rows in `src/content/enemies/entity-display.json` to the drawn heights in the Design table. No schema change: `bodyScale` already exists per appearance and the validator at `src/content/enemies/entity-display-schema.ts` line 139 already refuses a missing row.

### 03 — Per-clip dimensions

`src/content/enemies/skeleton-swordsman-definitions.ts`: delete `SKELETON_SWORDSMAN_FRAMES` (line 37) and `SKELETON_SWORDSMAN_ATLAS_SIZE` (line 45). `SkeletonSwordsmanAnimationDefinition` (line 28) gains `directions: number` and `cell: number`; width and height are derived as `frames * cell` and `directions * cell` rather than stored, so a row cannot contradict itself.

`src/presentation/presentation-image-loader.ts`: `loadPresentationImages` (line 69) currently takes one `ExpectedImageDimensions` for the whole manifest and hands the same object to every `loadOne`. It needs to accept either a per-asset lookup keyed by asset id or a manifest whose values carry their own dimensions. Prefer the second — a manifest entry that carries its own expected size cannot be paired with the wrong one. `DEFAULT_IMAGE_DIMENSIONS` (line 29) stays for the 512-square shipped manifest.

`src/demo/demo-sprites.ts` lines 886–893: the single skeleton batch becomes one call with per-entry dimensions, replacing the shared `{ width: ATLAS_SIZE, height: ATLAS_SIZE }`.

`src/demo/demo-scene.ts` lines 614, 675, 707: `columns: SKELETON_SWORDSMAN_FRAMES` and `rows: SKELETON_SWORDSMAN_DIRECTIONS` all read the definition. `animationFrame` (line 536) already reads `definition.frames` and needs nothing.

`dev/tools/generate-skeleton-swordsman.py`: `FRAMES` and `ATLAS_SIZE` (lines 33–35) become per-clip; `bake_atlas` (line 57) takes the clip's frame count for both its source loop and its `-tile` argument; the dimension assertion at line 172 compares against that clip's expected size. `extract_still` (line 84) is unaffected — it cuts from cell zero.

Tests: `test/unit/content/enemies/skeleton-swordsman-definitions.test.ts` lines 16–17 assert the two deleted constants and lines 23–28 list the ten clip ids. Both are updated, not widened. `test/unit/presentation/presentation-image-loader.test.ts` is the frozen exemption in `test/unit/repository/demo-half-is-untested.test.ts` line 31; its subject is changing, so it is updated in place. Neither is a new test and neither needs permission — `dev/agent_rules/test_operations.md` covers this under "When A Test Breaks".

### 04 — The shared death set

Clip ids: `SkeletonSwordsmanAnimationId` (line 16) splits. Shared deaths become `SkeletonDeathId` = `collapse | drowning | cleaved | slammed | impaled`, with `blasted` deliberately absent from the union because it has no atlas. Asset ids move from `enemy.skeletonSwordsman.atlas.*` to `enemy.skeleton.death.*`, and the files to `src/content/enemies/assets/skeleton-common/`.

`skeletonDeathAnimation` at `src/demo/demo-scene.ts` line 620 becomes a lookup returning `SkeletonDeathId | undefined`, with `undefined` for `blasted`. `skeletonDeathSprite` (line 649) returns `RenderSprite | undefined`; its caller drops a nothing. The `drowning` branch at 661 and `drownedCorpseStage` stay as they are.

`carriedSkeletonSprite` (line 682) uses the impaled pose. `animationFrame(animation, 0.62)` at line 705 becomes column 0 — one frame, no magic number.

Delete `skeletonDrop` at `src/demo/world.ts` line 797 outright. Nothing replaces it inside this child; child 06 brings the unified table.

`dev/tools/skeleton-swordsman/build.py`: `CLIP_DURATIONS` (line 37) loses `death-sever-right`; the remaining death actions are rewritten — `death` and `death-drowned` keep 24 frames sampled 8 times, `death-cleaved` samples 4, `death-slammed` and `death-impaled` sample 1 at their held pose. `set_sever_visibility` (line 489) and its two call sites (518, 522) are deleted; a one-frame or four-frame clip has no third sample to hide a hand at.

Bone burst: a new emitter beside the existing `burst` in `src/demo/particles.ts`, called from the single kill exit in `src/demo/world.ts` rather than from each cause, taking the cause to decide count and spread. Six to eight fragments, no props created, nothing collectable. The skull and femur stills already exist as 512-square assets and can be the fragment art.

Workbench, `src/app/debug/entity-workbench.ts`: `CoverageState` (line 62) gains `procedural`; `deathCoverage` (line 472) drops its shared-shape grouping — with one clip per cause nothing can collide — and reports `procedural` where the projection is empty by design, which needs an explicit list rather than inferring it from emptiness. `marksTheWall` (line 523) must now expect no wall placement for a boned body, and `hangsOnIron` (line 530) must expect a frozen pose rather than a lifted anchor. Both are assertions about the old behaviour and both are wrong after this child.

### 05 — The private action set

Per-type clip ids: `SkeletonActionId` = `idle | walk | hurt | stunned | windup | strike | recovery`. Four asset modules under `src/content/enemies/assets/skeleton-<type>/`, asset ids `enemy.skeleton.<type>.<action>`. The definitions file splits into a shared death module and a per-type action table keyed by appearance.

`skeletonAnimation` at `src/demo/demo-scene.ts` line 553 is rewritten to the precedence from child 01. The two magic mappings go away: `progress * 0.68` at line 573 and `0.68 + max(0, progress) * 0.32` at line 578 become plain progress into the wind-up and strike clips. `STUN_HELD_AT` and the single-frame stun at line 582 become a looping four-frame clip.

Wind-up and recovery both need ease-then-hold rather than linear progress, or a three-second wind-up advances a frame every 0.75 s. Reach the final frame in a fixed 0.45 s and hold it for the remainder; recovery runs the same curve reversed. This is the only place a clip's playback is not linear, and it is why the wind-up and strike are separate clips at all.

`block` is gone as a name everywhere. Note it was never dead code: line 582 played its frame 5 for the entire stun, which is where the workbench comment at line 122 comes from.

`dev/tools/skeleton-swordsman/build.py`: `main` (line 608) takes a type and a weapon. `create_character` (line 108) line 152 hardcodes `create_sword(...)` parented to `hand.R`; that becomes a weapon factory selected by argument, with hammer, javelin, and crossbow joining the sword in `dev/tools/blender-kit/primitives.py`. `create_actions` (line 156) keeps the shared poses and takes per-type overrides for the three attack clips. The entry point `dev/tools/generate-skeleton-swordsman.py` is renamed and loops the four types, baking the death set once.

Workbench: `EntityBodyState` (line 58) becomes `idle | walk | hurt | stunned | windup | strike | recovery | dying`; `BODY_STATES` (line 102) and `LIVING_STATES` (line 114) follow; the swordsman-only branch at line 1332 and the frame-count read at line 684 both generalise to the selected type.

### 06 — The three new skeletons

`src/content/combat/enemies.ts` line 7: `EnemyAppearanceId` gains `skeletonHammerman`, `skeletonJavelineer`, `skeletonCrossbowman`. The union stays in this file — moving it out of the legacy turn-based module is a separate refactor and not part of this plan. `APPEARANCE_IDS` in `src/content/enemies/entity-display-schema.ts` line 17 mirrors it by hand and must be updated in the same change, and `src/content/enemies/entity-display.json` needs three new rows or the validator refuses the file at load.

`src/demo/enemy-archetypes.ts`: three new rows. The hammer-bearer copies `CHARGER` (line 149) with `body: "boned"`, a `turnRate`, and health one step above the swordsman's 46. The two ranged rows copy `RANGED` (line 121) with `body: "boned"`, the band from child 01, and the wind-up and cooldown from the Design table.

`RANGED_SHOT_SPEED`, `RANGED_SHOT_DAMAGE`, and `RANGED_SHOT_RANGE` (lines 247–249) are deleted and become a `shot: { speed, damage, range, knockback }` on the two ranged rows. Javelin: slower, higher damage, small non-zero knockback. Bolt: current values, zero knockback.

`src/demo/enemy-ai.ts` line 564 branches on `enemy.archetype.id === "ranged"`. It becomes a test on `windupIntent === "shoot"`, so a third ranged type cannot be forgotten. `fireShot` (line 233) reads the row's `shot` instead of the module constants; the knockback is applied in `stepHazards`' bolt-hit branch at `src/demo/simulation.ts` line 579, beside `hurtPlayer`, as a push on `world.player`.

`BONED_DROP_TABLE` at `src/demo/world.ts` line 924 becomes the per-type table from the Design section — cumulative thresholds 0.30 skull, 0.50 femur, 0.60 weapon, above which nothing — with the weapon column set per appearance. The crossbow entry's `count: 5` becomes `count: 3`.

`src/demo/throw-weight.ts` needs a `hammer` prop row before this child can give the hammer-bearer its weapon; taking child 07 first avoids a placeholder.

### 07 — The hammer

`src/content/presentation/prop-display-schema.ts` line 20 renames `axe` to `hammer`, and `src/content/presentation/prop-display.json` line 24 follows. `src/demo/throw-weight.ts` lines 157 and 332, `src/demo/actions.ts` lines 86 and 103, `src/demo/demo-sprites.ts` line 293 and 903, and `src/demo/demo-surface.ts` lines 104 and 121 all carry the name.

Behaviour row: `flightHit: "cleave"`, `landing: "spend"`, `leaves: undefined`, `wallDamage: 4`, and a `capacity` that is no longer about bodies. Four is the smallest value that opens stone, whose hit points are set in `src/demo/maze.ts` — timber is 2, stone 4.

`cleaveThrough` at `src/demo/simulation.ts` line 360: the `projectile.cleaved >= throwCapacity(...)` test at line 380 is removed for this weapon, so bodies never end the flight. `throwCapacity` (`src/demo/throw-weight.ts` line 444) is re-read as a masonry budget; `projectile.cleaved` (`src/demo/world.ts` line 146) stays as the announce counter.

`stepProjectiles` at `src/demo/simulation.ts` lines 492–511 is the real work. Today `blocksProjectileAt` sets `struckCell`, sets `finished`, steps the projectile back out of the cell, and the wall is damaged once after the loop at line 533. For the hammer the branch becomes:

1. Read the tile kind at the struck cell.
2. Stone or timber: `damageWall` at 4, add 1 to a spent counter, do **not** step back, do **not** finish. If the counter reaches 3, finish in the opening.
3. Barricade, mortar, or border: `damageWall` for its own effect, step back, finish.
4. Water and open are not obstacles and never were.

`damageWall` at `src/demo/actions.ts` line 327 already dispatches all five tile kinds correctly, including refusing the border with an announcement at 334 — it needs no change, only to be called per wall instead of once at the end.

Floor contact: `flightHeight` at `src/demo/world.ts` line 876 clamps with `Math.max(0, ...)`, so height never goes negative and there is no landing event. Add a separate predicate that reports the unclamped value crossing zero, and test it in the step loop beside the wall check. Only weapons that stop on the floor consult it; every existing lobbed throw still ends on its range as it does now, so the clamp itself must not change.

Art: `axe()` at `src/demo/demo-sprites.ts` line 293 is a procedural canvas and needs a hammer head. The `rod` flight form and the beam entry at `src/demo/demo-scene.ts` line 274 stay; a hammer tumbles like an axe.

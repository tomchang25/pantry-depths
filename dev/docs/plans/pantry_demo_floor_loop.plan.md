# A Floor You Can Leave, And Reasons Not To

## Goal

A floor in the demo has no ending and no exit worth the name: bodies trickle in forever at a fixed rate, the stairs are the only way out, and taking them is the only thing that pays, so a floor is either skipped whole or ground flat with nothing in between. This plan gives a floor a task it owes, an exit that is always open and never marked, rewards that are only banked by leaving, and a run-wide clock that prices every minute spent on it — so the question at the end of a floor stops being "have I farmed enough" and becomes "do I go one more round". It lands entirely in the parts of the codebase a concurrent enemy-and-sprite plan does not claim.

## Requirements

1. A floor carries one main task and three secondary tasks. Meeting the main task unlocks the descent and reveals where it is; each secondary pays a blessing on the spot. Descending itself pays nothing — a reward for descending is a reward for skipping the floor, which is the behaviour this plan exists to remove.
2. Every floor has an extraction route that is open from the moment the player arrives and is never marked. Always-open makes leaving a continuous choice rather than a single gate at the end; unmarked makes knowing the route something the player spends time to earn, so a floor entered greedily can end with them unable to find the way out. Both halves are needed: an always-open exit that is also always visible removes the decision, and a marked exit behind a lock removes the escape.
3. Rewards taken from a floor stay sealed until the player extracts, and resolve only then into either a weapon core or a fragment. What the player carries out is therefore a gamble whose stake rises with every floor survived, which is the pressure the clock in requirement 5 is there to squeeze.
4. Two sources of sealed rewards, told apart by risk rather than by rate. The main task pays a clean one weighted toward fragments; smashing a cursed altar pays one weighted toward cores, whose rolls range wider in **both** directions — better than clean at the top and worse at the bottom. A curse that can only improve an item is not a curse, and a separate table of drawbacks is not needed once the range itself carries the risk.
5. Difficulty is one run-wide level that rises with elapsed time and with each descent and never falls. Time is the price of everything the player chooses to do on a floor; a clock that reset on descent would turn descending into a way to buy difficulty back, which reintroduces exactly the incentive requirement 1 removes.
6. The level is derived and displayed by this plan and read by nothing else. Enemy statistics stay exactly as they are, because the tables that would carry the scaling are being rewritten by concurrent work and the two changes cannot meet safely. Wiring the level into enemies is the first thing to do after that work merges, and it is not done here.
7. Blessings never run out. The authored catalogue is finite and every entry in it is a distinct mechanic; when it is exhausted the game keeps paying from an open-ended set of stacking numeric buffs. Breadth in that second set is the answer to running dry — not a special case at the moment of award, which is what the single fixed consolation buff today amounts to.
8. This plan builds the ladder, not new authored blessings. The distinct mechanics still waiting to be written mostly modify combat behaviour in modules the concurrent plan owns, so the finite tier keeps the entries it already has and grows later.
9. A weapon core carries rolled modifiers drawn from the same numeric layer the stacking blessings use, so one catalogue serves both and the two cannot drift apart.
10. Core modifiers and stacking blessings both leave thrown damage alone. Thrown damage is currently defined as melee damage rather than as a value of its own, and separating them collides head-on with a concurrent rewrite of the entire projectile path. Melee damage, maximum health, movement speed, and melee reach are the axes this plan moves.
11. Three side rooms carry a floor's optional business: one pays a blessing for holding ground, one pays a sealed reward for being smashed, and one heals. The two altars are told apart by what they ask of the player rather than by a label — smashing pays the curse, standing pays the blessing.
12. The blessing altar is claimed by standing inside it for five seconds, uninterrupted by damage and cancelled only by leaving it. Cancelling on damage would make the claim impossible at depth, where bodies arrive faster than the channel runs; leaving as the only cancel makes it a fight the player wins by clearing the room rather than by not being hit.
13. Nothing in this plan modifies a module the concurrent enemy-and-sprite plan claims, beyond three single-line touch points: the branch that fires when the blessing catalogue is exhausted, the accessor that reports melee damage, and the observation of a kill and of a broken wall. A footprint wider than that is a defect in this plan rather than a merge to settle later, and it is checkable before delivery rather than discovered at merge.

## Design

### The floor, and why it stays square

Five blocks: one twenty-one-square main region with four seven-square rooms attached, one to each of its four sides. Three of the four carry the optional business; the fourth is the extraction room. The main region holds the descent.

The assembled floor is thirty-five by thirty-five — seven, twenty-one, seven on both axes — and **stays square on purpose**. The floor's dimension is read from four modules, two of which the concurrent plan is rewriting heavily, and every one of those readers is a loop bound or an index that keeps working when one number changes and breaks the moment the floor becomes a rectangle. Square keeps the whole assembly inside the one module that owns floor generation. Rectangular spreads it across three, two of which are unavailable. This is the single most load-bearing decision in the plan and it costs nothing but a slightly emptier map.

Rooms attach edge to edge and connect by opening a hole through the masonry between them, which is what the three side rooms already do and needs no new mechanism for the fourth.

Side rooms are **fixed rather than drawn**. With the old blessing source retired there are exactly three kinds for three slots, so a draw of three from three is not a draw. Recording that plainly is honest; restoring variety needs more kinds of room and is not this plan's business.

### The clock, and what a minute costs

| Source  | Level         |
| ------- | ------------- |
| Time    | +1 per minute |
| Descent | +5 per floor  |

Run-wide, never reset, never lowered.

The two numbers together price a floor at five minutes: five minutes spent on a floor costs the same level as one descent. That exchange rate is what the player is really deciding against every time they take a secondary task, and it is why the clock is worth building and showing before anything reads it. A floor whose full business takes far longer than five minutes is telling the level designer that its secondary tasks are priced above what they pay.

The level is shown and read by nothing. See requirement 6.

### Sealed rewards

| Sealed reward | Source        | Fragment | Core |
| ------------- | ------------- | -------- | ---- |
| Clean         | Main task     | 80%      | 20%  |
| Cursed        | Smashed altar | 40%      | 60%  |

A cursed fragment carries two or more blessing effects where a clean one carries a single effect. A cursed core rolls its modifiers over a range widened in both directions.

Both stay sealed through the whole run and resolve on extraction. Dying with them loses them, which is what makes the extraction room worth finding early.

### The blessing ladder

Two tiers, and no third case at the point of award:

| Tier     | Contents                          | When exhausted        |
| -------- | --------------------------------- | --------------------- |
| Distinct | Authored mechanics, one of each   | Fall to the next tier |
| Stacking | Numeric buffs, repeatable forever | Never exhausted       |

The stacking tier opens with maximum health, melee damage, movement speed, and melee reach. Thrown damage is deliberately absent for the reason in requirement 10 — it is not a separate value yet, so a buff aimed at it would silently be a second melee buff.

Today's behaviour when the catalogue runs dry is a single fixed health bonus, which is the same reward wearing four different labels by the second floor. Replacing it with a tier that has breadth is the whole of the fix, and the way to keep it from going stale is to add kinds to that tier rather than to add cases around it.

### One modifier catalogue, three consumers

The stacking blessings, a clean core's rolls, and a cursed core's rolls all draw from one catalogue of numeric axes. A clean core rolls a range that stays positive; a cursed core rolls the same axes over a range widened at both ends. Cores in this plan roll on melee damage and maximum health only — the other two axes belong to blessings for now, and narrowing the core is a scope decision rather than a design one.

One catalogue is what stops a modifier existing as a blessing and not as a core roll, or carrying different bounds in the two places.

### What the concurrent plan owns

A concurrent plan is rewriting the enemy behaviour tables, the enemy animation and sprite pipeline, the projectile flight path, the drop tables, the sprite manifest loader, the entity workbench, and the offline generator. Its execution notes name twenty-three modules. This plan touches none of them except at the three points named in requirement 13, each of which is a single line:

- the branch that runs when the blessing catalogue is exhausted, which becomes a draw from the stacking tier
- the accessor that reports melee damage, which begins consulting the modifier catalogue
- the points that observe a kill and a broken wall, which begin feeding the task counters

Everything else in this plan lands in modules the concurrent plan never names: floor generation, the blessing catalogue, the heads-up display, the view model, and new modules of this plan's own.

### Two collisions that are not merge conflicts

Both are decisions that whichever plan lands first will fix in place, so they are recorded here rather than discovered later:

1. The concurrent plan gives each skeleton type a chance to drop the weapon it carries, and those four weapons are the same four this plan's cores are named for. Whether a dropped sword is a throwable prop or a core is not settled by either plan.
2. The concurrent plan removes the thrown axe outright, renaming it to a hammer and retiring the name everywhere. One of this plan's four cores is an axe. The two are different things — a core is a melee base chosen before a run, the prop was a throwable — but the name will not survive in both places.

### Child overview

| Child | Focus                                                                                    |
| ----- | ---------------------------------------------------------------------------------------- |
| 05    | The clock: run-wide level from time and depth, derived and shown only                    |
| 06    | The modifier catalogue: numeric axes shared by stacking blessings and core rolls         |
| 07    | Sealed rewards and extraction: clean and cursed, carried sealed, resolved on the way out |

Landing order is 01 through 07. Children 01, 02, 05, and 06 have no prerequisites among the others and can land in any order. Child 03 needs 01 for the blessing it pays and 02 for the rooms to exist. Child 04 needs 02 for a descent to lock and 01 for the blessing its secondaries pay. Child 07 needs 02 for the extraction room, 04 for the main task that pays a clean reward, and 06 for a core to have anything rolled on it.

## Acceptance Criteria

1. A floor cannot be descended until its main task is met, and where the descent is cannot be seen until the same moment.
2. The extraction route is reachable from the first second of a floor, is never shown on any map, and taking it ends the run with everything carried.
3. Three secondary tasks each pay a blessing the moment they are met, and taking the descent pays nothing at all.
4. A blessing award never repeats a single fixed consolation buff: once the authored catalogue is spent, awards keep arriving from a set with visible variety, and the same run can receive the same stacking buff more than once with the effect compounding.
5. Smashing the cursed altar yields something the player cannot identify for the rest of the run, and standing in the blessing altar for five seconds yields a blessing while being hit throughout, but yields nothing if the player steps out at four.
6. A cursed core is observably capable of rolling worse than a clean one as well as better.
7. Sealed rewards resolve only on extraction; dying loses them.
8. The run level rises by one each minute and by five each descent, never falls, survives a descent, and is visible without opening anything.
9. No enemy is stronger, weaker, or different in any way as a result of this plan.
10. A floor is one twenty-one-square main region with four seven-square rooms attached to its four sides, is square overall, and has no cell the player cannot reach.
11. Melee damage and maximum health respond to a core's rolled modifiers; thrown damage is unchanged from melee damage.
12. Every module the concurrent enemy-and-sprite plan names is either untouched by this plan or changed at exactly one of the three declared touch points.
13. Verification passes, and the manual playtest confirms each criterion above.

## Execution

Coordinates recorded against the codebase as it stands when this plan was written. Re-check each one against the live code before executing its child; a stale line here is expected, not a defect. Each subsection is cut when its child ships, in the same change that cuts its row from the child overview.

**Standing constraint for every child.** The concurrent plan at `dev/docs/plans/pantry_demo_skeletons.plan.md` names these and they are off limits: `src/demo/enemy-ai.ts`, `src/demo/enemy-archetypes.ts`, `src/demo/demo-scene.ts`, `src/demo/world.ts`, `src/demo/simulation.ts`, `src/demo/throw-weight.ts`, `src/demo/demo-sprites.ts`, `src/demo/demo-surface.ts`, `src/demo/particles.ts`, `src/demo/actions.ts`, `src/demo/movement.ts`, `src/demo/maze.ts`, `src/presentation/presentation-image-loader.ts`, `src/app/debug/entity-workbench.ts`, everything under `src/content/enemies/`, `src/content/combat/enemies.ts`, `src/content/presentation/prop-display*`, and everything under `dev/tools/`.

Four of those are unavoidable and are held to single-line touches: `world.ts` at the blessing overflow branch, `actions.ts` at the melee damage accessor and inside the wall-damage dispatcher, `simulation.ts` appended at its step tail and at the exit-proximity check, and `maze.ts`, which the concurrent plan only _reads_ — it consults `STONE_WALL_HP` and `WOOD_WALL_HP` (lines 43–44) and edits nothing, so floor generation is free to be rewritten in place. Confirm that read-only status against the live skeleton plan before child 02.

`src/demo/bless.ts`, `src/demo/demo-hud.ts`, `src/demo/demo-viewmodel.ts`, and `src/demo/impacts.ts` are named by the concurrent plan nowhere and are fully available.

Nothing in this plan may add a test under `src/demo/` or `src/presentation/`; the repository guard at `test/unit/repository/demo-half-is-untested.test.ts` enforces it and is not to be edited.

### 07 — Sealed rewards and extraction

New modules for the sealed reward, its contents, and whatever holds them between runs.

Two producers: the main task completing (child 04's state machine) and the cursed altar breaking (child 03's smashable). Both call one function that rolls a table and appends to the carried set, so the two rates live in one place.

The carried set survives descents and is destroyed on death. `descend` at `src/demo/simulation.ts` line 748 rebuilds the floor and explicitly keeps health, hands, and blessings — see the comment at `src/demo/world.ts` line 567 — so the carried set joins that list of survivors and needs no new mechanism.

Extraction is the same proximity shape as the descent, at the extraction cell child 02 added, with no lock. It ends the run and resolves everything carried. There is no run-end path today other than death, so this is new: decide whether it returns to the same start-a-run entry the demo already has, and keep it to that.

Resolution assigns the actual modifier rolls at extraction rather than at pickup, so a save inspected mid-run genuinely does not know. Roll on the catalogue from child 06.

# TODO

The single forward-work tracker for Pantry Depths. It tracks only work that no plan owns: plan children get no lines here, they live in their plan's child overview table, per `dev/foundation/core/workflows/plan_standard.md`. There is deliberately no Done tier — remove a shipped line and record its outcome in `CHANGELOG.md`.

> The actionable tiers (`Plan`, `Chore`, and `Bug`) carry one line per item: no paragraphs, tables, or rationale. An item that needs explanation belongs in `## Draft` under one `###` heading, written as plain text and lists — no `####` headings or bold-label patterns.
>
> Scope tags in actionable lines use short, lowercase `snake_case` identifiers, such as `[cross_floor_locks]`.

Actionable line format: `[scope] one sentence - [ref plans/<name>.md if any]`

This tracker is the forward-work authority.

## Active

- `dev/docs/briefs/synthesised_sfx.brief.md` — the project has no audio at all; this reads a sibling project's engine and says what to keep.

---

## Plan

Forward work that no plan owns, each with a sketch in `dev/docs/plans/`. A line becomes actionable through `/implement`, which rewrites the sketch into a standalone implementation spec; the line stays here until the work ships. If a plan later adopts the work, the sketch moves into that plan as a child and this line is removed in the same change.

A brief lives here too and is the one kind of line `/implement` cannot take: it is format-free material handed to a later session, it authorizes nothing, and it is spent once it has seeded a real artifact. `dev/standards/work_lifecycle.addendum.md` owns its rules.

- `dev/docs/briefs/boss_encounter.brief.md` — the floor's last fight, and why its shape is blocked on a rendering decision the project has not made.

---

## Chore

One line, no rationale, no backing document.

> No open chores.

---

## Bug

One line, no rationale, no backing document.

> No open bugs.

---

## Draft

Not scheduled. Do not start without a decision.

### Three.js, With The Block Skeleton As The Prototype

The direction is chosen: the game moves to a Three.js runtime, and the blocky skeleton is the prototype everything else is built from. That closes the question the block experiment deliberately left open — it kept both the sprite bake and a runtime consumer possible on purpose, and the runtime wins.

What this displaces is most of what draws the game today. The Canvas 2D renderer marches rays for walls, sorts billboards against a depth buffer, paints ground marks at sub-cell resolution, and carries the fog, the torch light, and the viewmodel; a Three.js runtime does each of those differently or not at all. The sprite bake stops being the path an enemy arrives by, and the eight-heading strip stops being the thing that judges one.

What survives is the larger half. The blocky body, its six-bone armature, and its table-driven clips are already a glTF file the browser loads and plays, so the authoring loop needs no port. The simulation, the floor generation, the enemy behaviour, the tasks, and the HUD do not know what draws them and do not change.

Nothing is scheduled. Two things decide the shape before this can become a plan: whether the runtime replaces the whole view or only the bodies standing in it, and whether it lands before or after the demo is ported into the permanent architecture — both touch the same files, and doing them in the wrong order means doing one of them twice.

### The Difficulty Level Nothing Reads

The run carries one difficulty level, on screen at all times, rising by one each minute and by five each descent and never falling. Nothing reads it. That was deliberate and it was temporary: the tables that would carry it into enemy statistics were being rewritten at the same time, and the two changes could not meet safely, so the level was built, derived, and displayed and stopped there. The rewrite has shipped, so the block is gone and this is the first thing that becomes available because of it.

What makes it a decision rather than a queue is what a level is allowed to touch. Scaling health makes every fight longer, which is the one thing a demo about cutting to the stairs cannot afford; scaling damage makes them shorter and more dangerous, which is the same pressure from the other side; scaling how many bodies are alive and how fast they come back changes the floor rather than the enemy. Those are three different games and the clock prices them all identically, so picking one is the work.

There is a second half nobody has answered: whether a level ever shows itself on a body. A player who cannot tell a floor-two skeleton from a floor-seven one is being scaled at without being told, and the number in the corner is not a substitute for seeing it.

Not scheduled. What would force it is a run that stops getting harder after the third floor.

### Thrown Damage Is Still Melee Damage

Thrown damage is not a value of its own — it is defined as melee damage, so every core roll and every stacking blessing that moves one moves the other. The floor loop left it that way because separating them would have collided head-on with the rewrite of the whole projectile path. That rewrite has shipped, and the numbers describing a shot now live on the type that fires it, so the collision is gone.

What makes it a decision is what a thrown weapon should scale with at all. A hammer that spends itself on masonry and a javelin that runs three bodies through are not doing what a sword does, and the modifier catalogue currently has one axis for both. Giving thrown its own axis is easy; deciding whether a build should be able to specialise into throwing — and therefore whether the props stop being consumables — is not.

Not scheduled. What would force it is wanting a run that throws rather than swings.

### Three Kinds Of Side Room For Three Slots

A floor hangs four rooms off its main region: the cursed altar, the blessing altar, the hot spring, and the extraction room. There are exactly as many kinds as there are slots, so nothing is actually drawn — the only thing chosen per floor is which side each room lands on. The floor loop recorded that plainly rather than dressing it up, because with the old blessing source retired a draw of three from three is not a draw.

The cost is that every floor offers the same business in a different order, which is a weaker version of the choice the tasks and the clock were built to create. Fixing it means more kinds of room, and a kind of room is a mechanic rather than a layout — the two that exist are told apart by what they ask of the player, and a third has to earn its place the same way instead of being a fourth thing to walk into.

Not scheduled. What would force it is floors reading as the same floor by the third one.

### Authoring The Rest Of The Display Numbers

Body scale and the wind-up marker's offset are authored content now: they live in `src/content/enemies/entity-display.json`, are validated on load, and are tuned and saved from the entity workbench with a camera-distance slider beside them. That was the half worth doing first, because it was the half being guessed at repeatedly.

The rest of what decides how a body looks is still literals in `src/demo/demo-scene.ts`. A soft body's profile — footprint radius, height and colour together — is the largest piece; the stun stars' orbit and height, the blade arc's own height, and the per-intent marker scale ramp are the smaller ones. Every one of them is a number somebody will eventually want to slide.

What makes this a decision rather than a queue is the soft-body profile. It is three numbers that have to move together and one of them is a colour, so it is not the same shape as the two that moved; and the simulation gives every body one collision radius regardless, so authoring a per-body footprint invites the question of whether collision should read it too. Answer that first, because doing it wrong means the drawn size and the bumped size drift apart in opposite directions.

Not scheduled. What would force it is a second authored body, or wanting bodies that differ in width rather than height.

### Every Clip But Idle And Walk Reads Wrong

Four skeletons ship with seven private clips each and one shared death set, and every pose in them is provisional by agreement. What the two re-bake passes owned was the clip tables, the per-clip dimensions, the weapon-per-type generator and a bake that runs end to end; whether a pose actually reads was always a separate judgement, expected to replace keyframes rather than confirm them.

That judgement has now been made once and stopped at its first finding: standing and walking are right, and every other clip has a problem of its own. The problems themselves are deliberately not written down here, because they have not been stated yet — this exists so the gap is a known one rather than something the next person rediscovers by looking at a wind-up and wondering.

The bar is three things, and all three are answered in the entity workbench, which can already reach every clip at the length the simulation gives it. A body winding up, striking and recovering have to be three states told apart by the body alone. A body that has just attacked has to visibly be recovering rather than idling, at every type's cooldown length — six seconds and 1.8 both. And every clip has to be scrubbable at its own frame count, with a three-second wind-up holding its final pose rather than crawling through four frames.

Not scheduled. What would force it is showing the demo to anybody.

### A Reload The Shooters Can Be Caught In

Both ranged skeletons now have no cooldown at all. What paces them is how long they take to aim, and the shot is followed by nothing — so the only window on one is the wind-up you can see coming, and there is no moment after the shot where it is busy.

The recovery clip both types need for this is already baked and already unused: with the cooldown at zero, nothing ever plays it. Putting a reload back is therefore a matter of giving the two rows a cooldown again and letting the existing clip run over it, not of authoring anything.

What makes it a decision rather than a queue is what the reload is for. A cooldown that only exists to slow the fire rate is the thing that was just removed, because a pause with nothing to look at is not a window. A reload has to be legible enough that a player crosses the room _because_ they saw it start — which means its length, the clip, and the distance the shooter holds are one decision, not three.

Not scheduled. What would force it is the shooters reading as unanswerable at their current range.

### A Real 3D Layer Instead Of Baked Sprite Sheets

The skeleton swordsman is an eight-way authored body: ten clips, eight directions, eight frames, baked offline from Blender into ten 2048-square atlases. That is 48 MB of PNG on disk and roughly 168 MB decoded, for one enemy. The cost is per enemy and it does not amortise — a second authored body is another 50 MB, and every added clip or direction multiplies it. Cutting the atlas cell back down is the only knob the current pipeline has, and it trades directly against the resolution that made the skeleton stop looking pasted onto the room.

The alternative is a GPU 3D layer — Three.js or raw WebGL — where the same body is a rigged mesh of a few hundred kilobytes, viewable from any angle, at any resolution, with no bake step between authoring and seeing it. What makes this a decision rather than an obvious win is the compositing seam: walls, floors, depth, lighting, water and the x-ray markers are all the Canvas 2D raycaster's, and a second renderer has to agree with it about depth per column or the two images cannot be layered. Answering that is the work; the enemy is the easy half.

The boss concept currently on the table — a firing altar as a real 3D model, ringed by an impassable moat — would force this question earlier than the second authored enemy does, because the altar is that second body in everything but gait. The decision also orders other work: renderer-bound visual polish (light falloff, distance fog, contact shading, the first-person arm) done before it is thrown away by a port, while HUD, input feel, and simulation-side feedback survive one. Decide the boss's visual technology first; everything renderer-bound queues behind that answer.

Not scheduled. What forces the question is the boss fight or the second authored enemy, whichever is wanted first.

### Moving The Demo Onto The Tested Half

The demo half — `src/demo/`, `src/presentation/` — is verified only by playing, by standing ruling, and `test/unit/repository/demo-half-is-untested.test.ts` enforces it. The ruling's cost is now felt from the other side: an agent working on the demo cannot verify anything itself, so every change ends in a manual playtest or a browser session someone has to drive, and the demo's internal structure has grown without the pressure a tested boundary applies. Migration would mean moving the logic that never touches a frame — simulation rules, spawn and task state, damage arithmetic — across into the tested half, leaving a thin surface whose value genuinely is how it feels; revisiting the guard's boundary is part of the work, not a side effect, and it is a deliberate revision of the ruling rather than an exception to it.

What makes it a decision rather than a queue is timing. A migration mid-churn freezes behaviour that is still moving: every test written against the blessing and boss work now in flight would break as that work lands, and the mirrored-direction-wheel lesson says a test written against a moving surface records the surface's bugs as specification. The migration waits for the behaviour to stop moving.

Not scheduled. What would force it is the core design's remaining content shipping — or a content pass whose bug rate makes manual verification the bottleneck before then.

### One Enemy, One Record

Changing an enemy's action or a number on it touches five or more files today, spread across archetype rows, AI branches, clip tables, display literals and spawn entries. The mechanical half of the fix is consolidation: one enemy becomes one record — statistics, actions, clip references, display numbers — read from one place, with `src/demo/enemy-archetypes.ts` as the seed the record grows from, and no behaviour change anywhere. The generalize-and-harden half deliberately waits, because an abstraction chosen before the blessing catalogue and the boss land would be guessed against the two consumers most likely to bend it.

What makes it a decision rather than a queue is verification. A behaviour-preserving refactor in a half with no tests is proven by playing, so the mechanical half needs a supervised gate — a branch, then a playtest that confirms every enemy still moves and hits as before, before anything builds on top.

Not scheduled. What would force it is the next content pass after the boss — or the next five-file enemy edit that goes wrong.

### One Tile, One Record

What a tile kind is is scattered the same way an enemy is: whether it can be walked on, seen over, thrown over, struck, stained, drowned in, drawn as a wall face or as a floor material, and whether it cuts ground off each live in their own if-chain, spread across the maze module, the action handlers, the scene builder and the presentation layer. None of those chains is exhaustive — a kind the chain does not name falls through to a default that compiles cleanly and is wrong silently. Adding the trench surfaced the count: around a dozen sites walked by hand, six of whose defaults were wrong, one of which would have let a swing break an unbreakable pit.

The fix is the tile version of the enemy record above: one kind becomes one record of its answers, read by the questions instead of enumerated inside them, with exhaustiveness the compiler can check. It waits for the same reason and behind the same gate — a behaviour-preserving refactor in the untested half is proven by playing, so it queues with the enemy record and the migration entry rather than jumping them.

Not scheduled. What would force it is the next tile kind, or the next silent wrong default found in play.

### What Remains Of The Core Design

The direction document `dev/docs/design/pantry_demo_core.design.md` is frozen with the rest of its directory, but the work it pointed at is nearly done, and the tail is recorded here so it is a list rather than a memory. Three pieces remain: fleshing out the blessing catalogue; the boss fight, whose current concept is a firing altar the player cannot reach directly — ringed by an impassable moat — and breaks by turning pickups earned from the crowd against it; and sound effects. All three are supervised manual work by nature: the boss is a mechanic decision, blessings are content taste, and audio cannot be judged without ears.

This is the next supervised block, not autonomous work, and it lands before the two entries above — the migration and the enemy record — become safe to start.

### Browser Acceptance Coverage For Gameplay

`test/e2e/` is one spec: the debug hub boots and opens a tool. The workbench specs that grew beside it are deleted, and a new test of any kind now needs asking for. Presentation, input feel, VFX, and audio were always manual-playtest boundaries; so are the workbenches. `dev/agent_rules/test_operations.md` owns that line.

### Playtest Questions

Only playing answers these; none of them blocks work, and all of them are product decisions against `src/content/` rather than forward work. Lifted from the milestone plan for the same reason as above.

- Whether the forced route offers the right pressure, room to misjudge, and recovery rhythm. Adjustment is always authored content, never the combat formula.
- Whether the final encounter before the exit lands as an ending without dragging, and whether simply reaching the exit feels like enough of a close. If it does not, the answer is a stronger departure and statistics, not moving the terminal outcome back onto a kill.
- Whether restarting the whole run on death is too punishing. The one sanctioned fallback is returning to the floor's stair with opened doors and collected keys intact at 30% health; still no save.
- Whether a player reads "cannot penetrate" as a rule rather than a bug. If not, a one-time teaching cue.

### Architecture Report Contents

The report at `dev/docs/reports/pantry_depths_architecture.html` is hand-written and still a skeleton. Its requirements were held only by the milestone plan, so they are recorded here: a self-contained page, light and dark themes, anchored sections, ending in an entry point to the source. It must at least answer how one Action travels from key press to screen, why the layer boundaries fall where they do and how they are machine-enforced, which files change to add an enemy, and which change to add a floor.

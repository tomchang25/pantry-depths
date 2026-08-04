# TODO

The single forward-work tracker for Pantry Depths. It tracks only work that no plan owns: plan children get no lines here, they live in their plan's child overview table, per `dev/foundation/core/workflows/plan_standard.md`. There is deliberately no Done tier — remove a shipped line and record its outcome in `CHANGELOG.md`.

> The actionable tiers (`Plan`, `Chore`, and `Bug`) carry one line per item: no paragraphs, tables, or rationale. An item that needs explanation belongs in `## Draft` under one `###` heading, written as plain text and lists — no `####` headings or bold-label patterns.
>
> Scope tags in actionable lines use short, lowercase `snake_case` identifiers, such as `[cross_floor_locks]`.

Actionable line format: `[scope] one sentence - [ref plans/<name>.md if any]`

This tracker is the forward-work authority.

## Active

Nothing currently in progress.

---

## Plan

Forward work that no plan owns, each with a sketch in `dev/docs/plans/`. A line becomes actionable through `/implement`, which rewrites the sketch into a standalone implementation spec; the line stays here until the work ships. If a plan later adopts the work, the sketch moves into that plan as a child and this line is removed in the same change.

A brief lives here too and is the one kind of line `/implement` cannot take: it is format-free material handed to a later session, it authorizes nothing, and it is spent once it has seeded a real artifact. `dev/standards/work_lifecycle.addendum.md` owns its rules.

- `dev/docs/briefs/boss_encounter.brief.md` — the floor's last fight, and why its shape is blocked on a rendering decision the project has not made.
- [humanoid_block_bodies] Draft plan for one rig, one clip set and one part vocabulary across every humanoid, with death clips first - [ref plans/humanoid_block_bodies.plan.md]
- [slime_bodies] Draft plan for what a slime is made of, blocked on choosing between a fluid body and a hopping block one - [ref plans/slime_bodies.plan.md]
- [enemy_behavior_split] Split the enemy AI into a shared chassis and one module per attack family - [ref plans/enemy_behavior_split.plan.md]

---

## Chore

One line, no rationale, no backing document.

- [register_containment] Rewrite the comments of the twenty-two rules-layer modules the register sweep left, which still hold the layer at 24% comment lines
- [scene_3d] Hand a dying body its own armature instead of spawning a shapeless lump, so a dead skeleton is at least that skeleton until real death clips exist

---

## Bug

One line, no rationale, no backing document.

- [three_scene] Bodies carried by a javelin fly at the wrong angle, and the impaled pose that would fix it needs an authored model and clip

---

## Draft

Not scheduled. Do not start without a decision.

### A Room Whose Size Is Its Own

A map declares an extent and a room declares an extent, and neither knows the other's. The main region is centred in the grid, so a room larger than the map it stands in was painted outside that grid: the rows before it went to negative indices and vanished, the rows past it extended the tile array beyond the extent, and the assembled room still recorded the bounds the room had asked for. A body placed from those bounds stands inside masonry, which is how a floor is arrived on stuck. That is now refused when the map is resolved rather than assembled wrong, so the failure is loud and immediate — but refusing is all it does. A room still cannot be made bigger than its map without going and making the map bigger too, and the two numbers are edited on two different surfaces.

The second half is the same shape one level up. Every floor is built with an arrival, a way down, and a plinth, whether or not anything wants them: the plinth falls on the arrival cell when no room on the floor holds one, the stairway is dropped into whatever open ground is left, and the floor's contract is four hardcoded objectives — twenty bodies, twelve walls, four side rooms, one pool — identical on every map ever authored. A floor cannot say it is not a dungeon. The filming stage works around all of it by moving the way down and the plinth onto a boundary cell where neither can be seen or reached, and by opening with the instrument layer hidden so the four unmeetable objectives are off screen. That is a workaround wearing the shape of a feature, and it is worth naming as one.

What makes this a decision rather than a queue is how far the contract should bend. A room that sizes its own map is one answer; a map that declares which of the three fixtures it wants is another; a floor that carries no contract at all is a third, and it is the one the stage actually wants. All three change what a map file means, and doing them piecemeal means changing that meaning three times.

Not scheduled. What would force it is a second stage, or the first authored floor that genuinely has no stairs.

### A Boss Lab As A Scene Catalog Entry

The scene routes have shipped: a scene is one catalog entry owning an address, a floor, and a bundle of hooks the play surface calls, and the development console lists every scene address it knows. The expected second consumer of that catalog is a boss lab: the real game opened on a boss-test floor, with the boss's FSM or decision tree read out on the instrument layer and its transitions forced from commands and keys. On the catalog that is one entry plus one hooks bundle — state as panel chips, control as commands — and no play-surface branch, which is exactly what the routing claimed and this scene would prove.

Three boundaries were decided in the conversation that produced this entry, recorded so the lab does not drift while waiting:

- An instrument wanted on any floor is not a scene. A pathfinding display belongs on the dev overlay beside torch and god mode, available wherever play runs; a scene owns only what is tied to its session.
- The scene hooks deliberately carry no render hook. FSM target lines or path traces drawn into the 3D picture are a renderer debug-layer question, one level deeper than routing; a render hook is added when the first tool that actually draws exists, not before.
- The plain testbed stays plain. It is the control group a dressed scene is compared against, and a scene never keys off a map name — identity lives on the address.

The boss itself is blocked on the rendering decision recorded in `dev/docs/briefs/boss_encounter.brief.md`, and the lab has no subject until the boss has a mind to display.

Not scheduled. What would force it is boss implementation starting — tuning an FSM blind is the first thing that would hurt.

### The Difficulty Level Nothing Reads

The run carries one difficulty level, on screen at all times, rising by one each minute and by five each descent and never falling. Nothing reads it. That was deliberate and it was temporary: the tables that would carry it into enemy statistics were being rewritten at the same time, and the two changes could not meet safely, so the level was built, derived, and displayed and stopped there. The rewrite has shipped, so the block is gone and this is the first thing that becomes available because of it.

What makes it a decision rather than a queue is what a level is allowed to touch. Scaling health makes every fight longer, which is the one thing a demo about cutting to the stairs cannot afford; scaling damage makes them shorter and more dangerous, which is the same pressure from the other side; scaling how many bodies are alive and how fast they come back changes the floor rather than the enemy. Those are three different games and the clock prices them all identically, so picking one is the work.

There is a second half nobody has answered: whether a level ever shows itself on a body. A player who cannot tell a floor-two skeleton from a floor-seven one is being scaled at without being told, and the number in the corner is not a substitute for seeing it.

Not scheduled. What would force it is a run that stops getting harder after the third floor.

### Thrown Damage Is Still Melee Damage

Thrown damage is not a value of its own — it is defined as melee damage, so every core roll and every stacking blessing that moves one moves the other. The floor loop left it that way because separating them would have collided head-on with the rewrite of the whole projectile path. That rewrite has shipped, and the numbers describing a shot now live on the type that fires it, so the collision is gone.

What makes it a decision is what a thrown weapon should scale with at all. A hammer that spends itself on masonry and a javelin that runs three bodies through are not doing what a sword does, and the modifier catalogue currently has one axis for both. Giving thrown its own axis is easy; deciding whether a build should be able to specialise into throwing — and therefore whether the props stop being consumables — is not.

Not scheduled. What would force it is wanting a run that throws rather than swings.

### Structures Are Renderer Code

Seven fittings stand on a floor — the cursed altar, the blessing dais, the hot spring, the extraction beacon, the stairs, the barricade iron and the emplacement — and every one of them is a function in the renderer that returns a list of boxes, beside a handful of hardcoded colours. Changing what an altar looks like means editing the thing that draws altars.

Half of the question they used to belong to is closed. The body plan they were once filed under asked whether each should become an authored model, and the three-scene verdict answered it in the negative: all seven shipped as procedural assemblies, all seven passed the judgement, and the default is to leave them that way until one is judged wanting. That is a decision not to model them, and it stands.

What it does not answer is the other half — that a structure should be changeable without editing a renderer. A record per fitting would be the obvious shape, and the obvious objection is just as strong: seven structures that change once a year may not be worth an authoring surface, and a schema nobody edits is a second place for the truth to live. Nothing forces the choice today.

They also have no judging surface. The entity workbench shows bodies and the prop workbench shows pickups; a fitting is only ever seen by walking up to one in the floor preview or in play, which is enough while they are code and would not be if they became content.

Not scheduled. What would force it is an eighth fitting, or the first time somebody wants to tune an altar's silhouette without opening a renderer.

### What A Fight Writes On The Floor

Blood reaches the floor through exactly two of the paths that hurt a body — the player's swing and the spikes. A thrown rock, a hammer, a bomb's blast, a chain of lightning: every one of them runs through the one damage funnel in `src/core/world/world.ts`, and the funnel raises nothing — the spray is hung on individual call sites, and nearly all of them never hung one. So a body hurt at range shows its flash and no blood, and pays the whole debt only on the kill. The kill path already learned this lesson: its bones, its dust and its sound are raised centrally so that no route out of the world can be the one that forgot, and the hurt path wants the same shape — spray raised beside the damage, scaled by it, with the call sites out of the decision.

What sprays is the second half, and today it is a hardcoded material test: the boned check decides bone and dust against red. The right owner is per-body authored content — what a body sprays when hurt, and what it leaves on the ground when it dies — in the direction the entity display table and the one-enemy-one-record entry already point, so that a third answer is a row rather than a new branch.

The boned half of the roster also writes nothing durable at all: once the corpses settle, a corner where twenty skeletons came apart is indistinguishable from one nobody fought in. That is the second stain kind — bone ash, pale where blood is dark, accumulating in its own material exactly as blood does — and with it the stain grid records what soaked a cell as well as how much.

And stains part ways with the floor decals for good. The two share nothing but the ground: a decal is a transient warning, rebuilt every frame inside a small capped slot budget that a mortar's circle must never be crowded out of; a stain is the floor's permanent record, accumulating for the life of the floor. The sub-cell half of that record — a mark where each spray actually lands, from hits as well as deaths, laid over the per-cell depth the ground already carries — therefore belongs to the stain channel, never the warning one. It also needs a fact the rules currently throw away: landing positions die in the same tick that computes them, so the rules would keep the recent ones.

All of it is rules work that changes the shipped picture as well as the experiment's. It was held back so the renderer verdict would not be given against a frame with two moving causes; that verdict has landed, so what holds it now is only that the graduation is in flight and wants the same clean ground. What would force it: the graduation plan's fidelity tail, or the enemy record landing on the same branch.

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

### One Enemy, One Record

Changing an enemy's action or a number on it touches five or more files today, spread across archetype rows, AI branches, clip tables, display literals and spawn entries. The mechanical half of the fix is consolidation: one enemy becomes one record — statistics, actions, clip references, display numbers — read from one place, with `src/content/enemies/enemy-archetypes.ts` as the seed the record grows from, and no behaviour change anywhere. The generalize-and-harden half deliberately waits, because an abstraction chosen before the blessing catalogue and the boss land would be guessed against the two consumers most likely to bend it.

What makes it a decision rather than a queue is verification. A behaviour-preserving refactor over the enemies' feel is proven by playing, so the mechanical half needs a supervised gate — a branch, then a playtest that confirms every enemy still moves and hits as before, before anything builds on top.

Not scheduled. What would force it is the next content pass after the boss — or the next five-file enemy edit that goes wrong.

### One Tile, One Record

What a tile kind is is scattered the same way an enemy is: whether it can be walked on, seen over, thrown over, struck, stained, drowned in, drawn as a wall face or as a floor material, and whether it cuts ground off each live in their own if-chain, spread across the maze module, the action handlers, the scene builder and the presentation layer. None of those chains is exhaustive — a kind the chain does not name falls through to a default that compiles cleanly and is wrong silently. Adding the trench surfaced the count: around a dozen sites walked by hand, six of whose defaults were wrong, one of which would have let a swing break an unbreakable pit.

The fix is the tile version of the enemy record above: one kind becomes one record of its answers, read by the questions instead of enumerated inside them, with exhaustiveness the compiler can check. It waits for the same reason and behind the same gate — a behaviour-preserving refactor is proven by playing, so it queues with the enemy record behind a supervised playtest rather than jumping the line.

Not scheduled. What would force it is the next tile kind, or the next silent wrong default found in play.

### What Remains Of The Core Design

The direction document `dev/docs/design/pantry_demo_core.design.md` is frozen with the rest of its directory, but the work it pointed at is nearly done, and the tail is recorded here so it is a list rather than a memory. Three pieces remain: fleshing out the blessing catalogue; the boss fight, whose current concept is a firing altar the player cannot reach directly — ringed by an impassable moat — and breaks by turning pickups earned from the crowd against it; and sound effects, which are done: the engine, the trimmed coverage, the real samples, and the review workbench have all shipped, and what is left of them is the listening recorded below. All three are supervised manual work by nature: the boss is a mechanic decision, blessings are content taste, and audio cannot be judged without ears.

This is the next supervised block, not autonomous work. The demo migration was scheduled ahead of it by decision on 2026-08-03 and has since landed (archived at `dev/docs/archived/demo_migration.plan.md`); the enemy record entry above still waits behind this block.

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

### Sounds Worth A Better Take

Six of the twenty-one cues were chosen by tags rather than by ear, and the review record carries them as `trial` rather than `shipped`: the two wall breaks, the interface voice, the throw release, and the two thrown-weapon landings. The wall breaks are generic crash takes from the bangs pack — the first candidates auditioned from it, not the best of it. The shared explosive take behind the detonation and the shell landing still runs a long tail, and that same pack remains the likeliest source of a short report. The interface voice is the old card chime serving every moment now, which may wear thin.

Not scheduled, and not really tracker work any more: the verdicts belong in `src/content/sfx/sfx-review.json`, judged on the SFX workbench and exported to the library with `npm run sfx:export`. `dev/skills/sfx_sourcing.md` owns the loop. This entry stays only so the six unheard takes are a list rather than a memory.

### What A Pickup Is Made Of

Every carryable object is drawn at runtime: canvas paths executed once per consumer at startup, producing a square picture that is then shown as a billboard on the floor, composited into the hand, and turned over in the air. It works and it is what the shipped renderer did, but nothing about it is authored — the objects are code, so their look is edited by editing drawing commands, and a picture nobody can open in a paint program is a picture nobody will improve.

Two answers, and choosing between them is the decision. Bake the same pictures into image assets, which keeps everything else about how a pickup is drawn and moves the artwork into files somebody can author and iterate on. Or give a pickup a model and stop drawing it flat at all, which is the direction the bodies and the fittings already went and would end the billboard's remaining tells: a flat object lit as a card, an object that turns in one plane because a billboard has no other axis, and a hand that composites a square rather than holding a thing.

The second is the larger change and it does not stop at the floor. The object in the hand is drawn into a 2D canvas over the scene, so a modelled pickup either brings that surface into the 3D scene or leaves the hand on a different pipeline from everything else. The weapon models the skeletons carry are evidence for the direction and not a shortcut to it — they are rigged to an armature and serve an enemy's hand, not a pickup standing on stone.

Not scheduled. What would force it is the first pickup somebody wants to redraw.

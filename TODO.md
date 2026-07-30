# TODO

The single forward-work tracker for Pantry Depths. It tracks only work that no plan owns: plan children get no lines here, they live in their plan's child overview table, per `dev/foundation/core/workflows/plan_standard.md`. There is deliberately no Done tier — remove a shipped line and record its outcome in `CHANGELOG.md`.

> The actionable tiers (`Plan`, `Chore`, and `Bug`) carry one line per item: no paragraphs, tables, or rationale. An item that needs explanation belongs in `## Draft` under one `###` heading, written as plain text and lists — no `####` headings or bold-label patterns.
>
> Scope tags in actionable lines use short, lowercase `snake_case` identifiers, such as `[cross_floor_locks]`.

Actionable line format: `[scope] one sentence - [ref plans/<name>.md if any]`

This tracker is the forward-work authority.

## Active

[editor] `dev/docs/plans/pantry_demo_workbench.plan.md`
[telegraphs] `dev/docs/plans/pantry_demo_telegraphs.plan.md`
[floor_loop] `dev/docs/plans/pantry_demo_floor_loop.plan.md`

---

## Plan

Forward work that no plan owns, each with a sketch in `dev/docs/plans/`. A line becomes actionable through `/implement`, which rewrites the sketch into a standalone implementation spec; the line stays here until the work ships. If a plan later adopts the work, the sketch moves into that plan as a child and this line is removed in the same change.

> Nothing currently planned. The sketches this tier used to carry were deleted with the old direction.

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

Not scheduled. What forces the question is the second authored enemy, not this one.

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

# Three-Scene: The Full-View Reproduction Spike

Goal-Executable: yes

## Goal

Prove, in one disposable sandbox experiment, that a Three.js runtime can reproduce the whole game view — the low-poly textured look and the night atmosphere the current ray-marched renderer draws — with block models standing in for enemies and structures. The interim projection layer is the last piece of the demo still outside the formal layers, held there precisely because this question is unanswered; a yes ends that holding pattern, a no ends the experiment with one folder deletion.

## Requirements

1. The experiment renders a real authored floor from the game's own content and rules — not a mock stage — because atmosphere judged against a synthetic room proves nothing about the game.
2. The whole view is replaced, not composited: walls, floor, sky, lighting, bodies, effects, and the first-person layer all come from the new runtime in the same frame. A bodies-only compositing answer is exactly what this spike exists to avoid needing.
3. Enemies and structures are drawn as low-poly block models with table-driven animation clips, continuing the direction the block-skeleton experiment already validated for a single body.
4. Every visual element of the current view gets an explicit verdict — reproduced, reinterpreted acceptably, or rejected — recorded against the checklist in the Design section, so the outcome is a judged list rather than an impression.
5. The experiment is judged by a person opening it and looking. No new tests of any kind; the delivery gate is the ordinary verification command.
6. The game itself does not change: nothing outside the experiment folder is touched except the one debug-hub catalog entry that mounts it.

## Design

### The atmosphere checklist

Each row is judged at game distance, in motion, by the user. "Reproduce" means the Three.js result must read as the same thing; "reinterpret" means the technique is expected to differ and the look is judged on its own merits.

| Element of the current view                                                                                                                                                                                 | Expected treatment                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wall faces: procedurally textured ashlar, brick, iron bars, doors, with one material per damage step so breaking is a visible sequence                                                                      | Reproduce: textured low-poly meshes sampling the same procedural texture generators                                                                                                                                                                                                                                      |
| Floor: one tiling texture with named patch cells (water, fouled and choked water)                                                                                                                           | Reproduce: textured plane with per-cell patch materials                                                                                                                                                                                                                                                                  |
| Open night sky: horizon-to-zenith gradient, stars, moon, boundary walls standing above interior ones                                                                                                        | Reinterpret: background gradient or skybox; stars may move into the world                                                                                                                                                                                                                                                |
| Distance fog and torch-light falloff around the player                                                                                                                                                      | Reproduce, corrected 2026-08-03: the shipped renderer's own fog and torch formulas, not a physical lighting model                                                                                                                                                                                                        |
| Ground marks at sub-cell resolution: blood, scorch, push pads, aim and blast circles                                                                                                                        | Reproduce: marks tested against the floor's own position, never quads laid on it. **Twice corrected 2026-08-03**: the porting survey found every warning mark missing, which is child 5's; judging that child found the blood present but drawn as a sheet over the ground rather than mixed into it, which is child 7's |
| Marks a body leaves on masonry: the splatter where a throw drove one into a wall                                                                                                                            | Reproduce, added 2026-08-03 by the porting survey: a mark belonging to the wall face rather than a billboard standing near it                                                                                                                                                                                            |
| Dust, embers, splashes, bone chips, plumes, projectile bead trails, wind-up markers                                                                                                                         | Reproduce, added 2026-08-03: soft billboards at the shipped sizes — their absence was most of the first session's verdict                                                                                                                                                                                                |
| The small readability marks: the spark at the point of contact, the shadow under a lobbed object, the glow under a pickup, bodies riding a javelin, and the light a committed body throws while it winds up | Reproduce, added 2026-08-03 by the porting survey: each is a cue a player reads without noticing, and each was missed by the earlier rows                                                                                                                                                                                |
| Boned enemies: currently sprite strips and an authored eight-way bake                                                                                                                                       | Replace: block models playing the existing table-driven clips                                                                                                                                                                                                                                                            |
| Soft bodies (slimes): currently screen-space blobs with squash, shatter, and drowning stages                                                                                                                | **Rejected 2026-08-03**: the programmatic blob does not survive the move; slimes need authored models, owned by the modelling plan                                                                                                                                                                                       |
| Structures: the two altars, hot spring, extraction beacon, stairs, plinth, barricade iron, mortar                                                                                                           | Replace: block models, procedural or authored, judged the same way as enemies                                                                                                                                                                                                                                            |
| Pickups lying on the floor                                                                                                                                                                                  | **Stays 2D, ruled 2026-08-03**: billboard sprites drawn from the same artwork, never block models                                                                                                                                                                                                                        |
| Projectiles and beams: rods and javelins in flight, tumbling props, lightning arcs, sparks                                                                                                                  | Reproduce: mesh rods and particle sprites. **Half-built, found 2026-08-03 by the porting survey**: the rods and the tumbling props shipped; the arcs are child 5's                                                                                                                                                       |
| Detonations: the fireball, the ring of embers thrown out along the ground, and the light each one casts                                                                                                     | Reproduce, added 2026-08-03 by the porting survey: the row the checklist never had, and the reason a bomb currently shakes the camera and shows nothing                                                                                                                                                                  |
| The exit marker drawn through walls once the descent is unlocked                                                                                                                                            | Reinterpret: a render pass that ignores depth                                                                                                                                                                                                                                                                            |
| First-person viewmodel: arms, held weapon, swing feedback                                                                                                                                                   | **Stays 2D, ruled 2026-08-03**: the authored arm drawn over the frame; the mesh arm is cut                                                                                                                                                                                                                               |
| Camera feel: blast kick and weight kick                                                                                                                                                                     | Reproduce                                                                                                                                                                                                                                                                                                                |
| The finishing pass over the whole frame: drifting air motes in parallax layers, a vignette with a warm centre that breathes and closes on a fast turn, and the red the screen answers a hit with            | Reproduce, added 2026-08-03 by the porting survey: never enumerated, and it is the difference between a rendering and a scene — child 6's                                                                                                                                                                                |
| HUD: plain DOM composited over the canvas                                                                                                                                                                   | Unchanged; the spike only proves the stacking still works                                                                                                                                                                                                                                                                |

Audio is untouched and out of scope; it does not know what draws the game.

### The first judging session

The author judged the built experiment on 2026-08-03 against a reference recording of the shipped renderer. The verdict: image quality up, performance up, atmosphere down, overall worse — not acceptable as built, and not yet a no. Four findings, each now folded into the checklist above: the picture is too dark because the lighting model is wrong in kind rather than in degree; the dust and smoke that carry the fights' atmosphere are missing because their channels were never ported; the programmatic slime is rejected outright; and the viewmodel and pickups must stay 2D — their earlier "reinterpret" rows were the plan's error.

Child 4 is the answer to that session: reproduce the shipped renderer's own light and effects rather than approximating them with a physical model. The final whole-view verdict waits until it ships and is judged the same way — frame-by-frame against the reference recording.

If child 4 still fails that judgement, the recorded fallback is the **live-sprite hybrid**: the raycaster keeps drawing everything, and Three.js becomes an offscreen sprite generator — each boned body rendered per frame at cell size from its viewing angle and fed through the existing billboard channel, so depth, fog, tinting and pixel grain stay the raycaster's for free. That path supersedes this plan's fourth Non-Goal, which forbade a _compositing_ hybrid; feeding sprites composites nothing.

### The porting survey

Before the second judging session was booked, the whole of the shipped view was walked against the whole of the experiment, channel by channel, to answer a different question: what would have to be true before the experiment could become the game. That survey found the two rows above still unbuilt and four the checklist never had, and the reason they were missed is the same in every case — the first session judged a still, well-lit floor, and every one of them only appears while a fight is happening.

Two of them are load-bearing enough that judging without them would repeat the first session's mistake in the opposite direction. A detonation currently shakes the camera and draws nothing at all, so a bomb — the loudest thing a player can do — reads as a bug. And every warning a floor gives is drawn in the air rather than on the ground, so the marks a player is supposed to step out of are not where their feet are. Giving a verdict against a build missing both would be giving it against a version of the game nobody plays.

The survey also recorded what is merely reduced rather than absent — the corpse animations collapsed to one settling lump, the structures' weathering and debris, the room lights that no longer grow while a hold runs, the swing arc that no longer chases what it hit, the waterline cut on a drowning body. None of those becomes a child here: each is a fidelity gap in something that is present and judgeable, so they carry their own verdicts in the sitting and are the graduation plan's to close.

### Children

Three children shipped on 2026-08-03 — the static floor, the live world, and the close layer — and their rows are cut. The first judging session then found the result unacceptable as built and ordered a fourth child rather than a verdict; that child shipped too, and its row is cut with them.

The porting survey then found six checklist rows unbuilt, so the verdict waits on further children rather than on the fourth. Judging the fifth then found the blood on the ground-marks row was not merely present but wrong, which is the seventh.

| #   | Child              | Focus                                                                                                                    | Form                                                                 |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 5   | What a fight draws | Detonations and arcs, the warning marks on the ground, the mark on masonry, and the small readability cues around a body | Shipped — `three_scene_05_what_a_fight_draws.implementation_spec.md` |
| 6   | The finishing pass | Air motes, the vignette and its warm centre, and the red answer to a hit                                                 | Shipped — `three_scene_06_finishing_pass.implementation_spec.md`     |
| 7   | Blood is ground    | The stain moves out of a sheet laid over the floor and into the floor's own texel                                        | Shipped — `three_scene_07_blood_is_ground.implementation_spec.md`    |

Landing order was 5, then 6, then 7. The order between the first two mattered only in that 6 is a pass laid over whatever 5 leaves behind — judging the grade against a frame with no explosions in it would have tuned it against the wrong picture. The seventh could have come at any point; it was last because judging the fifth is what found it.

All seven have shipped.

### The verdict

**Viable, given on 2026-08-03 by the author with the experiment open.** The Three.js runtime reproduces the whole game view well enough to become the game, and the follow-up is the graduation plan rather than a folder deletion.

Three findings came out of the closing sittings, and none of them moved the verdict:

The blood was wrong in three ways that turned out to be one way — it was drawn as a sheet laid over the floor instead of mixed into it, so it covered the warning marks, took the light twice and read brown, and had no gradation. Fixed in child 7 by putting it back in the texel where the shipped renderer keeps it.

A body carried on a javelin flies at the wrong angle, because this block set has no impaled clip and the body is tipped along the shaft instead of posed. Recorded as a bug against the model roster rather than patched with a second guessed transform.

And the fight itself raises less blood than the picture implied: only the player's swing and the spikes make a body bleed at all, so a thrown rock, a blast or a chain of lightning marks nothing. That is a rules gap older than this experiment and it is neither the experiment's to fix nor a mark against the runtime — it is recorded in the tracker's draft tier with the stain redesign it belongs to.

What the sittings did **not** produce is a row-by-row reading of the checklist above. The two judging sessions and the closing pass covered it in aggregate — the whole view, in motion, against a reference recording — and the author accepted the aggregate. The plan asked for one verdict per row; it got one verdict for the view and three named defects, and that is what closed it.

### What building it turned up

Two findings from the build survive the first judging session as open facts rather than as fixed problems.

Physical lighting was the wrong frame entirely. The first build gave the torch a real point light and rolled the result off with a tone curve; the session judged the whole picture too dark and too cold. The shipped renderer has no physical model to approximate — it has three short analytic formulas (walls, planes, bodies), and child 4 replaces the physical stack with those formulas verbatim. This retires the earlier note here about tone mapping being load-bearing: it ships out with the model it patched.

Bodies are expensive. Each skeleton arrives as its own cloned armature of a dozen meshes, so a full crowd costs a couple of hundred draw calls where the floor itself costs six. The session found performance up regardless, so this stays a note rather than a problem — instancing and merging both apply if it ever becomes one.

### What the verdict decides

A full yes makes the follow-up a formal-track plan: graduate the approach into the presentation layer, swap the one seam the runtime draws through, migrate the debug workbenches that inspect the interim projection, and delete the demo tree — none of which this plan performs. The yes landed, so `three_scene_graduation.plan.md` is authorized and is where all of that happens. Two things this plan was holding are released with it: renderer-bound visual polish elsewhere, frozen since this question was opened, and the boss encounter's rendering question, which was parked on this outcome.

## Non-Goals

1. No graduation, no replacement of the interim projection layer, and no changes to the presentation, runtime, or interface layers — this plan only answers whether the replacement is worth planning.
2. No new authored model content: the existing blocky skeleton and procedurally built block geometry are enough to judge with. Authoring the real roster — including the slime the first session rejected — is the follow-up modelling plan's subject.
3. No performance work beyond staying smoothly playable on the development machine.
4. No compositing fallback: if the whole view cannot be reproduced, the answer is no, not an overlay of two renderers. Amended 2026-08-03: the live-sprite path recorded under the first judging session is not a compositing fallback — it feeds images into the existing billboard channel — and is the sanctioned next move after a failed final verdict.

## Acceptance Criteria

1. The experiment opens from the debug hub, loads a real authored floor, and can be walked through at a playable frame rate.
2. Every checklist row carries a verdict given by the user looking at the running experiment; none is left implicit.
3. The final whole-view verdict — viable or not — is stated by the user in one sitting with the experiment open.
4. The ordinary verification gate passes, and the production module graph is provably unchanged.

# The Fourteen Sword Guards

## Goal

Give the standalone Three.js preview a pose language that can express the fourteen essential long-sword guards as fourteen distinguishable, reachable, grounded poses, an instrument that measures whether they are, and a way to look at one of them at a time. Before this, three guards existed, authored in two incompatible ways: one was geometrically impossible and silently clamped, two had their feet in the air, one was falling over, two pointed the blade at nearly the same angle, and one pointed it sideways because it had been matched to the camera rather than to the body — none of which is visible from looking at the picture.

## Requirements

1. A guard is defined by where the sword is, not by which bones rotate. The authored record for one guard is the hilt's position relative to the body, the direction the blade points, the roll of its edge, a named stance, and a small torso attitude — everything below that is solved. Fourteen guards authored as bone rotations is three thousand lines nobody can read or compare; fourteen guards authored as sword coordinates is one table.
2. Every guard is solved by the same code path with no per-guard exceptions. The present split — one guard resolving its legs through inverse kinematics and two guards filling in leg rotations by hand — is why only one of the three stands on the ground, and a set of fourteen cannot survive that kind of fork.
3. Blade roll is a first-class authored value. Several of the fourteen share a hilt position and a blade direction and are told apart only by which way the edge faces; the present orientation code picks the shortest rotation arc, which leaves the roll as an unspecified side effect.
4. The solver reports when it cannot honour a request instead of silently approximating it. An arm asked to reach further than it can currently returns a straight arm and no signal, which is indistinguishable from a pose that was authored badly.
5. Measurement is an instrument the workbench carries, not a number somebody eyeballs. Every guard reports its reach, its grip, its hilt and tip coordinates, its edge angle, its foot clearance and its balance, and the set reports which two guards are most alike — with fourteen poses the failure that matters is not one looking wrong, it is four looking the same.
6. Body proportions are measured, not assumed. Distances are authored and reported in units of the body's own arm and leg length so that the reference drawings — made from a human — map onto a skeleton whose arms are proportionally shorter, and so that changing the skeleton later moves the numbers rather than invalidating them.

## Design

### What a guard is

A guard is four things and everything else is a consequence:

| Field  | Meaning                                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Hilt   | Where the hands meet the sword, given as up / forward / sideways offsets from the midpoint between the shoulders, in arm-lengths |
| Blade  | Which way the blade points, given as a pitch above horizontal and a yaw off forward, in degrees                                  |
| Edge   | Which way the true edge faces, as a roll about the blade axis, in degrees                                                        |
| Stance | The name of a shared foot placement                                                                                              |

Plus a torso attitude of at most five degrees values — shoulder turn, forward lean, side tilt, head turn, head pitch — each of which is distributed across the spine chain rather than authored per bone, because a turn that lives entirely in the chest reads as a broken neck and a turn spread over hips, spine and chest reads as a person.

The hilt is anchored to the shoulders rather than to the floor because that is how the reference drawings are made: a high guard is high relative to the head, not relative to the ground. Anchoring it to the shoulders means it follows the torso attitude and the stance's hip drop for free, which is exactly what happened by accident to the one guard that currently works — its stance lowers the hips, which brings the shoulders down toward a low hilt and is the only reason its arms are within reach.

Solving order is fixed and one-directional: reset, torso attitude, hip height, update, legs to the stance, update, resolve the sword's world placement from the now-posed chest, derive both hand targets from the sword, solve both arms, orient both hands to the sword. Nothing later re-reads anything earlier, so there is no circularity between the torso turning and the hilt following it.

### The sword drives the hands

The present arrangement holds a sword in a hand and then decides where the blade points; the left hand is placed using the blade direction the record declares rather than the direction the sword actually took. The two agree today only because nothing has changed one without the other, and half of the fourteen change the grip.

Inverted: the sword's placement is the guard. Both hand targets are derived from it — the leading hand at the hilt, the supporting hand a fixed grip-span further down the blade axis — and both hands are then oriented to the sword's own frame. The grip span is one constant, so the distance between the hands becomes a measurable invariant: if it ever differs from that constant, the pose is stretching the sword between the hands and the measurement says so.

### Elbows and knees are derived, not authored

The present record carries hand-authored pole vectors for the one guard that has them. For fourteen that is fourteen more numbers to guess. Instead the elbow pole is derived — down and outward from the shoulder by fixed fractions of arm length — and the knee pole is derived forward and down from the hip. A per-guard override remains available for a guard where the derived answer reads wrong, but it starts empty, so an override that appears is a signal rather than a default.

### Feet cannot float

A stance names each foot's sideways and forward offset from the hip centre in leg-lengths, and a hip height. It does not name a foot height: every foot is placed on the ground plane by construction. The current class of bug — a guard whose feet sit an eighth of a body above the floor because nobody solved its legs — becomes unrepresentable rather than merely fixed.

Stances are shared. The fourteen drawings use a handful of foot placements between them, so the table is a few named entries that guards refer to by name, not fourteen private copies.

### The instrument

Each guard reports:

| Number         | What it decides                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reach, per arm | Distance from shoulder to hand as a fraction of arm length. At or above 1 the pose is impossible and the solver is approximating; near 1 the arm is locked straight and reads stiff. |
| Grip span      | Distance between the hands. Constant across all fourteen or the sword is being stretched.                                                                                            |
| Hilt           | Up, forward and sideways from the shoulder midpoint, in arm lengths — what actually separates a high guard from a middle one, stated as a number.                                    |
| Tip            | Height above the ground in leg lengths, plus pitch and yaw. This is what a viewer reads from across a room.                                                                          |
| Edge           | The roll angle, which is currently undefined and therefore unstated.                                                                                                                 |
| Foot clearance | The largest distance any foot sits off the ground. Non-zero is a bug.                                                                                                                |
| Balance        | Horizontal distance from the centre of mass to the support the feet provide, in leg lengths. Positive means falling over.                                                            |

And the set reports a register: the pairwise distance between every two guards over hilt position, blade angles and edge, with the closest pairs named. Two guards that measure alike will read alike, and with fourteen poses that is the failure most likely to happen and least likely to be noticed.

Reported distances are in body units, not fake centimetres. The skeleton's units are arbitrary — its arm measures under a third of its shoulder height, against roughly thirty-six hundredths for a human — so a length quoted absolutely means nothing and a length quoted in arm-lengths transfers to and from the reference drawings.

### One guard at a time, not fourteen at once

The first attempt laid all fourteen out in the plate's own grid so the two images could be held side by side. That was wrong and is recorded here rather than quietly dropped, because the reasoning generalises: a printed plate is line art, so its figures occlude nothing and fourteen of them read at a glance; a rendered grid of solid bodies puts three of its four rows behind the first, at a distance where an arm cannot be told from a rib. Comparing all fourteen turned out to cost the ability to judge any one of them.

So the scene shows one guard, close, with the rest selectable. The register still measures the whole set on every rebuild, because collision between two guards is a property of the set and a guard tuned alone can drift into one nobody is looking at.

Two things follow from the same cause and are worth stating separately. The body is presented three-quarter rather than in true profile: viewed exactly from the side, both hands meet on the centre line behind an opaque ribcage, and three guards rendered looking armless while every measurement correctly reported the arms in place. And the framing is close, because the arm bones are thinner than the leg bones and share the ribcage's colour — at full-body distance a correctly solved arm and a rib are the same object.

### What measurement decided, and what it later reversed

Running the instrument against the three original guards settled a question that was about to be answered by assumption. Arithmetic over the skeleton's rest proportions said two of the three were out of reach; the real posed rig said only one was, because the arithmetic ignored that a stance lowers the hips and carries the shoulders down with them. On that evidence, changing the skeleton's proportions was rejected.

**That decision has since been contradicted by better evidence and is now open.** With the guards authored to the plate rather than to the old poses, the geometry states a limit plainly: the shoulder sits half an arm-length off the centre line, so a two-handed grip spends half the arm simply reaching the middle. Hands on the centre line one arm-length above the shoulders — which is what the plate's High guard draws, crossguard clear of the head — need about one and a tenth of an arm and cannot be reached at all. The guard is therefore authored with the hands at forehead height, which is not what the plate shows.

The rig's arm is under a third of its shoulder height against roughly thirty-six hundredths for a human, and its shoulders are wide for that arm. Either changing the arm length or narrowing the shoulders would resolve it, and narrowing the shoulders is the smaller change because it attacks the cost directly rather than scaling the whole limb. Which of the two, or neither, is not decided here.

## Non-Goals

1. No animation, interpolation or transition between guards. The fourteen are a static study; a pose language that can express them is what makes transitions possible later, and building both at once means neither is checkable.
2. No change to the skeleton's bone hierarchy. Its proportions are a separate open question stated in the design above, and the geometry is shared with the destruction showcases, so changing it is its own decision rather than a step inside this one.
3. No sprite baking, offline rendering or atlas output. That decision is downstream of whether the poses read at all.
4. No automated pass or fail on any measured value. The instrument observes; whether a picture is right stays a person's judgement, consistent with how every other workbench in this repository is verified.
5. No attempt to make the guards historically correct as fencing. The reference sheet is the bar, and matching a drawing is the whole of the requirement.
6. No interactive pose authoring. Sliders that dump a guard's record would replace guesswork with a person's own eye, and that is worth building, but it is a tool rather than a pose and it does not belong inside this boundary.

## Acceptance Criteria

1. Any one of the fourteen guards can be selected and seen on its own, framed closely enough that both arms are distinguishable from the ribs they cross.
2. Every guard stands on the ground: no foot sits measurably off the floor plane in any of the fourteen.
3. No guard requires an arm to exceed its length; if one does, the instrument names it rather than the solver hiding it.
4. Every guard's hilt, blade angles, edge roll, reach, grip, foot clearance and balance are readable from the workbench without opening the source.
5. The register names the two most similar guards in the set, and no pair is so close that the two are indistinguishable on screen.
6. The four showcases that share the skeleton — bisection, explosion, altar, mortar — behave as they did before.
7. A guard's authored record is small enough to read at a glance and expressed in the same units as every other guard's.
8. Middle, High and Low each read as the guard the plate names, judged by a person against the plate. The remaining eleven are drafts and the workbench says so.

## Execution

Perishable. This records the codebase at the time the plan was written; re-check coordinates against live code before acting on them.

### Overview

| Child | Focus                                                          | Form                | State                                                                       |
| ----- | -------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------- |
| 01    | Measurement module and its workbench readout                   | direct to execution | Landed                                                                      |
| 02    | Pose language: sword-driven solver, shared stances, edge roll  | direct to execution | Landed                                                                      |
| 03    | Single-guard presentation and picker                           | direct to execution | Landed                                                                      |
| 04    | Skeleton proportions: shoulder width against a two-handed grip | sketch              | Blocked on a decision — see the design section on what measurement reversed |
| 05    | Middle, High and Low authored to the plate                     | direct to execution | Middle and Low read; High is limited by 04                                  |
| 06    | The remaining eleven guards                                    | sketch              | Not started; the authoring loop is the open question, not the numbers       |

Landing order is 04, then 05, then 06. 04 comes first because it moves the reach ceiling every later guard is authored against, and re-authoring fourteen guards after changing it is the whole cost of getting that order wrong.

**05 and 06 should not be attempted by hand-tuning against screenshots.** That loop was run for Middle, High and Low and it converges slowly and unreliably: each round costs minutes and the judgement of whether a pose matches the plate is the bottleneck, not the code. Every value a guard carries — three hilt offsets, two blade angles, one edge roll, one stance name — is a slider. Building that surface is out of this plan's boundary by Non-Goal 6, and is the recommended predecessor to 06 regardless.

### Coordinates

Everything lives in `src/app/debug/three-preview/`. The boundary rule in `.dependency-cruiser.cjs` named `tooling-imports-only-its-measured-set` forbids `dev/tools/` from importing `src/app/`, so the instrument is a module here and its readout is part of the workbench, not a CLI. Headless iteration during development runs through `npx vite-node --config dev/tools/vite-node.config.ts <scratch file>` against the `@/` alias, with the scratch file kept outside the repository.

The modules children 01 to 03 left behind: `body-frame.ts` owns the body's coordinate system and its ruler, `guard-metrics.ts` owns measurement with no rendering and no DOM, and `sword-guard-poses.ts` owns the stance table, the guard table and the solver. The showcase, the runtime and the shell carry the picker, the stage and the readout.

### Rig facts, measured off the live skeleton

- Upper arm 0.5308, forearm 0.48, arm total 1.011.
- Thigh 0.8, shin 0.78, leg total 1.58.
- Shoulder sits 3.100 above the foot bone; the arm is 32.6% of that, against roughly 36% for a human.
- Shoulder half-width 0.5, which is 0.49 arm-lengths. This is the number child 04 is about: a two-handed grip on the centre line pays it before reaching anywhere.
- Rest foot bone height 0.14 — the ground plane every foot is placed on.
- The skeleton faces `+Z`; its anatomical right is `−X` (`rightShoulder` is authored at negative x).
- In hand-local space the blade axis is `(−1, 0, 0)` and the edge axis is `(0, 1, 0)`. Both are needed to specify roll.
- Grip span between the hands is 0.30.

### Where the three tuned guards currently measure

```
guard   reachR reachL  grip   hiltUp hiltFwd hiltSide  tipH  pitch  edge  foot   balance
middle  0.833  0.776   0.300  -0.32   0.62    0.04     1.86    18     0   0.000  -0.092
high    0.919  0.848   0.300   0.80   0.22    0.10     3.35    58     0   0.000  -0.047
low     0.896  0.761   0.300  -0.62   0.48    0.06     0.26   -42     0   0.000  -0.086
```

High's 0.919 is the ceiling described above showing through: its hands are at forehead height because the plate's position, above the head, measures past one whole arm. Low reaches its depth by bowing the torso 26 degrees, which carries the shoulders down over the grip; without that lean the same hilt is unreachable.

For comparison, what the three measured before any of this work — every value here is a defect the instrument found:

```
guard   reachR reachL  grip   footClearance  balance
middle  0.876  0.904   0.300  0.000          -0.075
high    0.787  0.874   0.300  0.097          -0.073   feet off the floor
low     0.999  0.884   0.296  0.156           0.055   arm clamped, feet off the floor, falling over
```

`low`'s right arm at 0.999 is the clamp in `solveElbow` at line 119, which limits to `upper + lower − 0.001`. `high` and `low` have feet off the 0.14 ground plane because neither carries a `stance` and `solveLeg` is only called when one is present. `middle` and `high` differ by four degrees of tip pitch, which is the first register collision in a set of three.

# Humanoid Block Bodies

> **Draft — not queued.** Requirements and children are written; the acceptance criteria wait on the first child being scoped against live code. It authorizes nothing in this state.

## Goal

Make one rig, one clip set and one part vocabulary serve every humanoid the game fields — the four skeletons now, the walking dead and whatever else stands on two legs later — so that a new body costs a table of proportions and a new movement costs a table of angles, and neither costs a modelling session. The rig-first pipeline that would do this already exists and builds exactly one body; what this plan does is stop it being about that one body.

## Requirements

1. One rig serves every humanoid, and a body is described by proportions and parts rather than built by hand. A second humanoid must cost a record, because the first one cost a week and the roster is meant to grow.
2. Every movement a humanoid can make is a row in a shared clip table, including the ways it can die. Death is the gap that matters most: the rig ships seven clips and none of them is terminal, so the renderer that replaced the sprite atlases has nothing to play when a body falls and answers all six of the game's deaths with one settling shape.
3. A body carries one weapon, attached where the rig says weapons go. Building every weapon into every body and hiding the ones not in use is what happens today, and it puts four weapons of geometry on screen for each one that is visible.
4. A body's parts can leave it. The game already treats bones as objects — a femur and a skull are things a player picks up and throws — and the rules already scatter bone on death, so a body whose parts are addressable is a body that can lose one.
5. Proportions and display numbers stay authored content, extending the table that already holds body scale and marker placement rather than opening a second authoring surface.
6. Every body and every clip is judged by a person in the entity workbench, at game distance, at the lengths the simulation actually gives them.

## Design

### What already exists, and what this plan is therefore not

The pipeline builds a Blender rig from a table, hangs boxes off it, keys clips from tables of angles, and exports a model the browser loads — one command, re-runnable, with the editable file kept as the manual fallback for a clip that resists its table. Every box is bound to exactly one bone at full weight, which is rigid parenting wearing the armature system's clothes: no weight painting, no deformation, no blending. Limbs have no elbow, knee, wrist or ankle, and that is a decision rather than an omission — a joint that does not exist is a joint a pose cannot be subtly wrong about, which is what made a table a sufficient author in the first place.

So this plan does not introduce rig-first authoring, rigid parts, or shared clips. It has all three. What it does is turn a builder for one body into a builder for a kind of body, and fill the clip table's largest hole.

### The four things missing

**A body is not yet a description.** Proportions live as constants in the builder — head size, neck height, shoulder span, arm and leg length. A second humanoid means editing those constants, which means there can only ever be one. They become a record, and the builder takes one.

**There is no death.** Seven clips, none of them terminal. Death clips are rows in the same table the other seven live in, and their absence is a regression the renderer swap knowingly shipped.

**The weapon socket is half-built.** The rig has a weapon bone, and it is genuinely a socket — it hangs off the weapon arm so a swing carries whatever is in the hand. But every weapon is built onto it at once and the drawing side hides three of them.

**Parts are tagged but not addressable.** Each box carries the name of the part it is, which is the hard half of dismemberment already done. Nothing yet uses it.

### What a humanoid record holds

Proportions, the part list, the socket contents, and a palette. Two bodies sharing a rig and a clip set differ only in these, and that is the test of whether the record is the right shape: if telling a skeleton from a walking corpse needs anything outside it, the record is too thin.

The part vocabulary is authored, not generated. A generator that grows geometry between joints produces a body that is proportionally correct and has no character, and this game's whole standing is its look — the renderer replacement was judged on atmosphere and nothing else. So the parts are drawn by a person and combined by a table; what varies per body is which parts, at what proportions, in what palette.

### Children

| #   | Child                | Focus                                                                                          | Form          |
| --- | -------------------- | ---------------------------------------------------------------------------------------------- | ------------- |
| 1   | The ways of dying    | Death clips in the shared table, and the drawing side playing them instead of settling a shape | Sketch needed |
| 2   | A body is a record   | Proportions and parts leave the builder's constants and become an authored description         | Sketch needed |
| 3   | One body, one weapon | The socket carries the weapon the body actually holds                                          | Sketch needed |
| 4   | Parts that come off  | A tagged part becomes one a death or a blow can detach                                         | Sketch needed |
| 5   | The second humanoid  | A walking corpse built from the record, proving the rig serves a kind rather than an instance  | Sketch needed |

Landing order is the table order. Child 1 is first because it closes a live regression rather than adding a capability, and because it needs nothing the other four build. Child 5 is last on purpose: it is the only one that proves the plan, and proving it before the record, the socket and the parts exist would prove a smaller thing.

### What this plan does not cover

Soft bodies. A slime has no rig, no limbs and no clips to share, and every requirement above would have to carry an exception for it. They are `slime_bodies.plan.md`'s.

## Non-Goals

1. No behaviour, balance or roster change. This is a re-clothing and a pipeline widening; what the bodies do is the rules' business and does not move.
2. No procedural part generation. The part vocabulary is drawn by a person; the record chooses and proportions it.
3. No skinning, deformation or added joints. The absence of an elbow is what keeps a table a sufficient author.
4. No renderer work beyond playing what the pipeline produces.
5. No retirement of the sprite atlases. Eighty-one megabytes of skeleton artwork still ships because the raycaster still reads it, and it dies with that renderer under the graduation plan, not here.

## Acceptance Criteria

To be written with the first child's sketch. The known fixed points: judged per body and per clip by a person in the entity workbench and in play, with no new tests; and a second humanoid that costs a record rather than a builder.

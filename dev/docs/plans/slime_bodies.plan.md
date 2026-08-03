# Slime Bodies

> **Draft — not queued.** The direction is chosen and the requirements are written; the approach is not, and the first decision below is the one that has to be taken before anything is built. It authorizes nothing in this state.

## Goal

Give the five slimes a body of their own. They are the one part of the roster the renderer replacement did not answer: the ray-marched game drew them as stacks of deformed rings that could squash, lunge, shatter and drown, the replacement draws them as a plain rounded shape that does none of that, and the verdict accepted the loss on the understanding that it would be paid back here.

## Requirements

1. A slime acts with its whole body, because it has nothing else to act with. A skeleton can tell a player what it is doing with an arm; a slime has one shape and every state has to be read off that shape, so squashing, stretching and settling are the whole vocabulary and not decoration.
2. The five slimes stay told apart by colour and size alone, with size carrying health, exactly as they do now. Nothing about a new body may cost the player that reading.
3. Being hurt, winding up, striking, drowning, being cleaved in two and bursting are all expressible. The rules already distinguish every one of them and the current body distinguishes none.
4. The soft body owes nothing to the humanoid rig and takes nothing from it. No bones, no clip table, no shared parts — a slime has no limbs to hang off a skeleton and forcing one on it is how both plans end up carrying exceptions.
5. Judged by a person watching one take a hit at game distance, in a fight, not in isolation.

## Design

### The decision that comes first

Two directions were named and neither has been chosen. They lead to different work and the choice is not an implementation detail.

**Fluid.** The body is a shape a formula deforms: squashed on landing, stretched into a lunge, collapsed into a puddle, split down the middle. This is what the ray-marched game did and the reason its slimes read as alive. It is also what the renderer replacement rejected — not the look, the _technique_: a programmatic blob that a shader computes was judged not to survive the move to a renderer that draws meshes.

**Blocks.** The body is a small stack of boxes that hops, in the manner of the cube-world game everyone will recognise. It fits the rest of the roster's look without argument, it costs no shader, and squash becomes a scale on a mesh rather than a formula. What it gives up is the fluidity — a hopping cube is a different creature from a thing that oozes, and the five slimes would become five cubes.

The choice decides everything downstream: the fluid route needs a deformation model and probably a shader, the block route needs authored parts and a hop cycle and lands much closer to the humanoid pipeline without sharing it.

### What the current body already gets right

Colour and height per appearance, sinking when drowning, a flash when struck, and a footprint that comes from the archetype rather than from a second copy of the number. Whatever replaces it keeps all four; the loss is entirely in what the shape does, not in what it knows.

### Children

Not decomposed. The decision above splits the work two ways and writing children before it is written is writing two sets and throwing one away.

## Non-Goals

1. No change to how slimes behave, how much they hurt, or how many there are.
2. No shared rig, clip table or part vocabulary with the humanoids. `humanoid_block_bodies.plan.md` owns that side and this plan takes nothing from it.
3. No new slime kinds. Five colours, five sizes, as authored.

## Acceptance Criteria

To be written once the direction is chosen. The known fixed point: a person watching a slime take a hit in a fight can tell that it was hit, from the body alone.

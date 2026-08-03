# Three-Scene 07 — Blood Is Ground

Parent plan: `dev/docs/plans/three_scene.plan.md`, child 7. Sandbox track, so this is the short architectural note rather than the full spec structure.

## Goal

Put the blood back where the shipped renderer keeps it. Child 5 recorded the blood as already shipped; judging it found three faults, and all three come from one cause — the experiment draws blood as a sheet laid over the ground instead of as part of the ground. A mortar's warning circle changes colour depending on how much has died on that spot, a bloodied floor reads brown, and a cell is either clean or saturated with nothing in between.

## Summary

A new `floor-stains.ts` owns the per-cell depth as a one-texel-per-cell data texture and the tiling blood surface it is mixed towards, both rebuilt only when the rules bump their own version. `scene-lighting.ts`'s ground fragment mixes the blood into the texel, then stamps the mark over it, then lights the result once — the shipped order. `scene-textures.ts` gains the blood surface itself, quoted from the shipped generator; the sheet and its flat red leave `world-effects.ts`.

## What owns what

- **`floor-stains.ts`** (new) — the depth grid, its quantisation, the blood texture, and the rebuild when a descent changes the grid's size.
- **`scene-lighting.ts`** — three more ground uniforms and four lines of fragment. It learns nothing about mazes: the grid is handed to it.
- **`scene-textures.ts`** — the blood surface, beside the stone and the water.
- **`world-effects.ts`** — loses the sheet entirely.

## Load-bearing decisions

- **Blood is a texel, not a layer.** All three faults are the same fault. A sheet drawn after the ground covers the marks painted into it; a sheet shaded on its own takes the fog and the torch a second time on top of what the floor already took, which is the brown; and a sheet is one value per cell, so there is nothing in it to pool or dry. In the texel, the mark overwrites blood exactly as it overwrites stone, and the light is applied once to whatever the ground turned out to be.
- **Blood is a surface, not a colour.** The shipped generator is two octaves of noise giving a pooling depth, plus a darker rim in a narrow band where the coarse octave sits between 0.62 and 0.72 — a pool dried at its edge, which is the detail that sells it as fluid. It is sampled at the same coordinate as the stone under it, so the two share their grain.
- **Eight depths, and the ceiling falls out of them.** The renderer quantises to eight steps; the rules cap a cell at 0.72, which lands on step six, so the deepest ground a fight can produce is three quarters blood and one quarter its own stone. That ceiling is why a soaked floor reads as stone somebody bled on rather than as a red rectangle — the previous mapping normalised by the cap and reached 0.85 of a flat near-black, so a single death saturated a cell outright.
- **A grid texture, not geometry.** The alternative is rebuilding the floor's buffers every time something bleeds, which is a dozen times a fight, against an upload of a few kilobytes. Nearest-sampled and clamped, so a cell's edge is the cell's edge and the ground outside the grid does not wrap to the far side of the floor.
- **The grid is re-pointed on a rebuild, not only refilled.** Descending allocates a differently sized grid, and a floor still holding the previous texture would draw the last floor's carnage on this one.
- **Water still takes nothing.** The predicate is checked at draw time as well as when a stain is written, so a cell some later change opens up never reveals blood that was not visible on it when it was spilled.

## Deliberately left open

Individual sub-cell marks where each spray lands. That is a second channel over this one rather than a correction to it, its positions are thrown away by the tick that computes them, and it is rules work besides — so it is recorded in the tracker's draft tier, folded into the stain redesign there, rather than built here.

## Verification

`npm run verify`, then open `/debug/three-scene` and fight until the floor is bloodied: the ground should darken in steps with pooling and dried edges visible in it, a mortar's circle should be the same colour over soaked ground as over clean, and no cell should go flat.

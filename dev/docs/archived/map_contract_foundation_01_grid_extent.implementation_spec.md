# The Grid's Extent Becomes A Property Of The Map

Parent Plan: `map_contract_foundation.plan.md`

## Goal

Retire the compiled-in grid size so the floor's extent travels with the floor. Every loop bound, bounds check, and flat index outside the maze module reads the extent from the maze it was handed, and the stride stops being importable at all.

## Summary

Today `DEMO_GRID_SIZE = 35` is exported from the maze module and read by four other modules as a loop bound, an array length, and — in five places — as a multiplier turning a coordinate into a flat index. That is a promise that every floor is square and the same size, and an authored map of another shape would fail silently against it rather than loudly.

The change is mechanical and behaviour-preserving. The maze gains a two-number extent instead of one `size`, the two existing accessors take that extent as their first argument, two more accessors join them so nothing outside the module has a reason to multiply, and the constant stops being exported. Nothing about generation, layout, or feel moves: the extent the generator declares is still thirty-five by thirty-five, so the floor is the same floor.

The one thing this child produces beyond the refactor is a measurement. The scene sweeps the whole grid several times per terrain rebuild, so an authored map can now be slow in a way nobody can see coming. Child 03's validator enforces a maximum area; this child measures a sweep at the known area and records the number it should enforce.

## Approach

- `DemoGridExtent` is `Readonly<{ width: number; height: number }>`. `DemoMaze` carries `width` and `height` in place of `size`, so a maze _is_ an extent and every accessor takes the maze directly.
- Four accessors own the arithmetic, and they are the only code in the repository that multiplies by a stride: `tileIndex(extent, x, y)`, `isInsideGrid(extent, x, y)`, `cellFromIndex(extent, index)`, and `gridArea(extent)`.
- `DEMO_GRID_SIZE` stops being exported. Inside the maze module it becomes the side length the shipped assembly happens to use, and the module builds one extent from it before generation begins — the carve, the scatter, and the assembly all take that extent, not the constant.
- Consumers read `maze.width` / `maze.height` for loop bounds and for the minimap's declared dimensions. Reading the extent for a bound is fine; multiplying by it is not.

## What It Replaces

- The exported `DEMO_GRID_SIZE` and its 14 reads in `src/demo/demo-scene.ts`, 11 in `src/demo/world.ts`, and 2 in `src/demo/demo-surface.ts`.
- `DemoMaze.size`, which had exactly one consumer, and that consumer was a hand-written flat index in `src/demo/impacts.ts` — a fifth one the plan's own notes missed.
- The three places in the maze module that recovered a coordinate from an index with `% DEMO_GRID_SIZE` and `Math.floor(/ DEMO_GRID_SIZE)`.

## Shapes To Avoid

- Keeping a module-level extent alongside the per-maze one. Two sources for the same number is exactly the failure the change exists to prevent, and the second one is always the one an authored map disagrees with.
- Passing `width` and `height` as two loose arguments. A flat index written with the wrong one of two extents type-checks perfectly and is wrong only on a map that is not square, which is the first interesting map anybody authors. One object, one accessor.
- Widening the accessors to accept a bare `number` for compatibility. There is no caller that needs it and the overload would be the seam the stride escapes through.

## Verification

`npm run verify`. Nothing observable changes, so the run itself is the other half of the evidence — `npm run capture` produces the contact sheet, judged by a person, and judges nothing itself.

## Acceptance Criteria

1. No module outside the maze module names a compiled-in grid size, and none of them multiplies a coordinate by an extent.
2. A run plays exactly as it did before: same floor shape, same rooms, same crowd.
3. The maximum area a validator should enforce is measured rather than guessed, and recorded where child 03 will read it.

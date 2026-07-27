# Player Screen Layer

Parent Plan: none (standalone sketch)

## Goal

Explore making the first-person player layer — the held torch and long sword, the attack slash, the torch flame glow, and the damage flash — an authored, tunable layer instead of a set of constants buried in the renderer, so its size and position can be adjusted without editing rendering code.

## Requirements

1. The sizes, offsets, and timings that position the player layer are authored values, because they are visual tuning decisions and every one of them is currently reachable only by editing the renderer.
2. The player layer keeps being composed in screen space and never enters world projection, depth testing, or the sprite pipeline — it is pasted over the finished frame, which is exactly why it does not belong to the scene authoring plan's placed-camera preview.
3. Tuning the player layer needs no map, no camera pose, and no authored floor. Its only frame of reference is the viewport, so whatever surface tunes it must be judged against a rendered frame at more than one aspect ratio rather than against a grid.
4. Reduced motion continues to suppress the layer's non-essential movement, and the layer stays free of any gameplay authority.

## Summary

This sits next to the scene authoring plan rather than inside it. That plan converges the numbers that place things _in the world_ — component offsets, sprite display size, floor anchors — and judges them from a camera standing in a cell. None of that applies here: the player layer has no world position, no depth, and no anchor to a floor line. It is drawn last, in viewport coordinates, after the scene is finished.

Keeping it separate also keeps the harder question separate. The world sprites already have an authored home in content; converging them is a move. The player layer has no authored home at all, so this sketch has to invent one, and it has to decide what the numbers even mean before they can be authored — several of them are currently expressed as fractions of viewport width or height with no stated intent.

The favored direction is to extract the values first as a named content record with the same shape discipline the world sprites use, and only then decide whether a tuning surface is worth building. Extraction alone already removes the "reachable only by editing source" problem for the whole layer; a live tuning panel is a second, optional step that should be judged on its own after the first lands.

## Sketch

### What the layer currently contains

Likely everything drawn after the scene composition finishes, in viewport coordinates:

- The held viewmodel image, sized from the viewport and drawn from a translated origin near the bottom edge, with a vertical bob and a swing rotation driven by attack events.
- The sword slash image, drawn as a screen-space rectangle during part of the swing with an additive composite and a sine-shaped alpha.
- The torch flame, a radial gradient plus an ellipse at a fixed fraction of the viewport, with its own flicker.
- The damage flash, a full-viewport translucent fill scaled by a decaying player-hit value.

The spec author should confirm this list against the renderer as it exists then; the presentation port is recent and the composition order may still move.

### The unit problem

Several of these values are fractions of viewport width, several of viewport height, and at least one mixes both by taking a minimum of the two. That is not obviously wrong — it is how a screen-space layer stays sane across aspect ratios — but it means the authored record cannot be a flat list of numbers without also stating what each number is a fraction _of_.

Candidate shapes to weigh:

- Author every value as a fraction of a single reference dimension and derive the rest. Simplest record, but it will distort at extreme aspect ratios unless the reference is chosen carefully.
- Author each value with an explicit basis (width, height, or the smaller of the two). Honest and future-proof, more verbose, and it makes the record self-documenting.
- Author against a fixed virtual viewport and letterbox. Cleanest to tune, but it changes composition behavior rather than just relocating constants, which puts it beyond a pure extraction.

The second is currently favored, because it records the intent that already exists implicitly in the code rather than replacing it.

### Timing values

The swing duration, the hit-flash decay, and the bob frequency are also constants, but they live in the presentation lifecycle rather than the renderer and are already reduced-motion aware. Whether they join the authored record or stay where they are is an open shape question for the spec, not a settled one — moving them means the reduced-motion branching has to move or reach across a boundary.

### Candidate files to inspect

- The Canvas renderer's viewmodel, slash, flame, and damage-flash drawing, for the constants and their bases.
- The presentation lifecycle owner, for the swing and hit timings and the reduced-motion branching.
- The existing world sprite placement record in content, for the shape discipline and parser precedent an authored player record should follow.
- The application surface that mounts the canvas, for how a tuning panel would obtain a rendered frame if the optional second step is taken.

## Non-Goals

1. Do not fold this into the scene authoring plan's placed-camera preview. Screen-space values are not judged from a cell.
2. Do not add the DOM HUD, crosshair, health bar, combat text, or minimap. The feel plan owns the HUD, and the presentation port already excludes those surfaces.
3. Do not change what the layer draws, its composite modes, or its reduced-motion behavior. This is extraction and tuning, not a redesign of the hands.
4. Do not give the player layer gameplay authority. It reacts to already-settled semantic events and decides nothing.
5. Do not treat this sketch's codebase claims as verified; the spec author re-checks each one.

## Acceptance Criteria

1. Every size, offset, and position that places the player layer is authored content, with no such value left reachable only by editing the renderer.
2. Each authored value states what it is a fraction of, so the record is readable without consulting the drawing code.
3. The composed frame is unchanged at the current aspect ratio after extraction, confirming the move relocated values rather than altering them.
4. The layer still holds no gameplay authority and still suppresses non-essential motion under reduced motion.

# Three-Scene 06 — The Finishing Pass

Parent plan: `dev/docs/plans/three_scene.plan.md`, child 6. Sandbox track, so this is the short architectural note rather than the full spec structure.

## Goal

Build the last three things the shipped renderer does to a frame: the dust drifting in the air, the vignette with its warm centre, and the red the screen answers a hit with. The checklist never named them, which is most of why the first judging session could call the atmosphere down without being able to say what of — none of the three is information, and together they are the difference between a rendering and a scene.

## Summary

A new `finishing-pass.ts` owns a second 2D canvas over the WebGL frame and draws all three with the shipped canvas calls and the shipped constants. `scene-runtime.ts` stacks it under the arm, accumulates the raw mouse counts the vignette reads as a turn rate, and hands it the frame's camera pose and the hit that is still fading.

## What owns what

- **`finishing-pass.ts`** (new) — the overlay, its sizing, and the three passes. It knows nothing of the world: it takes a camera pose, an elapsed clock, a turn rate and a flash strength, and paints.
- **`scene-runtime.ts`** — where the layer sits in the stack, the turn-rate smoothing, and the per-frame call.
- **`three-scene.css`** — unchanged rule, corrected comment: the overlay class now carries two canvases rather than one.

## Load-bearing decisions

- **A 2D layer, not a post-process.** These are lens effects, none of them needs depth, and the shipped renderer draws them as two radial gradients and ninety filled rectangles. Reimplementing a radial gradient as a shader would be a second opinion about numbers that are otherwise quoted exactly.
- **It sits under the arm.** That reproduces the shipped stacking, where the red is painted inside the renderer and the viewmodel is drawn over it — so the arm is never tinted by the blow that landed on the body holding it. The plan's `Execution` note guessed the arm's own layer for the red because that is where the damage arcs are; a layer below is what actually matches the game.
- **Drawn at full element size, not at the frame's coarse resolution.** The shipped renderer halves only its plane pass; the grade, the motes and the red are all full-resolution there, and matching the grain here would be a coarseness the game has not got.
- **The turn rate is the play surface's, not a new one.** Raw device counts accumulate on the look call and drain per frame, vertical counting half; the smoothing rises fast and falls slowly so the frame does not breathe every time the mouse pauses mid-sweep. Tuning any of it here would tune it against a different pair of hands.
- **Motes are tied to the camera, not to the screen.** The sway term reads the eye's angle and position, which is what makes the dust air the player is moving through rather than static laid over the image. Three layers at three speeds; the near one is larger, brighter and faster.

## Deliberately left open

No reduced-motion path. The shipped passes all take a flag that stills them, and the experiment has no preference surface to read one from — the sandbox is judged by a person opening it, and that person can see motion. Anything about how the finishing pass behaves under a stilled clock is the graduation plan's, where the preference already exists.

## Verification

`npm run verify`, then open `/debug/three-scene`: the frame should have a soft dark rim and a warm middle that breathes, specks drifting against the turn of the head at three speeds, and a red that closes in from the edges when something lands a hit. Whether any of it reads right is the user's judgement and is not claimed here.

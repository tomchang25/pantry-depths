# Three-Scene 03 — Close Layer

Parent plan: `dev/docs/plans/three_scene.plan.md`, child 3. Sandbox track, so this is the short architectural note rather than the full spec structure.

## Goal

Finish the frame at the near end: the player's own hands, the camera's reactions, the one thing drawn through walls, and proof that plain DOM still stacks over WebGL. With these the experiment covers every row of the plan's checklist, and the whole view can be judged in one sitting.

## Summary

A new viewmodel module builds the hands twice over — a camera-attached block arm and the game's own authored 2D stage drawn on a canvas above the rendered image — and a switch chooses between them or neither. The runtime gains the three camera kicks the rules already raise, an exit marker drawn with depth testing off, and a stand-in HUD strip.

## What owns what

- **`viewmodel.ts`** — both pairs of hands and the switch. The mesh arm is a forearm and a blade in camera space, swung through three beats. The authored arm calls the same `drawMeleeAttack` the game does, from the content layer, onto an overlay canvas.
- **`scene-runtime.ts`** — the camera kicks, the exit marker, and the wiring: the camera joins the scene graph so anything parented to it is drawn.
- **`three-scene.css` / `three-scene.ts`** — the overlay's position and the HUD stand-in.

## Load-bearing decisions

- **Both viewmodels are built, and neither is chosen.** The plan named this row as genuinely open, and it is the one place where a spike could quietly make the author's decision for them. The authored stage is content, so an experiment can keep drawing the real arm rather than a guess at one — which makes the comparison a fair one rather than a straw man.
- **The camera joins the scene.** A camera outside the scene graph renders the world correctly and silently drops its own children, which is how a viewmodel parented to it goes missing with no error.
- **Kicks are a real pitch, not a shear.** The Canvas renderer can only slide its horizon, because its columns must stay vertical. A perspective camera rotates, so the same three numbers — blast, weight, and the tap of a connected swing — are applied as an actual rotation.
- **The exit marker is depth-test-off geometry rather than a list.** The Canvas renderer keeps an x-ray list its column pass consults; a depth-buffered renderer gets the same effect by turning one test off, which is the plan's declared reinterpretation of that row.
- **No aim is fed to the authored arc.** Chasing the point a swing landed on needs the renderer's own projection wired through, and the arc stays where it was authored instead — the same place the workbench judges it.

## Deliberately left open

No second hand holding the carried object, in either viewmodel: every attempt at one in this project has read as a lump of meat rather than a hand, and the reason is recorded where the shipped viewmodel is drawn. The HUD stand-in carries no readout, because a real HUD here would be a second copy of one.

## Verification

`npm run verify`, then open `/debug/three-scene` and play it. Photographs recorded both arms mid-swing, the DOM strip stacking over the rendered frame, and the exit marker showing through masonry. Every verdict is the user's and none is claimed here.

# Demo Migration 07 — Runtime And Interface

Parent Plan: `demo_migration.plan.md`

## Goal

Earn the two pre-declared layers: the frame loop, input, mounting, and session dressing become `src/runtime/`, and the plain-DOM HUD becomes `src/ui/`. After this child the demo tree holds exactly the interim projection half the plan promised — scene building, sprite loading, the viewmodel — and nothing else.

## Summary

Nine files move; no module is reshaped.

- **Runtime** takes the surface with its stylesheet, the dev overlay with its stylesheet, the stage dressing, and the default-map choice — the whole "which map, which frame, which keys" half. The plan's execution note suggested splitting the surface into frame loop, input, and mount on the way; that split is declined, deliberately: it is a structural redesign of a thirteen-hundred-line file inside a move, and the migration's whole discipline has been that no diff mixes a move with a redesign. The boundary this child buys is the layer, not the file's internal anatomy.
- **Ui** takes the HUD, its icon builder, and its stylesheet. The three import nothing but each other, so the layer arrives self-contained.
- **Two new machine edges, one of them a declared deviation.** Runtime may import the demo tree while the projection half lives there — an interim edge that dies with the tree. And runtime imports ui, which the platform standard forbids for React consumers; under this project's no-React deviation there is no reactive binding layer, so the frame loop pushes view models into the DOM interface directly, and the addendum records that as part of the deviation rather than leaving the edge unexplained.
- The structure addendum's scheduled revision lands: the no-React bullet stops claiming the HUD lives beside its simulation, the runtime and ui rows flip to present, and the demo tree section shrinks to the projection half.

Verification: the gate, a capture run, and a playtest aimed at what moved — input feel, HUD, dev overlay, the stage keys, restart.

## Relational Context

- After the move: runtime imports runtime, core, content, presentation, ui, and (interim) demo; ui imports ui, content, and core; nothing imports runtime or ui except the app layer — and runtime imports ui. All machine-checked in the same change as this prose.
- The bootstrap's lazy import of the surface is the production entry; its path moves with the surface and its header comment stops speaking of layers "once they are earned".
- The HUD-attack workbench is the one app module that mounts the HUD and the overlay directly; both its imports repoint.
- The stage keeps its name-comparison identity and its content-table import — runtime may import content, so nothing about the stage changes but its address.

## Scope

### Included

- The nine file moves, import-path rewires, the two cruiser rules and the demo-rule adjustment, the addendum revision, the bootstrap comment.

### Excluded

- Any split, rename, or behaviour change; the projection half; the scene-routing question (the map query parameter stays exactly where it is).

## Files to Change

| File                                                           | Change Size | Purpose                                               |
| -------------------------------------------------------------- | ----------- | ----------------------------------------------------- |
| `src/demo/demo-surface.ts` + `.css` → `src/runtime/`           | Move        | Frame loop, input, mounting, playback, drain          |
| `src/demo/demo-dev-overlay.ts` + `.css` → `src/runtime/`       | Move        | The development instrument the surface mounts         |
| `src/demo/stage.ts`, `src/demo/maps.ts` → `src/runtime/`       | Move        | Session dressing; the address-bar map question        |
| `src/demo/demo-hud.ts`, `hud-icons.ts`, `demo.css` → `src/ui/` | Move        | The plain-DOM interface layer                         |
| `src/app/main.ts`, `src/app/debug/hud-attack-workbench.ts`     | Small       | Import paths follow                                   |
| `.dependency-cruiser.cjs`                                      | Small       | Runtime and ui rules; demo importer set gains runtime |
| `dev/standards/project_structure.addendum.md`                  | Medium      | Layer rows, no-React revision, runtime→ui deviation   |

## Execution Outline

1. Move the nine files; rewrite the import paths mechanically; typecheck to zero.
2. Boundary rules and addendum in the same change; `npm run check:boundaries` proves the declared edges are the real ones.
3. `npm run verify`; capture run; hand to the user for the input-and-interface playtest before closeout.

## Acceptance Criteria

1. The demo tree contains exactly the scene builder, the sprite loader, and the viewmodel; runtime and ui exist and pass the boundary check with the declared edges and no others.
2. The game boots from the moved surface, and the HUD, overlay, stage keys, and restart behave identically.
3. The aggregate gate and the governance check pass.

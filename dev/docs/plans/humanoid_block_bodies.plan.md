# Humanoid Block Bodies

> **Queued — the workbench experiment exists; production work has not started.** Requirements, children and acceptance criteria are complete. Each child becomes executable through `/implement` in table order; this document authorizes nothing on its own.

## Goal

Make one animation rig, one authored body-record format and one runtime pose boundary serve every ordinary humanoid. A new humanoid should cost a record of parts and proportions, a new complete movement should cost one shared clip, and a directional hit or detached limb should not require a body-specific animation or renderer branch.

## Requirements

1. One animation library owns the humanoid joint hierarchy, rest transforms and shared clips, because copying any of those values into runtime code creates a second authority whose failures appear as silently distorted poses.
2. A humanoid body is authored as a record of rigid parts, palette entries, hit regions, detachable groups and sockets. Runtime assembly may be procedural, but the body design is authored content rather than geometry inferred by an algorithm.
3. A body contains only the weapon it currently carries. The weapon follows one named socket, leaves with a detached weapon arm, and can be removed when a throw or gameplay drop transfers ownership elsewhere.
4. Base animation, directional reaction and structural damage write separate transform layers. The animation player owns the named rig joints, reaction modifiers own pivots below those joints, and detached visuals leave both owners before physics takes them.
5. The entity workbench and the game use the same body definitions and runtime factory, because a debug-only reconstruction cannot prove the production drawing path.
6. The shared movement set includes the current locomotion and attack clips plus the terminal, occupied, legless and carried poses required by the first-five-minutes plan. A death cause may use an authored terminal clip, structural separation or an environment-owned world transform, but every cause has one explicit presentation treatment.
7. Repeated bodies reuse compiled geometry by body definition and detachable group instead of constructing every authored box for every enemy instance, because a room of humanoids must not multiply draw work by the raw part count.
8. The body format stops at ordinary humanoids. A boss may use its own GLB, rig and animation state machine while receiving the same semantic hit and death information; the humanoid joint vocabulary does not constrain it.

## Design

### The pipeline is hybrid

GLB remains the authored animation format. It carries a geometry-free humanoid rig, the joint hierarchy in its exported coordinate system and the shared clip library. Runtime code clones that hierarchy and attaches authored rigid body parts to it. The assembled skeleton and walking corpse therefore keep the visual result of the workbench experiment without replacing rigging or animation with code.

The exported rig is the sole owner of joint parentage and rest transforms. Body records vary silhouette through part dimensions and local placement against that fixed graph. A later humanoid that genuinely needs a different joint graph is a different rig family rather than an exception inserted into this one.

### A body record is the visual authority

Each part names its joint, local transform, primitive shape, palette entry, hit region and detachable group. Hit regions also carry authored bounds for contact resolution, so combat does not query rendered meshes or infer anatomy from part names. A socket names what can be attached without making the attached object part of the body definition.

The part list is drawn by a person and transcribed as data. Assembly is procedural only in the sense that the runtime builds scene objects from that data. Adding a body must not add a model builder, a clip copy or a body-type branch.

One compilation pass combines compatible parts within each detachable group and material boundary. Instances share the resulting geometry and create only the per-body presentation state that must differ, such as hit flash and current reaction.

### One pose has three layers

The base layer plays locomotion, attacks and complete authored poses. The reaction layer applies short directional offsets from hit region, incoming direction, damage kind and strength. The structural layer controls whether a group is attached, detached, hidden or handed to another presentation owner.

The hierarchy is ordered so each layer writes different objects:

```text
animated joint
└─ reaction pivot
   ├─ attached visual group
   └─ child animated joints
```

The animation player runs first, reaction pivots are updated second, and attachment state is applied last. A detached visual group preserves its world transform when it leaves the pivot; the animation player may continue moving the empty joint without reclaiming the detached geometry.

Directional flinches, blunt recoil, stun stagger and hit-region turn belong to the reaction layer. Occupation, hop, crawl, carried struggle and terminal skeletal motion belong to the shared clip library. Cleaving, explosive separation, weapon release and similar changes of ownership belong to the structural layer.

### The game reports meaning, not rendering commands

The body runtime receives semantic facts such as region, direction, damage kind, strength, broken group and death cause. It does not derive those facts from health, mesh intersections or the selected body. The first-five-minutes plan owns the combat rules that produce hit regions and break decisions; this plan owns how a humanoid body can present them.

### Bosses are a separate rig family

A boss keeps a complete authored GLB when its silhouette, joint count and phase transitions need a unique rig. Shared gameplay meaning does not require a shared implementation: a boss can answer a hit event with a custom clip or state transition while an ordinary humanoid answers it with a reaction pivot. A common body interface is introduced only when the boss becomes the second production consumer and demonstrates the overlap.

### Children

| #   | Child                      | Focus                                                                                                      | Form          |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | The animation library      | A geometry-free rig asset owns the joint graph, exported rest transforms and current shared clips          | Spec-ready    |
| 2   | A body is a record         | Parts, palettes, regions, detachable groups and sockets become production-owned authored definitions       | Spec-ready    |
| 3   | One body, one weapon       | The shared factory compiles reusable rigid groups and attaches only the selected weapon                    | Spec-ready    |
| 4   | The pose boundary          | Reaction pivots and ownership order support directional hits and detachment while a base clip keeps moving | Spec-ready    |
| 5   | The production skeleton    | The game adopts the same body factory and definitions used by the entity workbench                         | Spec-ready    |
| 6   | Parts that come off        | A region can release its visual group and weapon without being restored by later animation updates         | Spec-ready    |
| 7   | The missing body movements | Death treatments, occupation, hop, crawl, impaled and carried-struggle poses join the shared movement set   | Sketch needed |
| 8   | The second humanoid        | A walking corpse record proves that a new body adds no builder, copied rig or body-specific reaction path   | Spec-ready    |

Landing order is the table order. Child 7 needs a sketch because its presentation treatments are settled but the authored poses still require workbench judgement before an executable clip table can be written. The other children have narrow ownership and migration boundaries and can proceed directly to implementation specs.

## Non-Goals

1. No boss model, encounter, phase logic or boss animation set. This plan defines only why a future boss is allowed to remain a separate rig family.
2. No shared rig or part vocabulary for slimes or other soft bodies.
3. No skin deformation, weight painting, elbows, knees, wrists or additional humanoid joints. Rigid parts and the current small joint graph are what keep shared table-authored clips viable.
4. No change to combat damage, break thresholds, enemy behaviour, balance or roster placement. The walking corpse proves the body format in the workbench and does not enter gameplay through this plan.
5. No universal model or animation framework. The humanoid runtime is generalized only around the bodies and reactions already required.
6. No new automated feel tests. Clips, reactions, detachment and game-distance readability are judged in the entity workbench and in play; existing verification still applies when each child is implemented.

## Acceptance Criteria

1. The entity workbench shows the skeleton and walking corpse through the same production body factory, and every shared clip drives both without remapping or body-specific animation code.
2. The runtime contains no copied humanoid joint hierarchy or exported rest-transform table; changing the rig asset cannot leave a second silent authority behind.
3. A humanoid appearance is added by one body record and content mapping, with no new builder and no body-type branch in clip selection, reaction or detachment.
4. Each body instance contains only its selected weapon, and changing or throwing that weapon does not leave hidden copies of the other weapons attached.
5. A head or either arm turns away from a synthetic hit direction while walk or strike continues underneath it, then returns without restarting the base clip.
6. Detaching the weapon arm during walk or strike preserves the arm and weapon world pose, hands them to the detached-parts path, and leaves later animation unable to restore them.
7. The shipped skeleton uses the same factory as the workbench and preserves its scale, heading, attack timing, hit flash, carried-body placement and current gameplay behaviour.
8. Every supported humanoid death cause has an explicit terminal treatment, and the occupation, hop, crawl, impaled and carried-struggle poses are available to the workbench at their simulation-facing durations.
9. Multiple instances of one body share compiled rigid-group geometry, and the workbench diagnostics show that raw authored box count is not repeated as equivalent geometry construction per enemy.
10. The walking corpse differs from the skeleton only through its body record and content mapping while using the same rig, clips, pose layers, weapon socket and detachable-group runtime.

## Execution

Perishable. This records the codebase at the time the plan was written; whoever executes a child re-checks its coordinates against live code first. Each subsection is cut when its child ships.

### Child 1 — The animation library

`dev/tools/skeletons/blocky_build.py` currently owns the seven-bone armature, body boxes, four weapons and seven clips, and `dev/tools/generate-blocky-skeleton.py` exports them together to `src/content/enemies/assets/skeleton-blocky.glb`. Split the export so the production humanoid asset carries only the named joint graph and animation clips. Keep the generated Blender file as the manual pose-authoring fallback.

The current clip vocabulary is in `src/presentation/scene-3d/block-clips.ts`. Keep one TypeScript owner for clip and weapon identifiers, and make the exporter validate or generate against that vocabulary rather than retaining an independent silent list. The rig asset remains loadable by both the workbench and production renderer.

Do not transcribe the exported joint positions again. Child 3 clones the hierarchy from the loaded asset; child 2 owns only geometry relative to named joints.

### Child 2 — A body is a record

Move the durable content of `src/app/debug/entity-workbench/blocky-bodies.ts` into a production-owned body-definition module under `src/presentation/scene-3d/`, following the project structure and naming standards at implementation time. Define the closed humanoid joint, region and detachable-group vocabularies there.

Extend each part record with a stable id, region and detachable group. Add authored region bounds for head, torso, both arms and both legs. Keep the skeleton definition in this child; retain the staged walking-corpse table as the source for child 8 rather than making it a second pipeline.

Add the appearance-to-body-definition selection beside the existing display mapping. `src/content/enemies/entity-display.json` remains the owner of body scale and marker placement; it should point to a body definition rather than absorb mesh construction details.

### Child 3 — One body, one weapon

Create the production body factory beside the definitions. It clones the named rig hierarchy loaded by child 1, compiles parts by detachable group and material boundary, caches the resulting geometry per body definition, and creates per-instance presentation materials only where hit flash or another instance state requires them.

Return a runtime handle containing the root, named joints, detachable visual groups, current weapon socket, animation mixer and owned disposable resources. Build only the requested weapon from the existing weapon-part records. A weapon change removes the prior socket contents before attaching the next.

Replace the procedural branch inside `src/app/debug/entity-workbench/block-runtime.ts` with this factory. The loaded full-model comparison may remain for this child only; child 5 removes it once production and the workbench share the new path.

### Child 4 — The pose boundary

Insert one reaction pivot below each animated joint and parent child joints and attached visuals through it. The animation mixer continues targeting only the names exported in the GLB; reaction code targets only the pivots.

Add a presentation-level reaction input carrying region, direction, damage kind, strength and elapsed time. Implement the minimum workbench proof: directional head and arm recoil layered over walk and strike, plus return to neutral without restarting the action. Keep the formula shared across body definitions.

Add a workbench control that releases the right-arm visual group during an active clip. Preserve its world transform on reparent, stop applying reaction state to the released group, and confirm the mixer continues moving only the empty animated joint.

### Child 5 — The production skeleton

Refactor `src/presentation/scene-3d/world-bodies.ts` so its boned-body path creates the skeleton through the production factory instead of cloning the full skinned-model template. Keep clip selection driven by current enemy state, and preserve body height, heading, sinking, javelin release, carried-body placement, flash materials and cleanup.

The renderer supplies body definition id and selected weapon from the current appearance mapping, then retains only the returned runtime handle. Remove traversal that discovers hidden weapon meshes and remove the obsolete full-model template after the workbench comparison no longer needs it.

Use the entity workbench diagnostics and the first-five-minutes arena when available to compare draw calls and game-distance readability. If a raw part remains one draw call after compilation, narrow the grouping before accepting this child rather than adding a second optimization path later.

### Child 6 — Parts that come off

Promote the workbench release proof into the production body handle. A detachable group has attached, released and absent presentation states. Release preserves world transform and transfers the visual group to the existing detached-parts or debris owner; absence prevents a recreated living-body instance from drawing a group the rules say is gone.

The weapon socket is part of the right-arm group. Releasing that group releases the visible weapon with it, while the gameplay pickup is still created by the combat owner in the first-five-minutes plan. Expose enough identity for that consumer to match a broken region to the released presentation group without naming meshes.

Retain burst and bisection as structural operations over detachable groups. They must not stop or mutate the shared clip library to take ownership of separated visuals.

### Child 7 — The missing body movements

Create a child sketch before implementation. Inspect the live `DeathCause` vocabulary in `src/core/world/world.ts`, the clip selection in `src/presentation/scene-3d/world-bodies.ts`, and the body states required by `dev/docs/plans/first_five_minutes.plan.md`.

The sketch maps `slain`, `cleaved`, `drowned`, `swallowed`, `splattered`, `blasted` and `impaled` to one explicit mix of terminal clip, structural separation and world transform. It also scopes occupation, hop, crawl, impaled carry and carried struggle as shared clips, including which ones loop, hold or are driven by simulation progress.

Author the settled clips through `dev/tools/skeletons/blocky_build.py`, expose them through the shared clip vocabulary, and add every result to the entity workbench. Production selection lands only where the relevant simulation state already exists; the first-five-minutes children add the remaining state and gameplay transitions.

### Child 8 — The second humanoid

Move the staged walking-corpse part table into the body-definition owner and add its palette, region bounds and appearance mapping. It uses the existing rig asset, compiled-group factory, clip vocabulary, pose layers, weapon socket and detach operations unchanged.

Expose the body in the entity workbench and judge every shared clip, directional reaction and structural operation at game distance. Do not add the walking corpse to spawn tables or enemy behaviour through this child.

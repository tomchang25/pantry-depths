# The First Five Minutes

> **Queued — nothing started.** Requirements, children and acceptance criteria are complete. Each child becomes executable through `/implement` in table order; this document authorizes nothing on its own.

## Goal

Make the game entertaining inside five minutes of a cold start, measured by whether a player keeps attacking to find out what the next blow does. Everything the game currently offers as a reason to continue — blessings, the forge, sealed rewards, extraction, descent, the difficulty level — pays off well past the point at which most players would already have left, and the ordinary blow that has to hold them until then produces a flinch, a number, and nothing else. This plan rebuilds the ordinary blow and the room it lands in.

## Requirements

1. A blow lands where the player aimed it, and every consequence of that blow — the arc, the spray, the mark on the floor, the direction the target is thrown — is placed at the point of contact rather than at the target's centre. A swing is currently a cone test whose effects are drawn at the victim's feet, so aiming is not something a player can be rewarded for and no later requirement here has anywhere to attach.
2. What a blow costs is raised where the damage is applied, not at each attack route. Spray and sound are hung on individual routes today and most routes hang neither, so an enemy hurt at range shows a flash and nothing else, and pays its whole visual debt at the moment it dies.
3. A body accumulates visible damage in at least three regions — head and both arms — and an arm that comes off drops what it was holding. Visible accumulation is what turns a fight into a sequence rather than a repetition, and the dropped weapon is what makes the accumulation matter to the player and not only to the victim.
4. Every way of dying looks like its own way of dying, and every death leaves something durable on the floor. Seven causes of death are already distinguished internally and all seven are drawn as one settling shape; boned enemies leave no floor record at all, so a corner where twenty skeletons came apart is indistinguishable from one nobody fought in.
5. The player has a second verb whose whole purpose is displacement, and displacement is lethal. A shove that only changes coordinates is not entertainment; a shove that kills against a wall, a spike, a pit, or another body is.
6. A room is occupied before the player arrives and turns on itself once he starts. Enemies that wait until they see the player and then walk at him make a room a queue.
7. All of the above is judged by playing a scene that contains nothing but the fight — no objectives, no rewards, no interface, no way down. Judging any of it inside the full game means judging it against noise this plan has no intention of removing.

## Design

### What is missing is the ordinary blow, not the rare one

The game already has rare verbs that work: a body run through by a javelin, one shoved into water, one blown apart. What sits between two of those moments is a swing that subtracts a number and plays a flinch, and two rare moments cannot carry the minutes between them. The bar is that hitting one skeleton repeatedly with a bone is entertaining on its own; the rare verbs then read as peaks rather than as the only reason to keep playing.

A blow that satisfies produces three layers of result, and the game currently produces a weak version of the first and nothing of the other two.

**Contact** is the instant of the hit: a brief hold, a sound, a camera that moves, a spray thrown along the blow, and the struck part of the body turning away from it. The game has a camera pitch on connect and no hold, no shake on a melee hit, and a six-particle spray on exactly one attack route.

**Response** is what the body does about it: different attacks producing different reactions rather than different subtracted numbers. Blunt weapons throw and stun, blades cut and detach, points penetrate and pin. Today the reaction is one flinch timer of a fixed length regardless of what struck it.

**Permanence** is what is still there afterwards: blood on stone, ash where bone came apart, a weapon lying where the arm that held it fell, furniture that stays broken, a room that is visibly not the room the player walked into. This is the layer that makes five minutes feel like progress without any progression system, and the game has one third of it — blood, from two of the several routes that draw it.

### Where a blow lands, and what a region is

A hit gains a point in space and a region of the body it belongs to. Six regions are addressable — head, torso, left arm, right arm, left leg, right leg — because the body geometry already names its parts and a hit point can be resolved against them; only three of them accumulate damage within this plan. Torso is where ordinary damage goes and does not break. Legs are resolved and reported but inert until the last child gives a legless body something to do.

A region multiplies the damage the blow carries: head ×2, torso ×1, arms and legs ×0.75. The head multiplier is the reward for aiming, and it is deliberately large enough that a player notices it without being told.

A region carries its own accumulated total, separate from the body's health, and breaks when that total crosses 60% of the body's maximum health. A broken arm detaches and drops whatever it held. A broken head kills, whatever the body's remaining health was — that is the answer to a headshot, and it is why the head threshold and the head multiplier are the same decision.

### The order, and why it is this order

The measuring stick comes first, because every child after it is judged by playing and there is currently nowhere to play that is not also asking the player to complete objectives, collect rewards, and find a way down.

After that, the free half of the contact layer lands before the hit rewrite. Hit stop, centralised spray, melee shake and the kick all fit inside shapes that already exist and change no contract, so they are the fastest route to a blow that is worth judging, and they establish the baseline the hit rewrite is compared against. The kick joins them because it is the one verb whose absence the design keeps running into and because its mechanism — displacement — already exists as knockback.

The hit rewrite lands third because it is the geometry every remaining child stands on, and it is not worth doing before there is a room to check it in and a blow worth aiming.

Regions, deaths, the riot and the remaining verbs follow in that order because each needs the one before it: a region cannot accumulate before a hit has a region, a death cannot vary by cause before the causes produce distinguishable damage, a riot in a room where the ordinary blow is weak is worse than no riot, and a legless body needs parts that come off.

### The bodies this plan does not own

Death treatments and detachable parts belong to the humanoid block bodies plan, which owns the rig, shared movement set, pose layers and part vocabulary. This plan does not take them over and does not duplicate their requirements. Its damage, death, occupation and legless-body children consume the production boundaries established by that plan after the corresponding body children land.

The body pipeline shape is settled. These dependencies are landing-order constraints rather than design questions, so the affected children can proceed directly to implementation specs once their body prerequisites ship.

### Occupation and the riot

An occupied room is two things. The first is that bodies begin somewhere other than a patrol route: clustered, facing each other, grouped around what a room contains rather than distributed across its floor. That costs arrangement and no new animation, so it lands whole in this plan. The second is what each body is visibly doing — drinking, eating, playing — which is a clip, and clips arrive with the body pipeline; this plan takes the arrangement and leaves a named slot for the occupation clip.

The riot is an alarm that spreads rather than a state every enemy enters at once. A blow struck within sight of an occupied body ends that body's occupation; bodies near it lose theirs shortly after, with enough delay that the wave is visible crossing the room. A fraction of the roused turn on each other rather than on the player, and an enemy attack that would reach the player also reaches any enemy in its path — which is the cheapest complete answer to a brawl, because it needs no new decision from any enemy, only the removal of the assumption that only the player can be hit.

### Children

| #   | Child                     | Focus                                                                                                        | Form          |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------- |
| 1   | The arena                 | One scene that is only the fight, and the measuring stick every later child is judged in                     | Spec-ready    |
| 2   | The ordinary blow         | Hit stop, spray raised where damage is applied, melee shake, and the kick — all inside existing shapes       | Spec-ready    |
| 3   | Where the blow landed     | A hit gains a point and a region, and every effect moves to that point                                       | Spec-ready    |
| 4   | Damage that shows         | Head and both arms accumulate; a broken arm detaches and drops what it held, a broken head kills             | Spec-ready    |
| 5   | The ways of dying         | Death treatments per cause, bone ash as a second floor material, and the deaths a kick causes                | Spec-ready    |
| 6   | The room was doing something | Arrangement instead of patrol, the riot that spreads, and enemies that can hurt each other                | Spec-ready    |
| 7   | The rest of the verbs     | Charged throw, immunity and attack while carrying a body, and what a legless skeleton does                    | Spec-ready    |

Landing order is the table order. Children 4, 5 and 7 begin only after the corresponding humanoid body children land, but their implementation shape is settled and needs no separate sketch. Child 6 remains independent for its arrangement and riot behavior; its optional occupation clip uses the shared movement set when available.

## Non-Goals

1. No change to the long-horizon half of the game. Blessings, the forge, sealed rewards, extraction, descent and the difficulty level keep working exactly as they do — they are absent from the scene this plan is judged in, which is not the same as being removed from the game.
2. No boss, no new floor, no new room kind, no procedural expansion. The measuring stick is one handmade room.
3. No move of the hand or the carried object out of the flat surface they are drawn on. Weapons held in a second hand and genuinely three-dimensional thrown parts are the same decision as what a pickup is made of, and that decision is not made here.
4. No balance work. Numbers here exist to make a blow legible, not fair.
5. No new tests. Every acceptance criterion below is judged by a person playing the arena, which is what a criterion about feel can be judged by.
6. No new part authoring, rig change, or clip table extension. What this plan needs from the body pipeline it takes by ordering that plan's children, not by doing their work.

## Acceptance Criteria

1. A scene exists that opens directly into a handmade room with no interface, no objectives, no rewards and no way down, restartable in place, and it is where every criterion below is judged.
2. Hitting one skeleton repeatedly with a bone is entertaining without any other enemy, weapon, or hazard present. This is the plan's whole bar and it is judged first.
3. A blow aimed at a head hits the head, and the arc, the spray and the floor mark all appear at the point of contact rather than under the target.
4. Every route that damages an enemy — swing, thrown weapon, blast, spike, drowning — produces spray and sound scaled by the damage, with no route producing a silent, dry hit.
5. A skeleton visibly loses an arm before it dies, and the weapon it was holding is on the floor where the arm came off, pickable.
6. A player can tell, by looking, how a body died: a head that came apart, a body cut in two, one run through, one thrown into a wall, and one blown apart are five different pictures.
7. Five minutes of fighting leaves the room visibly changed — blood and bone ash on the floor, weapons where their owners dropped them, furniture broken — and a corner where twenty skeletons died no longer looks untouched.
8. A kick throws a body far enough to matter, and a body thrown into a wall, a spike, a pit or another body produces a result the player would attempt again on purpose.
9. The room is occupied when the player arrives, and striking one body starts a visible wave that crosses the room rather than a simultaneous turn.
10. Enemies hurt each other during the riot, and a player can win a fight by standing somewhere and letting them.
11. The full game, opened normally, plays as it does today apart from the improvements above. Nothing in the long-horizon half changed behaviour.

## Execution

Perishable. This records the codebase at the time the plan was written; whoever executes a child re-checks its coordinates against live code first. Each subsection is cut when its child ships.

### Child 1 — The arena

A scene is one entry in `SCENES` in `src/app/scene/scene-router.ts` plus a hooks module beside `src/app/scene/soundstage.ts`; the play surface gets no branch. `SceneHooks` in `src/runtime/scene-hooks.ts` is the contract — `dress` runs at mount and on every restart, `onKey` takes keys before the surface does.

The room and map are JSON: `src/content/rooms/` and `src/content/maps/`, registered through `room-library.ts` and `map-library.ts`. `stage.map.json` and `main-region.room.json` are the closest models.

Two things the soundstage already works around and this scene inherits: a floor is built with four hardcoded objectives (twenty bodies, twelve walls, four side rooms, one pool) and always gets an arrival, a way down and a plinth. The soundstage moves the way down and the plinth onto a boundary cell and hides the instrument layer. Do the same rather than changing the floor contract — the tracker holds that as its own unscheduled decision under "A Room Whose Size Is Its Own".

Interface suppression: the HUD is `src/ui/hud.ts`; the soundstage's opening state shows how a scene hides layers.

### Child 2 — The ordinary blow

**Hit stop.** `world.impact` (`src/core/world/world.ts:229`) already rises on connect and decays; it currently drives only `meleeImpactPitch` in `src/presentation/scene-3d/scene-renderer.ts:287`. Add a time scale to the step in `src/core/world/step-world.ts` — a scale, not a pause, so clips resume rather than restart. Target 40–70 ms scaled by damage.

**Centralised spray.** `damageEnemy` in `src/core/damage/enemy-damage.ts:204` raises nothing today; it writes `enemy.hp` and `enemy.hurtSeconds = 0.28` only. The spray, the impact sound and the shake move here, scaled by `amount`, with `direction` (already a parameter) choosing the spray's `focus`. Then remove the per-route sprays that duplicate it: `src/core/player/melee/execute-melee.ts:141` (6 blood at the enemy centre) and `src/core/damage/area.ts:153`. Material choice is the existing `isBoned(enemy.archetype)` test from `src/core/combat/enemy-contract.ts`.

**Melee shake.** `world.shake` is written only by `src/core/damage/area.ts:373` (blast) and `src/core/projectile/spawn.ts:82` (recoil). Add a melee contribution well below the blast level. The requested increase for cannon fire, shell landing and bomb blast is the constants at those two sites plus `RECOIL_SHAKE` (`spawn.ts:26`).

**Kick.** Input is `primaryAction` in `src/core/player/input.ts`; right button is carry (`src/core/player/carry.ts`). The kick needs a third binding — check `src/runtime/surface.ts` for what is free. Mechanism is the existing `pushX/pushY` on `Enemy`, at a much larger magnitude than `stats.knockback` and with low damage. Lethal consequences of the throw are child 5.

### Child 3 — Where the blow landed

`resolveMelee` in `src/core/player/melee/resolve-melee.ts` is a pure function of `MeleeSnapshot` returning `MeleeEffect[]`; the contract is `src/core/player/melee/contract.ts`. Today `inFront` (line 30) is a dot-product cone test against `MELEE_ARC` and `sweepAhead` (line 54) collects everything inside it, nearest first.

Keep the sweep. The multi-target behaviour is deliberate and its reason is in the comment at line 46 — a blade drawn through four slimes that kills one makes the drawing disagree with the rules. What changes is that the nearest target additionally resolves a contact point and a region, and only that target gets the region multiplier; the rest take the plain damage they take today. That is the resolution of the tension between "hit exactly what I aimed at" and "one swing cuts through a doorway".

`MeleeEffect`'s `enemyHit` gains the contact point and region; `landing` stops being computed from `nearest.x/nearest.y` at the fixed heights at lines 20–23 and carries the real point instead. Consumers are `execute-melee.ts` and the arc drawing in `src/presentation/scene-3d/`.

Region geometry: the humanoid body definitions own authored region bounds (see the humanoid block bodies plan, "A body record is the visual authority"). The cheap first resolution is height plus lateral offset against those bounds and the body's authored scale in `src/content/enemies/entity-display.json`, not a mesh query.

Hurt direction: `damageEnemy` already takes `direction`. Nothing reads it for anything but death scatter today.

### Child 4 — Damage that shows

`Enemy` in `src/core/enemy/enemy-state.ts` gains per-region accumulated totals. Break threshold 60% of `maxHp` per region; multipliers head ×2, torso ×1, limbs ×0.75.

Arm break drops what the arm held — the drop tables are already in `src/core/damage/enemy-damage.ts:34` (`BONE_DROPS`) and `:46` (`SKELETON_ARMOURY`, keyed by `EnemyAppearanceId`). The armoury entry is the weapon the body is visibly carrying, so an arm break spends that entry and the death roll no longer can.

Head break kills. `DeathCause` lives in `src/core/world/world.ts`; `deathViolence` in `enemy-damage.ts:94` is the exhaustive switch every new cause must answer.

Detaching the part on the drawing side is the humanoid block bodies plan's child 6. This child begins after that production detach boundary ships; it owns the region damage, break decision and gameplay weapon drop that consume it.

### Child 5 — The ways of dying

Death treatments are the humanoid block bodies plan's child 7. This child begins after that shared movement and structural mapping ships, then selects the treatment from the cause already recorded by the rules.

Bone ash: `stainFloor` is in `src/core/feedback/run-feedback.ts`, the grid is `src/presentation/scene-3d/floor-stains.ts`, and the two call sites are `enemy-damage.ts:181` and `src/core/world/step-world.ts:122` (particle landings). Ash is a second material in the same channel, not a floor decal — the tracker entry "What A Fight Writes On The Floor" states that boundary and it holds.

Kick deaths need a new cause on `DeathCause` and a speed threshold read where `pushX/pushY` resolves against terrain, in `src/core/floor/movement.ts` or the enemy chassis step (`src/core/enemy/chassis.ts`). A body carrying enough momentum into a blocking cell, a spike, or a pit dies of it.

### Child 6 — The room was doing something

Arrangement is map and room content: `MapCastKind` and the room JSON schema in `src/content/rooms/room-schema.ts` decide what stands where. Clustering and facing may need a room-level field for a group.

`EnemyMind` in `src/core/enemy/enemy-state.ts:22` is five exclusive states; `idle` and `wander` already exist. The riot is a new transition out of `idle`, not a new state. `provoke` in `src/core/damage/enemy-damage.ts:236` is the existing single-enemy version and is bounded by `DISENGAGE_RANGE`; the wave is that with a radius and a delay.

Enemy-on-enemy damage: the three attack families are behind contracts in `src/core/enemy/behaviors/`, and each returns typed effects. What has to change is the candidate set they are given — today the player is the only target. Route the result through `damageEnemy` so everything child 2 centralised applies to it unchanged.

### Child 7 — The rest of the verbs

**Charged throw.** `primaryAction` in `src/core/player/input.ts:23` resolves a throw instantly and sets `swingResolved = true` at line 35. A held charge needs a release path and a launch speed read from the hold, applied in `src/core/player/throw.ts` and `src/core/projectile/spawn.ts`.

**Hostage.** `damageHeldHostage` in `src/core/damage/enemy-damage.ts:261` already absorbs damage on the player's behalf and returns the salvage. Full immunity while carrying, and the ability to swing while carrying, are changes in `src/core/damage/player-damage.ts` and the input gate.

**A legless skeleton.** Hop, crawl, being carried, and struggling while carried use the humanoid block bodies plan's child 7 movement set. This child supplies the gameplay state and transitions that select those clips; carrying already exists in `src/core/player/carry.ts` gated by `canCarry` in `src/core/combat/enemy-contract.ts`.

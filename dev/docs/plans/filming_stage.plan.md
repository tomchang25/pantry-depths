# The Filming Stage

Goal-Executable: yes

Every acceptance criterion below is judged by opening the thing and looking, or by playing it, which is one of the three ways a criterion is already expected to be judged. Nothing in this document parks a decision for its own execution to take.

## Goal

Give the project a room that exists to be filmed in: a small stage where a person places the bodies they want, walks in, and kills them on camera. Today the only way to get one particular body standing in one particular place is to restart runs until the floor draws one, and the one switch that holds a body still also freezes the timers that make a hit read — so the body that was going to be filmed dying is lit white and stuck in whatever pose it was interrupted in.

## Requirements

1. Holding bodies still and stopping time are two different requests and become two switches. A person filming wants bodies that do not fight back but still flinch, bleed, fall, and fade; a person comparing two renders wants a picture that does not move at all. One switch cannot serve both, and the one that exists serves only the second.
2. Under the switch that holds bodies still, everything that is a consequence of what the player did keeps happening — the hit flash fades on its own schedule, knockback carries, a killed body plays its death through. Only what the body itself decided stops.
3. A room may declare the bodies standing in it and where each one stands, as authored content, in room-local coordinates so the declaration travels with the room whichever slot it lands in. This is the one part of this plan that changes what a room is, and it earns that because where a body stands is a statement about a dungeon; how a session is frozen never is.
4. The names of the body kinds are declared by the content layer and the runtime's table is bound to them, so the two cannot drift. The content layer may not reach the runtime that owns those bodies, and the vocabulary this same content already declares for tile kinds and room roles was created under exactly this constraint. A test cannot hold the two lists equal here, because tests may not reach the half that owns the runtime table.
5. That cast is painted, not typed. The surface that already paints a room's cells gains the bodies as a second thing to paint with, over the same grid — a separate grid would ask an author to keep two pictures aligned in their head.
6. A stage ships as a starting point and is thereafter edited like any other room. What makes it a stage is not its shape, which the author owns, but that arriving on it is staged: the same arrival cell facing the same way every time, nothing in the room that was not placed, no way to descend by accident, bodies held still on arrival, and one key that clears the screen of development furniture.
7. A take can be reset without moving the person filming, and which body kind that reset stands up is chosen from a held selection the screen shows. Restarting the run already reproduces the staged state, but it also returns the player to the arrival cell — and the common act while filming is standing still and wanting the bodies alive again, which restarting cannot express. The selection is shown before it is used, because a person filming needs to know which body is about to appear rather than discover it after it has.

## Design

### Two kinds of freeze

One switch today stops the whole enemy pass. That pass is also where every per-body timer counts down, so a held body keeps whatever state it was in at the moment the switch was thrown, permanently: a hit flash that never fades, which is the white body; a strike pose that never releases; a stun that never ends; a cooldown that never returns.

The two switches divide it as follows.

**Mind freeze** stops what a body decided: choosing where to go, moving, turning, starting an attack, running a wind-up already committed to, and a charge already in flight. It also stops reinforcements arriving and the floor's emplacements firing, because a stage that fills itself is not a stage. It does not stop the per-body timers, and it does not stop knockback — both are consequences of what the player did, and a body that will not flinch when struck is exactly what makes the current switch useless for filming.

**World freeze** keeps the current switch's behaviour unchanged, under a name that says what it does. A hit flash stuck lit under world freeze is correct rather than a defect: time is stopped, and a flash is a timer.

The two are independent. Both on is legal and means what it says. The instrument panel carries a row for each, and the screenshot harness's frozen-crowd scene asks for a still frame and therefore asks for world freeze.

**Why a committed charge stops with the mind rather than with the world:** a charge is the body spending an action it chose to spend. A person filming who freezes a room mid-charge wants the lane to stop advancing on them; if it kept running it would be the one decided behaviour that ignored the switch.

### A cast a room can declare

A room may hold a cast: a list of bodies, each naming its kind and the cell inside the room it stands on. Cells are room-local — the top-left interior cell is the origin — so a room carrying a cast keeps that cast wherever a map puts the room.

- **A cast is placed exactly where it says**, before anything random is placed, and it ignores the distance-from-arrival rule that the random crowd obeys. Placing a body at arm's reach of where the player lands is the whole point of a stage; the distance rule exists to stop a floor from opening with a swing, which is a rule about floors nobody authored.
- **A cast counts against the room's crowd cap.** The cap is the room's promise about how many bodies stand in it, and a cast that pushed past it would make the promise a lie. A room whose cast already meets its cap gets no random starting bodies and no reinforcements until one dies.
- **A room may declare a cast and no crowd at all**, which is the stage: nothing arrives that the author did not place.
- **A cast cell that turns out to be unwalkable is not refused.** What is refused is what the file alone can decide: a cell outside the room's interior, and two bodies on one cell. Whether a cell is floor is a property of one assembly for a carved room, and for an authored room a body standing in water drowning on arrival is a thing an author may want to film.

The names of the body kinds are a content-layer vocabulary that names the runtime's own kinds and invents nothing, in the same way and for the same reason as the nine tile kinds and the four room roles already declared beside them. The runtime's table is then typed by that vocabulary, so adding a body to one without the other does not compile.

### Painting a cast

The room surface's cell grid gains a second layer. The palette gains one swatch per body kind plus an eraser, and which group the current brush belongs to decides which layer a stroke writes: a tile brush paints cells, a body brush places or clears a body. A cast body is drawn on the cell it stands on, over whatever the tile layer shows there.

A room whose structure is not authored still gets the grid, with a flat backdrop instead of painted cells, because a cast is not a property of authored cells and a room that is open floor throughout is exactly the room a stage wants.

The floor diagram beside the form marks each cast body at its cell, so the assembled floor confirms the cast landed where it was painted.

### The stage

A stage map and a stage room ship as a starting point: seven cells square, which is five by five of floor inside the wall ring, open throughout, holding no crowd and no scatter. It is thereafter edited like any other room, including its extent — nothing below depends on it staying that size.

Arriving on a stage is dressed, because none of the following is a property of a room and all of it ruins a take:

- **The arrival is fixed**, at one cell facing the room, rather than drawn at random from the room's cells.
- **The way down and the plinth are moved outside the walls**, where they can be neither seen nor reached. The plinth otherwise lands on the arrival cell whenever no room on the floor holds one, and standing near the way down with the floor's main task met descends — which a person filming a fight will trip, because the main task is a body count.
- **Mind freeze is on**, so a cast stands where it was placed until the person filming decides otherwise.

**Restarting a run re-runs the dressing**, so the one key that already exists for starting over means "reset this take" on a stage: the cast returns to where it was painted, the arrival is the arrival again, and the bodies are held still again. Mind freeze is therefore not carried across a restart the way god mode deliberately is — a cheat is a property of the session, and being frozen is a property of the staged scene.

**One key resets a take without moving anyone.** It clears whatever is still standing and places the cast again, leaving the player exactly where they are, because standing still and wanting the bodies alive again is the commonest thing a person filming does and restarting cannot say it.

**Two more choose what that key places.** They step a held selection backwards and forwards, and the instrument panel shows what is held, so filming every kind of body dying in turn is choose, place, kill, choose the next — rather than a trip back to the editor per kind. The selection has eight states, not seven: as authored, plus the seven kinds. As authored is where it starts and means every body keeps the kind its room declares, so a mixed cast is the default and overriding it is a deliberate act with a way back; a chosen kind means every body placed is that kind, standing on the cells the room declares. It is session-only and never touches what the room declares.

The selection is shown rather than applied on the spot, and stepping it moves nothing already standing. What it decides is the next placement, which is what lets a person step through the list looking for the right body without destroying the shot they are in.

This dressing is keyed to the stage by name, in the half that owns the demo. It is deliberately not a field on a room or a map: a room describes a dungeon, and the arrival being fixed and the bodies being held is a statement about a session. If a second stage is ever wanted, the name becomes a list; if the dressing is ever wanted on an ordinary map, it becomes an address the game is opened at. Neither is built now.

One key hides the whole instrument layer — the readouts and the panel together — so a take carries no development furniture. It is a key rather than a control, for the reason every other switch here is a key: the pointer is locked for all of play, and a control that cannot be clicked is not a control.

### Children

| #   | Focus                                                               | Handoff                                                                  |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 01  | Two kinds of freeze, and the harness scene that wants the other one | `filming_stage_01_two_kinds_of_freeze.implementation_spec.md`            |
| 02  | A cast a room can declare, and the floor that honours it            | `filming_stage_02_a_cast_a_room_declares.implementation_spec.md` (draft) |
| 03  | Painting a cast on the room surface                                 | `filming_stage_03_painting_the_cast.implementation_spec.md` (draft)      |
| 04  | The stage, its dressing, and the clear screen                       | `filming_stage_04_the_stage.implementation_spec.md` (draft)              |

Landing order is 01, 02, 03, 04. Child 01 is independent of the rest and lands first because it is the one thing currently producing a wrong picture. Children 03 and 04 both depend on 02; 04 depends on 01 for the switch it turns on.

Every child goes straight to an implementation spec: each has an `Execution` subsection below that answers its shape, which is what `dev/standards/work_lifecycle.addendum.md` requires for skipping a sketch.

The three later specs were written in one batch ahead of their landing order and carry `Status: Draft implementation spec` per `dev/foundation/core/workflows/implementation_spec_standard.md`. They are planning artifacts until promoted: each is re-read against the live codebase, its coordinates verified or remapped, and its status line removed immediately before it is executed. Nothing in them carries an unresolved decision — the draft status records only that earlier children will move the ground under them.

## Non-Goals

1. No new development tool. The cast is painted on the surface that already paints rooms; a second tool would be a second place to learn.
2. No recording, camera path, replay, or cinematic system. What this produces is a place to point a screen recorder at.
3. No content vocabulary for session state. Freeze, god mode, and the hidden instrument layer stay out of the room and map contracts.
4. No change to what the existing switch does. It gains a name that says what it always did and a second switch beside it; its behaviour is preserved exactly.
5. No authored arrival, exit, or plinth position in the room contract. The stage's dressing is demo-side and named after the stage.
6. No test file for the demo half, and no exemption sought from the guard that enforces it.
7. No cast on a map. A map places rooms; what stands inside one is the room's.

## Acceptance Criteria

1. Striking a body under mind freeze flashes it and the flash fades on its own, the body is pushed by the blow, and a killed one plays its death through — while it neither moves, turns, nor strikes back, and nothing new arrives.
2. Under world freeze the picture holds still exactly as it does today, and a body struck immediately before the switch was thrown stays lit, which is stopped time rather than a defect.
3. The screenshot harness still produces a still frame for its frozen-crowd scene.
4. A room saved with a cast still has it after the tool is reloaded, and after a save made from either surface — the cast is not silently dropped by a round trip.
5. A cast painted on a room stands where it was painted when the floor is assembled, in every slot that room can land in, and the floor diagram shows it there.
6. A room whose cast meets its crowd cap receives no random bodies and no reinforcements.
7. A cast placed outside the room's interior, or two bodies on one cell, is refused before saving, and the refusal says which cell.
8. Entering the stage puts the arrival at the same cell facing the same way every time, with nothing standing in it but the cast, with no plinth or stairway visible, and with bodies held still.
9. Walking the stage after killing enough bodies to meet the floor's main task does not descend.
10. One key clears the readouts and the instrument panel from the screen, and returns them.
11. Restarting on the stage returns the cast, the arrival, and the held-still bodies to the staged state, whether or not the bodies had been released first.
12. One key returns the cast to where it was painted without moving the player, and two more step a shown selection through "as authored" and the seven body kinds in both directions, wrapping — with the selection deciding which body that key stands up, and nothing changing what the room file declares.
13. Stepping the selection changes nothing already standing on the floor.
14. No test file is added, and the aggregate verification gate passes.

## Execution

Perishable: this records the codebase on 2026-08-02. Re-check every coordinate against live code before acting on it.

Two constraints govern all four children. Nothing under `test/` may import `@/demo/` or `@/presentation/` — `test/unit/repository/demo-half-is-untested.test.ts` fails the suite over it, and its exempt list does not grow. And `src/content/` may reach only `src/content/` and `src/core/`, which is why child 02 declares a vocabulary rather than importing one.

### 01 — Two kinds of freeze

- `world.enemiesPaused` (`src/demo/world.ts:419`, initialised line 812) is the single switch. It becomes two fields; keep one of the names honest rather than reusing the old one for the new meaning.
- The root cause of the white body: `decayTimers` (`src/demo/enemy-ai.ts:72`) is called from `stepEnemies` (`src/demo/enemy-ai.ts:537`), and `stepEnemies` is skipped wholesale by the pause check at `src/demo/simulation.ts:1003`. `hurtSeconds` is set to 0.28 at `src/demo/world.ts:1277` and read by the scene at `src/demo/demo-scene.ts:671`, `:684`, `:970`, and `:1233`. The same skip strands `stunSeconds`, `attackPoseSeconds`, `attackCooldown`, and `repathSeconds`.
- Under mind freeze, `stepEnemies` still runs its head — `enemy.moving = false`, `decayTimers`, `applyPush`, the `unstick` settle — and returns before `stepCharge` (line 548), `stepWindup` (line 564), and `stepMind` (line 575). Reinforcement arrival (`simulation.ts:1005` onward) and `stepMortars` also stop.
- Under world freeze, the block guarded at `simulation.ts:1003` is skipped exactly as today.
- `src/demo/demo-dev-overlay.ts` carries one chip per row; `enemiesPaused` is rendered at line 114. It gains a second row, and `DemoDevOverlayModel` (line 18) a second field.
- `src/app/debug/hud-attack-workbench.ts:422` builds a literal `DemoDevOverlayModel` and line 520 lists its rows for the panel; both need the new field or typecheck fails.
- Keys are handled in `src/demo/demo-surface.ts`; `p` is at line 935. Free single keys today: `c`, `f`, `h`, `i`, `j`, `o`, `u`, `v`, `x`, `y`, `z` and the digits. `w`, `a`, `s`, `d`, `r`, `m`, `t`, `k`, `n`, `b`, `l`, `p`, `g`, `[`, `]`, Tab and Escape are taken.
- `dev/tools/capture/scenes.mjs`, scene `crowd-frozen`, presses `p` for a stable frame; it moves to whichever key ends up meaning world freeze. Its note text says "enemies paused" and should say what it now means.

### 02 — A cast a room can declare

- `src/content/maps/room-schema.ts` is the owner. Follow the pattern its header comment states at lines 14-19 and that `MAP_TILE_KINDS` (line 24) and `MAP_ROOM_ROLES` (line 51) already follow: declare the vocabulary here, naming the runtime's own kinds.
- The seven kinds are the keys of `ENEMY_ARCHETYPES` in `src/demo/enemy-archetypes.ts:407`: `slimeGreen`, `slimeBlue`, `slimeRed`, `swordsman`, `hammerman`, `javelineer`, `crossbowman`. Do not reuse `EnemyId` or `EnemyAppearanceId` from `src/content/combat/enemies.ts` — those are the turn-based game's table and a ten-value appearance list, and neither lines up with these seven.
- Bind the runtime to it: `DemoArchetypeId` (`src/demo/enemy-archetypes.ts:28`) becomes an alias of the content type, and `ENEMY_ARCHETYPES` is annotated as a record keyed by it, so a kind added to one half and not the other fails typecheck. The demo layer may import content; the reverse is what forces this direction.
- **`parseRoomSource` must return the cast** (`src/content/maps/room-schema.ts:497`). `dev/tools/authoring/authoring-api.ts:164` writes the parser's return value verbatim into the file, so a field the parser drops is a field the next save deletes.
- The parse-time refusals are bounds and duplicates only. Interior bounds are `1 <= x <= width - 2` and the same for `y`, matching what `paintRoom` (`src/demo/maze.ts:565`) actually paints.
- Placement goes in `populateFloor` (`src/demo/world.ts:704`), before the spawn-pool loop at line 735. Room-local to world coordinates is `room.minX + x` and `room.minY + y`; `DemoRoom` carries `minX`/`minY` at `src/demo/maze.ts:97`. `createEnemy(world, x, y, archetype)` at line 662 already takes an explicit archetype — the third parameter is the whole placement primitive.
- The random starting count is computed at line 733 against `crowdHere(world).cap`; subtract the cast already standing in that room so the cap holds. `spawnReinforcement` (line 879) already measures against `world.enemies.length`.
- `map-resolver.ts`, `map-schema.ts`, `room-library.ts`, and `maze.ts` pass `MapRoom` through and need no change. No test file references `room-schema`; `test/unit/dev/tools/authoring/api-contract.test.ts` is the only authoring test and should be re-run rather than edited.

### 03 — Painting a cast on the room surface

- `src/app/debug/room-workbench.ts` owns the grid. The painter is at line 261 onward: `brush` is a module-level `MapTileKind` at line 252, the palette is built around line 288, and `paint` at line 307 recolours one button in place and asks only for a preview rebuild — the comment at lines 262-268 explains why the form must not be rebuilt per stroke, and that constraint holds for the cast layer too.
- `dress` (line 301) sets `--cell` from `TILE_COLOURS`; a cast marker rides on the same button, so give it a separate visual channel rather than replacing the tile colour.
- The draft is a loose `Record<string, unknown>` (`RoomDraft`, line 52) held through `asRecord`, so an unedited cast survives in the draft; what strips it is the parser, which child 02 fixes.
- `TILE_COLOURS` is exported from `src/app/debug/floor-preview.ts:30` precisely so the palette and the diagram cannot disagree; a cast marker colour set belongs there for the same reason. The diagram is drawn in the same file.
- `src/app/debug/room-workbench.css` — check whether the cell styles live there or in `debug.css` before adding the marker style.

### 04 — The stage, its dressing, and the clear screen

- New content files: `src/content/rooms/stage.room.json` (id `stage`, 7 by 7, `structure: { "generated": "open" }`, no crowd, no scatter) and `src/content/maps/stage.map.json` (name `stage`, 7 by 7, `fixed` holding the main slot, empty pool, draw 0). Both libraries glob their directories — `src/content/maps/room-library.ts:17` and `map-library.ts:16` — so no registration edit exists. The file name must equal the declared name; both libraries refuse a mismatch.
- New module for the dressing, in the demo half, holding the stage's name as a constant beside a short comment saying why it is named rather than inferred — `src/demo/maps.ts:17` is the existing precedent for that shape.
- The dressing rebuilds the maze record rather than mutating it: `DemoMaze` is a `Readonly` type (`src/demo/maze.ts:184`), so spread it and overwrite `entrance`, `exit`, and `altar`, then set `world.player.x/y/angle` and `world.altar.x/y` to match. Putting `exit` on a boundary cell is what makes the descent check at `src/demo/simulation.ts:1040` unreachable; `validateDrawnFloor` and `validateDrawnWalk` have already run inside `buildDemoFloor` by then, so moving it afterwards refuses nothing.
- Call it from both places a world is built in `src/demo/demo-surface.ts`: after `mountDemo`'s construction, and inside `restart` (line 704), so `R` reproduces the same staged shot. `restart` carries god mode across deliberately (lines 701-707); the freeze is not added to that carry.
- The reset key shares one operation with the placement child 02 adds to `populateFloor`: empty `world.enemies` and place the room's cast again. The selection is session state beside the world, read at placement and applied per body as it is placed. Neither writes anything back to `src/content/`. `MOVEMENT_KEYS` (`src/demo/demo-surface.ts:98`) binds only `wasd` and the arrows, so the stepping keys are free.
- Clearing standing bodies for a reset empties the list rather than routing through `killEnemy` (`src/demo/world.ts:1167`) — a reset is not a death and should leave no corpse, no drop, and no stain. This is the opposite choice from the existing kill-everything key (`src/demo/demo-surface.ts:729`), whose whole point is that it does go through the ordinary exit.
- The instrument layer is two mounted elements in `mountDemo`: `hud` (line 552) and `dev` (line 555), appended at line 564. Hiding is a class on the surface element rather than unmounting either, so the state survives and nothing is rebuilt.
- `import.meta.env.DEV` already gates the published `window.demoWorld` handle at line 618; the stage dressing needs no such gate because a map is data and the debug hub is the only thing that links to it.

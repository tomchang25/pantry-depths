# Run Readout

Parent Plan: none (standalone spec)

## Goal

Give the player the numbers, the map, and the damage feedback needed to price an encounter before taking it, and give a finished run an ending it can be seen and restarted from. The game currently ships complete deterministic rules and a first-person renderer with no interface over either, so every combat decision is made blind and a dead run is indistinguishable from a hang.

## Summary

`src/ui/` contains nothing but a `.gitkeep`, and the only code that reads the run outcome is a single guard in `TurnRunner.submit` that silently refuses input once the run is no longer active. A player cannot see their own health, cannot read the enemy they are facing, cannot tell how much a hit cost them, and gets no signal at all when they die.

This change adds a plain-DOM overlay over the existing canvas surface, driven by a pure derivation over the settled snapshot plus the semantic events that produced it. It adds no game state and changes no rule. Four surfaces land: a player status readout, a faced-enemy panel with a health bar and inline attack and defense icons, a fully revealed minimap of the current floor, and a terminal surface with restart.

The derivation is a pure function so that it can be unit tested. This project has no jsdom layer and `dev/agent_rules/test_operations.md` places interface feel in the manual-playtest boundary, so logic left inside DOM modules is logic with no automated coverage at all. That constraint, not tidiness, is why the view model exists as a separate module.

Two facts shape the design. First, everything displayed except one value is already carried by `RunSnapshot` and `RunWorld`, so the readout is a projection rather than a second source of truth; the exception is the deepest floor a run reached, which is not derivable because stairs are bidirectional. Second, damage numbers cannot come from a snapshot at all — a settled snapshot says the player is at 84 health but not that they just lost 6, and two identical consecutive retaliations are indistinguishable — so the runtime notification carries the semantic events alongside the snapshot and the transient part of the readout is event-driven.

The minimap reveals the entire current floor rather than tracking exploration. This is a deliberate product decision: it removes corner ambushes and makes routes plannable, at the cost of discovery tension. It also keeps the change small, because a discovered-cell set would be new run-owned state with reset and lifetime obligations, while a full reveal falls out of world data intersected with per-entity active state.

Once landed, a player can read their own stats and keys at all times, see a named enemy's health bar and numbers before committing, watch each hit's cost appear as a number, see the whole floor with their own position and facing, and restart from a summary after dying or leaving.

## Requirements

1. Current health, maximum health, attack, defense, the three key counts, and the current floor are visible at all times, because the entire game is an HP economy and none of its decisions can be made without them.
2. Facing an enemy names it, shows its health, attack, and defense as explicit numbers with attack and defense carrying distinguishing icons, and shows the health proportion as a bar. The bar accompanies the numbers rather than replacing them, because a bar alone cannot answer how many hits remain.
3. Every point of health the player loses appears as an explicit number at the moment it is lost, and a retaliation absorbed entirely by defense is reported as such rather than passing silently. The zero case is the player's direct proof that a defense upgrade changed later costs.
4. A run that reaches a terminal outcome says so, reports what the run achieved, and offers a restart in one keyboard-reachable action. Today a terminal outcome is indistinguishable from a hang.
5. The player can see the layout of the current floor, including where enemies, doors, keys, stairs, and the exit are, without having walked into them.
6. Nothing in this change becomes gameplay authority, and no clock, randomness, or interface state enters `src/core/`. Determinism is the project's load-bearing property.
7. Every value and state stays distinguishable without relying on color, and gameplay keys and focused controls do not steal each other's activation.

## Relational Context

- `.dependency-cruiser.cjs` forbids `src/runtime/` from importing `src/ui/`, and restricts `src/ui/` to importing `ui`, `core`, `content`, and `runtime`. The update path must therefore be dependency-inverted: `TurnRunner` declares an optional callback, `src/ui/` implements rendering, and `src/app/game-surface.ts` wires them. Any direct import from runtime to ui fails `npm run check:boundaries`.
- `TurnRunner` is the single command seam and remains the sole authority for what resolves next. The readout is a read-only consumer: it must never call `GameSession.dispatch` or influence input locking, buffering, or held-forward repeat.
- `TurnRunner.#resolve` already holds both `result.snapshot` and `result.events`. The new notification carries both. It fires for accepted and rejected commands alike; a rejected command yields the unchanged snapshot and an empty event list.
- `GameSession` owns the run snapshot. The readout reads it through the notification and through `getSnapshot()` for the initial paint; it never caches a second copy as truth.
- `src/core/run-state.ts` owns the `max(0, attack - defense)` rule through `calculateDamage`. The faced-enemy query returns both directions' per-hit damage so the interface never recomputes the formula. `calculateCombatProjection` in `src/core/combat.ts` already computes `hitsToKill` and `totalCost`; it must not be imported here, because those values are the expected loss this design deliberately withholds.
- `inspectMoveTarget` in `src/core/run-state.ts` is currently private and already answers what occupies the faced cell. The new exported query wraps it rather than duplicating the terrain, occupancy, and entity-active checks.
- `assembleEntity` in `src/content/floor/floor-catalog.ts` writes `appearanceId: archetype.appearanceId` onto the built entity. Appearance is not identity — several archetypes deliberately share one appearance — so the archetype identifier must also be carried for the name to be recoverable. The display string stays in `ENEMY_ARCHETYPES`; `WorldEntity` carries an identifier only.
- The deepest floor reached is session-scoped state owned by the mounted surface, not by core. Per `dev/foundation/core/standards/runtime_ownership.md` it qualifies as controller state because it is discarded with the session and never persisted. It must be reset when a run restarts.
- `src/app/main.ts` currently constructs `GameSession` and passes the instance into `mountGameSurface`, so nothing downstream can start a second run. The parameter becomes a factory; `main.ts` remains the single wiring point.
- `GamePresentation.present` with a `settle` intent rebuilds the render scene and reseats the rest camera, so restart does not need to dispose and rebuild the presentation. Disposing it would re-run `loadPresentationImages`.
- `game-surface.ts` registers `keydown` on `window`. Once a focusable control exists, Space and Enter reach both that control and the command path. The handler must ignore events originating from interactive elements.
- The overlay sits inside `.game-surface`, which is already `position: relative` with `isolation: isolate`. The canvas derives its backing-store size from its own bounding box, so the overlay must be absolutely positioned and must not change the canvas box.
- The canvas owns `pointermove` for the view lean and `pointerdown` for the click-to-use action. The overlay root must not intercept them; only genuinely interactive descendants take pointer events.

## Scope

### Included

- A pure view-model derivation over `RunWorld`, `RunSnapshot`, semantic events, and the deepest-floor value.
- Player status readout, faced-enemy panel with health bar and attack/defense icons, fully revealed floor minimap, transient damage feedback, and a terminal surface with restart.
- A narrow exported faced-enemy query in core, and an archetype identifier carried onto built enemy entities.
- A settled-notification callback on `TurnRunner`, and session-factory plus restart wiring in the app layer.
- Focused unit tests for the derivation, the core query, and the notification.

### Excluded

- Exploration, fog, or discovered-cell tracking. The current floor is fully revealed.
- Solution routes, suggested paths, expected combat loss, hits-to-kill, or any computed advice.
- The leaving sequence: control lockout, opening passage, forward camera move, and fade.
- Remaining event feedback: side-threat direction cues, breakable-wall crack stages, hot-spring lighting, upgrade number animation, and door-failure presentation.
- Elapsed run time in the summary, which would require a clock the deterministic core must not gain.
- Any amendment to `pantry_feel.plan.md`, which is knowingly stale and reconciled separately.
- A jsdom or browser test layer for the interface.

## Files to Change

| File                                    | Change Size | Purpose                                                                           |
| --------------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `src/core/run-state.ts`                 | Small       | Export a faced-enemy query; add an optional archetype identifier to `WorldEntity` |
| `src/content/floor/floor-catalog.ts`    | Small       | Carry the archetype identifier onto assembled enemy entities                      |
| `src/runtime/turn-runner.ts`            | Small       | Add the settled-notification callback carrying snapshot and events                |
| `src/ui/hud-view.ts`                    | Large       | Pure derivation of the entire view model; owns all readout logic                  |
| `src/ui/hud-overlay.ts`                 | Medium      | Overlay root, player status, enemy panel, damage feedback, lifecycle              |
| `src/ui/floor-minimap.ts`               | Medium      | Renders the revealed floor grid and the player marker                             |
| `src/ui/run-outcome-surface.ts`         | Small       | Terminal summary panel and restart control                                        |
| `src/ui/hud.css`                        | Medium      | Overlay layout, health bar, minimap grid, terminal panel                          |
| `src/app/game-surface.ts`               | Medium      | Wire the overlay, own deepest-floor state, restart, keydown guard                 |
| `src/app/main.ts`                       | Small       | Pass a session factory instead of an instance                                     |
| `test/unit/ui/hud-view.test.ts`         | Large       | Derivation coverage                                                               |
| `test/unit/core/run-state.test.ts`      | Small       | Faced-enemy query coverage                                                        |
| `test/unit/runtime/turn-runner.test.ts` | Small       | Notification coverage                                                             |

## Execution Outline

1. Add the archetype identifier to `WorldEntity` and populate it in `assembleEntity`, then export the faced-enemy query from `src/core/run-state.ts` built over the existing private `inspectMoveTarget`. Cover the query's enemy, non-enemy, and empty-cell cases. This lands first because the derivation cannot be written or tested without it.
2. Write `src/ui/hud-view.ts` as a pure function and cover it. This is the largest test surface and the only place with branching logic, so completing it before any DOM work means the remaining risk is layout.
3. Add the settled notification to `TurnRunner` and assert it fires for both accepted and rejected commands.
4. Build the three DOM modules and the stylesheet against the view model, keeping them free of derivation logic.
5. Wire `src/app/game-surface.ts`: mount the overlay, own and update the deepest-floor value, add the keydown guard, and implement restart through a session factory; update `src/app/main.ts` to pass one.
6. Run `npm run verify`, then confirm by playing that the overlay does not break the pointer lean or click-to-use and that restart produces a genuinely fresh run.

## Implementation Notes

**`src/ui/hud-view.ts`** — The view model is flat and render-ready: no DOM module should compute a percentage, resolve a name, or decide whether a panel is shown. Derive the enemy name by looking the archetype identifier up in `ENEMY_ARCHETYPES`; fall back to a neutral label rather than throwing if an entity carries no identifier, because non-enemy combat entities such as the breakable wall also have combat capability. Minimap content comes from world entities filtered to the current floor and intersected with per-entity active state, so opened doors, collected keys, and defeated enemies disappear with no bookkeeping. Damage feedback derives from `entityRetaliated` events only; a zero-damage retaliation is the blocked case and must produce a distinct state rather than an absent one.

**`src/ui/hud-overlay.ts`** — Damage feedback is transient while everything else is a projection, so the overlay needs a small timer to clear it. Repeated retaliations should extend the current display rather than replaying its entrance, matching the existing blocked-move message behavior in `game-surface.ts`. Do not announce continuous presentation noise through a live region.

**Attack and defense icons** — Inline SVG, drawn in the module rather than loaded as assets, consistent with the project's rule that environment and interface surfaces ship no image file. They accompany their numeric values and carry accessible names; they are never the only carrier of meaning.

**`src/app/game-surface.ts`** — Restart replaces the session, resets the deepest-floor value, presents a `settle` intent against the fresh snapshot, and constructs a new `TurnRunner` so held-input and buffered-command state resets with it. The presentation instance is reused. Keep the existing rejection-message behavior untouched.

**Health bar** — CSS-driven from a proportion in the view model. Attack and defense icons are SVG; the bar is not, because a proportional width is a layout concern and does not need vector geometry.

## Edge Cases

| Case                                                                         | Expected Handling                                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Facing a breakable wall, which carries combat capability but is not an enemy | Enemy panel shows the neutral label with its real numbers; no crash from a missing archetype identifier |
| Facing an empty cell, a wall, a door, or a stair                             | No enemy panel is shown at all                                                                          |
| Player attack cannot exceed enemy defense                                    | Explicit cannot-penetrate state, distinct from a normal panel and readable without color                |
| Retaliation fully absorbed by defense                                        | Reported as blocked with an explicit zero, not silently omitted                                         |
| Two enemies adjacent, both retaliating in one tick                           | Each retaliation is accounted for; the readout does not show only the last                              |
| Run ends on a floor shallower than the deepest reached                       | Summary reports the deepest floor reached, not the ending floor                                         |
| Restart after death                                                          | Every run-owned value resets, including deepest floor, keys, opened doors, and defeated enemies         |
| Reduced motion enabled                                                       | Transient feedback still conveys its number without motion                                              |

## Acceptance Criteria

1. Health, maximum health, attack, defense, the three key counts, and the current floor are visible and correct after every accepted action.
2. Facing an enemy names it, shows current and maximum health, attack, and defense as numbers alongside a proportional health bar and distinguishing attack and defense icons, and shows an explicit cannot-penetrate state when the player's attack cannot exceed its defense; facing anything else shows no enemy panel.
3. A retaliation that costs health shows the amount lost, and a retaliation absorbed entirely by defense is reported as blocked rather than passing silently.
4. The minimap shows the whole current floor with the player's cell and facing, and reflects opened doors, collected keys, and defeated enemies without any separate bookkeeping.
5. Reaching zero health and leaving through the exit each present a surface reporting the run, and a restart reachable by keyboard alone begins a fresh run with every run-owned value reset, including the deepest floor reached.
6. Every value and state above remains distinguishable with color unavailable.
7. Gameplay keys do not activate a focused control, a focused control does not issue a gameplay command, and the overlay does not intercept the pointer interactions the canvas owns.
8. The view derivation is unit tested without a DOM, and the DOM modules carry no logic those tests cannot reach.

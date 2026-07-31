# The Pause Screen Can Carry A Roster

Parent Plan: `pause_screen_blessings.plan.md`

## Goal

Give the full-surface overlay a roster: an ordered list of rows, each carrying a glyph in its own colour, a name, a description, and whether the run holds it. Pausing then lists the distinct blessing tier instead of showing nothing but a title and two key hints, and the descriptions the interface already computes become readable without a pointer.

## Summary

Pausing today shows an eyebrow, a title, two key hints and an action. Everything the interface knows about a blessing — its name, its colour, the sentence saying what it does — is computed for the play-time bar and reachable only by hovering a glyph, which the run's locked pointer makes impossible for the whole of play. The overlay already carries `stats` and `rewards` as structured parts, so the shape for a third part exists; what is missing is the part itself.

This child opens that shape and proves it with the tier the pause screen can already answer for. `DemoHudOverlay` gains an optional roster of rows. The HUD renders them in the overlay panel, between the objective line and the controls, using the existing `demo__overlay-*` naming. The paused branch of the surface's overlay model fills the roster from the distinct blessing catalogue, every entry listed whether owned or not, so an unowned row is dimmed rather than absent. The HUD workbench feeds itself a hand-written roster so the screen can be judged there without playing to a pause.

The result: pressing Tab lists the five blessings that never repeat, each with what it does, in a panel that is the same height whether the run holds none of them or all five. The four that stack are still missing, and that is Child 02's job — this child is the container and one tier's worth of proof that it holds its shape.

## Relational Context

- `demo-surface.ts` reads `bless.ts` and writes a `DemoHudModel` into `demo-hud.ts`. The HUD is a pure renderer of immutable display data and never reads the world; the roster arrives already resolved, exactly as `blessIcons` and `rewards` do.
- The overlay model is rebuilt on every HUD refresh, so the roster is derived per frame and owns no state. Nothing about the pause toggle, the pointer lock, or the simulation changes.
- `DemoHudOverlay.roster` must be optional. `src/app/debug/hud-attack-workbench.ts` builds a `DemoHudModel` by hand and a newly required field breaks its compile; the run-end overlays and the title screen do not carry a roster either.
- The play-time bar's `DemoHudBlessIcon` and `createHudModel`'s construction of `blessIcons`, including the synthetic Vitality entry, are not touched. The roster is a second, independent derivation from the same catalogue — a wrong shape here would be making the bar and the pause screen share one row type, which would force the bar to carry and ignore fields it has no use for.
- The overlay panel appends a fixed set of child elements once at mount and only fills them per update. A new part is a new element inserted into that fixed order, not a node created per update.

## Scope

### Included

- An optional roster type and field on `DemoHudOverlay`.
- Overlay rendering and styling for roster rows, including the dimmed unowned state.
- The paused overlay filled from the distinct blessing catalogue, owned and unowned alike.
- A hand-written roster in the HUD workbench's default model.

### Excluded

- The stacking tier, totals, and take counts — Child 02.
- Any change to the play-time bless bar, its synthetic Vitality entry, or its tooltip.
- Any change to the title screen or the two run-end overlays.
- Any change to what pausing does to the simulation, the pointer, or the camera.
- Tests, per the standing contract for this half of the repository.

## Files to Change

| File                                    | Change Size | Purpose                                                                  |
| --------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `src/demo/demo-hud.ts`                  | Medium      | The roster type, the overlay field, and the rows the panel renders       |
| `src/demo/demo.css`                     | Medium      | Roster layout, the owned and unowned states, and the short-viewport pass |
| `src/demo/demo-surface.ts`              | Small       | The paused branch builds a roster from the distinct catalogue            |
| `src/app/debug/hud-attack-workbench.ts` | Small       | A hand-written overlay roster so the screen is judgeable there           |

## Execution Outline

1. `demo-hud.ts`: add `DemoHudOverlayRosterEntry` beside `DemoHudOverlayReward`, and the optional `roster` and `rosterTitle` fields on `DemoHudOverlay`.
2. `demo-hud.ts`: create the roster title and container elements at mount, insert them into the overlay panel's append order between the objective line and the controls, and fill them in the overlay update branch the way `rewards` is filled.
3. `demo.css`: style the roster rows in the `demo__overlay-*` family, and widen the overlay panel so a nine-row roster still fits the height the game is played at. Nine rows is the eventual count, so the width and row height are chosen for nine now rather than for this child's five.
4. `demo-surface.ts`: the paused branch of `overlayModel()` builds its roster from `BLESS_CATALOG`, marking each entry owned via `hasBless`.
5. `hud-attack-workbench.ts`: give the default HUD model an overlay carrying a hand-written roster, with a control to switch it between empty, partial and full so all three states can be looked at.
6. Run `npm run verify`, then open the workbench and the game and look at the screen in all three roster states.

## Implementation Notes

- **Row shape.** A row is colour, glyph, name, detail, owned. Nothing numeric yet; Child 02 adds the quiet amount line. The row carries no `id` — the roster is display data and nothing keys off it.
- **Density.** The plan's density rule is that the name carries the weight, the detail sits under it at lower contrast, and the state is a property of the row rather than another column of words. So an unowned row is the same row at lower opacity with a colourless glyph frame — not a row with the word "unowned" in it.
- **Layout stability.** Every row is always present, so the panel's height is fixed by construction. Do not filter, do not collapse, and do not let the owned state change any box dimension — only colour and opacity.
- **Panel width.** The panel is `min(38rem, 100%)` today, sized for the run-end sheet. The roster needs more, so widen it; keep the run-end sheet reading the same by choosing a width that does not strand its four stat cells.
- **Short viewports.** The existing `(max-width: 900px), (max-height: 650px)` block already compacts the panel. Add the roster's compact pass there rather than inventing a new breakpoint.
- **Workbench.** The overlay is a full-surface button; mounting it in the workbench's render panel will cover the HUD corners on that tab. Make the roster preview opt-in through a checkbox so the tab's existing job — checking the corners against the picture behind them — still works when it is off.

## Edge Cases

| Case                                    | Expected Handling                                                      |
| --------------------------------------- | ---------------------------------------------------------------------- |
| Roster omitted (title screen, run ends) | The roster title and container stay hidden, exactly as `rewards` does  |
| Empty roster array                      | Hidden, not an empty bordered box                                      |
| A run holding no blessings              | All five rows listed, all dimmed; the panel is the height it always is |
| A run holding all five                  | All five rows lit; the panel is the same height as when it held none   |

## Acceptance Criteria

1. Pausing lists every blessing in the tier that never repeats, owned and unowned alike, each with its name and what it does, with no pointer needed to read any of it.
2. An unowned blessing reads as dimmed and present rather than being absent from the list.
3. The panel's layout is identical in height and position across an empty, partial and full roster.
4. Pausing and resuming still keeps the pointer locked and returns to play without a relock prompt.
5. The play-time bless bar looks and behaves exactly as it did.
6. The screen can be opened and judged from the HUD workbench without playing to a pause.
7. The project's verification gate passes, and no test file is added or modified.

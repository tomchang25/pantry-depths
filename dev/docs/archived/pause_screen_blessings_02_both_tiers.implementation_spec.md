# Both Blessing Tiers, With Totals And Counts

Parent Plan: `pause_screen_blessings.plan.md`

## Goal

Fill the pause screen's roster with the second blessing tier: the four that stack, listed beside the five that never repeat, each reading as the total it has added in its axis's own unit and the number of times it was taken. Those four are named, coloured and described in content and appear nowhere in the interface once their award card has faded; this is the screen that shows them.

## Summary

Child 01 gave the overlay a roster and filled it from the tier that never repeats. The tier that stacks is still on nobody's screen: the play-time bar draws only the distinct five plus one synthetic entry for surplus health, so a run that has taken Brutality three times can see neither the name nor the number anywhere.

This child adds them. The roster is built from both catalogues, distinct tier first in catalogue order, then the four stacking ones. A stacking row is owned when the run's running total for its axis is above zero, and it carries two extra pieces of text: the total, in the axis's own unit, and how many awards that total represents. The count is not stored — it is the total divided by what one award on that axis is worth, which is exact because every award adds the same amount.

Those two pieces sit in a numeric column on the right of the row rather than inside the description sentence, and the column is a fixed width so a row is the same height and the same shape whether it is filled or empty. That is what keeps the screen from reflowing as blessings arrive, which is the requirement the whole layout is built around.

The result: pausing lists nine rows. Five say what they do and whether the run holds them. Four say the same and, when held, what they have actually given — "+18 damage, taken 3 times" — so both questions a player has about a stacking blessing are answered on the one screen that can answer them.

## Relational Context

- `demo-surface.ts` owns the roster's assembly and is the only place both catalogues are read together. `bless.ts` owns what a blessing is and what the run holds; `modifiers.ts` owns what one award is worth. Neither gains a display concern.
- The take count is derived, not stored. `BlessState.stacking` stays a running total per axis, and its comment says why. A wrong shape here would be adding a per-axis award tally to the run to save a division — that would put a second owner on a number the total already answers.
- `blessingStep(axis)` is the single source for what one award adds, and it returns `0` for an axis the modifier catalogue does not carry. Divide only after guarding that, or a missing axis yields a non-finite count.
- `createHudModel`'s `blessIcons`, including the synthetic Vitality entry pushed when `overflowMaxHp` is positive, is untouched per the plan's first Non-Goal. The bar and the pause screen are two derivations from the same catalogues, and they stay separate.
- `DemoHudOverlayRosterEntry` grows one optional pair of fields. It is the pause screen's row type and the bless bar's `DemoHudBlessIcon` is unaffected, which is the reason they were split in Child 01.
- The HUD stays a pure renderer: it receives the total and the count already formatted as strings and does no arithmetic and no unit lookup.

## Scope

### Included

- The four stacking blessings in the pause roster, owned and unowned alike.
- A per-axis total and take count on a stacking row, formatted at the display layer.
- The roster row's numeric column, sized so its presence or absence never changes a row's height.
- The workbench preview updated to carry the same numbers, so the three roster states can still be judged there.

### Excluded

- Any change to the play-time bless bar, its synthetic Vitality entry, or its hover tooltip.
- Any change to what a blessing does, how the draw works, or what the run stores.
- Any new stored count, tally, or per-award history.
- Tasks, haul, core, and difficulty level — the plan's third Non-Goal.
- Tests, per the standing contract for this half of the repository.

## Files to Change

| File                                    | Change Size | Purpose                                                              |
| --------------------------------------- | ----------- | -------------------------------------------------------------------- |
| `src/demo/bless.ts`                     | Small       | How many awards a running total represents                           |
| `src/demo/demo-hud.ts`                  | Small       | The optional total and count on a roster row, and their two elements |
| `src/demo/demo-surface.ts`              | Medium      | The roster built from both catalogues, with the numbers formatted    |
| `src/demo/demo.css`                     | Small       | The numeric column and its fixed width                               |
| `src/app/debug/hud-attack-workbench.ts` | Small       | The preview roster carries totals and counts                         |

## Execution Outline

1. `bless.ts`: add the accessor that turns a running total into a number of awards, guarding a zero step. It sits beside `blessBonus`, which is the other reader of the same field.
2. `demo-hud.ts`: add the optional total and count to `DemoHudOverlayRosterEntry`, and render them as two elements in the row's third column.
3. `demo.css`: give the row a third, fixed-width column and style the two lines — the total numeric and legible, the count quiet beneath it.
4. `demo-surface.ts`: extend the roster builder to append the stacking catalogue, deriving owned from the axis total and formatting both strings there.
5. `hud-attack-workbench.ts`: give the preview roster's four stacking rows their totals and counts so the workbench still shows what the game shows.
6. Run `npm run verify`, then look at the screen in all three roster states in the workbench and once in the game.

## Implementation Notes

- **Ordering.** Distinct catalogue first in its own order, then the stacking catalogue in its own order. Two tiers stay legible as two tiers by position alone; no heading is inserted between them, because a heading is a row that appears in a place the eye expects a blessing.
- **Owned.** A stacking blessing is owned when its axis total is above zero. There is no membership list for that tier, and `hasBless` answers for the distinct tier only — its comment says so.
- **Unit text.** The modifier catalogue carries the axis's full name and the decimal places worth showing. The roster wants something shorter than "Movement speed" beside a number, so keep a small display-side map of short unit words next to the roster builder; the catalogue keeps owning the magnitudes and the precision, which is what a second definition would actually be a second definition of.
- **Precision.** Format the total with the axis's own precision, so a speed total reads as a decimal and a damage total as an integer. A leading `+` on every total, because every stacking award only ever adds.
- **Count wording.** One award reads as once, more than one reads as a plain count. The count is context, so it stays quieter than the total.
- **Fixed column.** The numeric column is a fixed width rather than `auto`. An `auto` column collapses on the five rows that never have a number, which widens the description column, which rewraps the sentence, which changes the row's height — the exact reflow the plan forbids.

## Edge Cases

| Case                                            | Expected Handling                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| A stacking blessing never taken                 | Listed, dimmed, no total and no count — unowned rather than zero        |
| A stacking blessing taken once                  | Owned, with its one award's total and a count reading as once           |
| An axis with no entry in the modifier catalogue | Total shown, count omitted rather than divided by zero                  |
| A fractional axis such as speed or reach        | Total carries the axis's own decimal places, count stays a whole number |
| A run holding every blessing in both tiers      | Nine rows lit; the panel is the height it was when the run held none    |

## Acceptance Criteria

1. Pausing lists all nine blessings, both tiers, owned and unowned, each with its name and what it does.
2. A stacking blessing taken three times reads as the total it has added and as three; one never taken reads as unowned rather than as zero.
3. The two tiers read as two tiers by their order alone.
4. The screen's layout is identical across an empty, partial and full roster — nothing moves, resizes, or reflows as blessings arrive.
5. The run's stored numbers are unchanged; the screen reports the totals the run already keeps and stores nothing new.
6. The play-time bless bar looks and behaves exactly as it did.
7. Pausing and resuming still keeps the pointer locked and returns to play without a relock prompt.
8. The project's verification gate passes, and no test file is added or modified.

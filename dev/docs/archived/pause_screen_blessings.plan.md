# The Pause Screen Says What The Run Is Carrying

Goal-Executable: yes

## Goal

Make pausing show every blessing the run holds and every one it does not, with what each does and how much it has actually given. Today pausing shows a title and two key hints, and the descriptions the interface already computes for every blessing are reachable only by hovering a glyph — which the game's locked pointer makes impossible for the whole of play.

## Requirements

1. Pausing shows the whole roster, both tiers, owned and unowned, each with its name and what it does. The bar during play shows only the tier that never repeats, plus one synthetic entry for surplus health, so the four blessings that stack are on nobody's screen once their award card has faded — they are named, coloured, and described in content, and invisible in the interface.
2. A stacking blessing reads as the total it has added, in the axis's own unit, and as the number of times it was taken. The tier compounds and pays under the same name every time, so a total is the honest number; the count follows from the total and what one award is worth, so the run stores nothing new to say it.
3. Every description is readable without a pointer. The text exists today only as a hover tooltip, and the run holds the pointer locked, so it has never once been read in play — this requirement is the whole reason the screen is worth building.
4. Pausing keeps behaving as it does: instant in both directions, and never releasing the pointer. The pause deliberately does not give the pointer up so that resuming never meets the browser's relock cooldown, and a screen that needs the mouse would undo that.
5. The screen reads as part of the game rather than as a panel dropped onto it. It uses the vocabulary the interface already has — its colours, its type scale, its spacing, its glyph treatment — and it holds its shape whether the roster is empty, half filled, or complete, because a screen that reflows as blessings arrive teaches the player that pausing is unstable.
6. The screen is looked at before it is called finished, at the sizes the game is actually played at and in all three states of the roster. Every value this project has authored badly was authored by somebody who never saw it in the medium that could show it, which is the stated reason the workbenches exist at all.

## Design

### What the screen shows

One roster, ordered so the two tiers stay legible as two tiers: the blessings that never repeat first, in catalogue order, then the four that stack. Each row carries its glyph in its own colour, its name, its description, and its state.

| Tier          | Owned reads as                                          | Unowned reads as     |
| ------------- | ------------------------------------------------------- | -------------------- |
| Never repeats | Held                                                    | Dimmed, still listed |
| Stacks        | The total added so far, and how many times it was taken | Dimmed, still listed |

Unowned rows stay on the screen rather than being filtered out, for the same reason the play-time bar keeps its empty slots: the gaps are what say there is something left to go and get, and a list that grows a row at a time cannot be read at a glance.

### Why a total rather than a count

A stacking blessing awards the same amount every time and the run keeps a running total per axis rather than a tally of awards. That is the right thing to store — the total is what every rule reads — and it means the count is not a fact the run holds but a fact derivable from the total and the per-award step, exactly, with no rounding.

So the screen shows the total as the number that matters and the count beside it as context. "Brutality — every swing lands harder — +6 damage, taken three times" answers both questions a player has, and adding a stored count to say the second half would put a second owner on a number that already has one.

### How much is too much

The roster is nine rows and will not grow: five that never repeat, four that stack. Nine rows carrying a glyph, a name, a one-line description and a state is about a paragraph of text, which is readable at a glance only if the rows are quiet — the name carries the weight, the description sits under it at lower contrast, and the state is a property of the row rather than another column of words. Nine rows of equal-weight text is a wall, and a wall is what gets skipped.

Two things keep the density honest without cutting content. An unowned row does not need its description to be as loud as an owned one, because what the player is reading it for is that the row exists. And a stacking row's total is a number, so it belongs where a number is read rather than inside the sentence: "taken three times, +6 damage" as its own quiet line, not folded into the description.

Whether this lands is a judgement, and it belongs to whoever looks at it rather than to the plan. What the plan fixes is that nothing is cut to make it fit: if the screen reads as too much, the answer is a quieter screen, not a shorter roster.

### The one thing this screen does not become

A pause screen is a good place to put everything, and this one deliberately holds one subject. Tasks, the sealed haul, the core carried in, and the difficulty level all already have somewhere they are shown, and moving them here would make the screen a second readout competing with the first. What has nowhere else to be shown is the blessing roster, and that is what this screen is for.

### Children

Both children have shipped. The overlay carries a roster, pausing lists both blessing tiers with what each does, and a stacking one reads as the total it has added and how many times it was taken.

## Non-Goals

1. The play-time bar is unchanged, including its synthetic surplus-health entry. It is a different readout with a different job — at a glance, mid-fight — and changing both at once would make a regression in either hard to attribute.
2. No new blessing, no change to what any blessing does, and no change to how the draw works.
3. Not a run summary. Tasks, haul, core, and difficulty level stay where they are shown today.
4. No change to what pausing does to the simulation, the pointer, or the camera.
5. No tests, per the standing test contract for this half of the repository.

## Acceptance Criteria

1. Pausing lists every blessing in both tiers, owned and unowned, each with its name and description, with no pointer needed to read any of it.
2. A stacking blessing taken three times reads as the total it has added and as three; one never taken reads as unowned rather than as zero.
3. Pausing and resuming keeps the pointer locked, freezes the view, and returns to play without a relock prompt.
4. The play-time bar looks and behaves exactly as it did.
5. The run's own numbers are unchanged: the screen reports what the run holds and never computes a new one.
6. The screen holds its layout across an empty roster, a partial one, and a full one — nothing moves, resizes, or reflows as blessings arrive.
7. The screen has been opened and seen in all three of those states, and the pictures are handed over. Whether the density and the look are right is the author's judgement and is deliberately not automated.
8. The project's verification gate passes, and no test file is added or modified.

## Execution

Both children have landed and their coordinates are spent. The specs are archived beside this plan.

# The Pause Screen Says What The Run Is Carrying

Goal-Executable: yes

## Goal

Make pausing show every blessing the run holds and every one it does not, with what each does and how much it has actually given. Today pausing shows a title and two key hints, and the descriptions the interface already computes for every blessing are reachable only by hovering a glyph — which the game's locked pointer makes impossible for the whole of play.

## Requirements

1. Pausing shows the whole roster, both tiers, owned and unowned, each with its name and what it does. The bar during play shows only the tier that never repeats, plus one synthetic entry for surplus health, so the four blessings that stack are on nobody's screen once their award card has faded — they are named, coloured, and described in content, and invisible in the interface.
2. A stacking blessing reads as the total it has added, in the axis's own unit, and as the number of times it was taken. The tier compounds and pays under the same name every time, so a total is the honest number; the count follows from the total and what one award is worth, so the run stores nothing new to say it.
3. Every description is readable without a pointer. The text exists today only as a hover tooltip, and the run holds the pointer locked, so it has never once been read in play — this requirement is the whole reason the screen is worth building.
4. Pausing keeps behaving as it does: instant in both directions, and never releasing the pointer. The pause deliberately does not give the pointer up so that resuming never meets the browser's relock cooldown, and a screen that needs the mouse would undo that.

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

### The one thing this screen does not become

A pause screen is a good place to put everything, and this one deliberately holds one subject. Tasks, the sealed haul, the core carried in, and the difficulty level all already have somewhere they are shown, and moving them here would make the screen a second readout competing with the first. What has nowhere else to be shown is the blessing roster, and that is what this screen is for.

### Children

| Child | Focus                                                | Form             |
| ----- | ---------------------------------------------------- | ---------------- |
| 01    | The pause screen can carry a roster instead of prose | Spec via `/goal` |
| 02    | Both blessing tiers rendered, with totals and counts | Spec via `/goal` |

Landing order is 01 then 02: the first opens the shape, the second fills it.

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
6. The project's verification gate passes, and no test file is added or modified.

## Execution

Perishable: this records the codebase on 2026-07-31. Re-check every coordinate against live code before acting on it.

Both children are demo-half work — the surface is `src/demo/` — so `dev/agent_rules/implement_operations.md` applies: the spec is a short architectural note, and verification is `npm run verify` plus playing it.

### Child 01 — The pause screen can carry a roster

- `src/demo/demo-hud.ts` — `DemoHudOverlay` at about line 120 is the full-surface screen for both pauses and both endings. Its comment states the split being extended: `body` is prose for the pauses, while an ending arrives as its parts. It already carries `stats` (label/value rows) and `rewards` (`DemoHudOverlayReward`), so the shape to copy is there; add an optional roster field beside them rather than overloading either.
- `src/demo/demo-surface.ts` — `overlayModel()` at about line 540 returns the three overlay shapes. The `paused` branch (about line 558) is the one that gains the roster; the unlocked branch above it is the title screen and keeps its controls list. The pause toggle itself is at about line 751 and is not touched.
- `src/demo/demo-hud.ts` renders the overlay lower in the same file, using the local `element()` helper; `src/demo/demo.css` owns its classes. Follow the existing overlay-section naming rather than inventing a parallel one.
- `src/app/debug/hud-attack-workbench.ts` at about line 125 builds a `DemoHudModel` by hand, including `blessIcons`. A newly required field breaks it; keep the new field optional, or feed the workbench a roster so the screen can be judged there without playing to a pause.

### Child 02 — Both tiers, with totals and counts

- `src/demo/bless.ts` — `BLESS_CATALOG` at about line 26 is the five that never repeat; `BLESS_STACKING_CATALOG` at about line 91 is the four that stack, each already carrying `name`, `detail`, `glyph`, `colour`, and the axis it moves. `BlessState.stacking` at about line 132 is a running total per axis, and its comment says why it is a total rather than a count. `hasBless()` at about line 148 answers for the distinct tier only, and its comment says so.
- `src/demo/modifiers.ts` — `blessingStep(axis)` at about line 76 is what one stacking award is worth, and it is the only source for it. The count is `total / step`; guard the zero step rather than dividing blind.
- `src/demo/demo-surface.ts` — `createHudModel()` at about line 370 builds `blessIcons` from `BLESS_CATALOG` alone and pushes a synthetic Vitality entry at about line 385 when `overflowMaxHp` is positive. That construction stays exactly as it is per Non-Goal 1; the roster is built beside it, from both catalogues.
- `src/demo/demo-hud.ts` — `DemoHudBlessIcon` at line 3 is the play-time bar's row, and its comment explains why the whole roster is sent rather than only what is owned. The pause roster needs more per row than that type carries, so it gets its own type rather than growing this one, which the bar would then have to ignore.
- The tooltip and label at about lines 421 and 422 of the same file are where the description is currently stranded. Leave them; they are harmless, and removing them is a change to the bar.

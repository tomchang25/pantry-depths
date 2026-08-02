# SFX Workbench And Library Feedback Loop

## Goal

Give the project a sound-review surface of its own: one page that lists every cue the game needs, plays it through the real playback pipeline, and records whether the shipped take fits — then feeds those judgements back to the shared audio library for periodic review. Today a take is judged in play and the judgement evaporates; nothing records which sounds are settled, which are placeholders, and why a candidate was turned down.

## Requirements

1. Two judgements, two owners, because they have different subjects: the audio library's annotations rate **the sound itself** (quality, character — one star means unusable), while the project records **fit of a sound in a role** — a verdict about one recording serving one cue. A five-star recording can be a misfit and a rejected fit can be a fine sound elsewhere, so neither judgement may overwrite the other.
2. The library's separate rejected flag is retired: low quality is one star, search hides one-star sounds by default, and the audition page's reject key becomes "rate one star and advance". One scale instead of a scale plus a flag, because the flag's only surviving meaning was "quality floor", and project-specific rejection now has its own home.
3. The project keeps a review record per cue: which recording backs it, a fit status (shipped, trial, or misfit), free-text notes, and project tags. The record's canonical home is this repository, because its keys are cue ids and cue ids are defined here; the library receives an exported copy.
4. The workbench is a development-only page beside the existing debug tools. It shows every cue with a hand-written line about when it fires, plays it through the same pipeline the game uses — volume keys, rate limiting, pitch jitter and all, because a bare file audition answers a different question — and lets loudness and pitch ranges be adjusted live and saved back to the authored cue table.
5. Project judgements flow to the library as one file per project in a dedicated projects area, written only by that project's exporter, so no two writers ever share a file. A library-side review pass walks those files periodically, separates generic findings (worth changing the sound-layer annotation) from project taste (kept as usage provenance), and proposes changes for a person to approve; nothing writes to the sound layer without that approval.
6. The method must be repeatable by the next project as-is: adopt the same review-record format, export to its own file in the projects area, and the same library-side review pass covers it.

## Design

### The two layers

| Layer   | Subject                       | Owner                             | Vocabulary                                              |
| ------- | ----------------------------- | --------------------------------- | ------------------------------------------------------- |
| Sound   | one recording, in itself      | audio library annotations         | rating 1–5, tags, description                           |
| Project | one recording serving one cue | consuming project's review record | fit: `shipped` / `trial` / `misfit`, note, project tags |

A fit verdict names the recording by its library catalog identity plus the cue id it was tried against. History is kept: a cue may accumulate several tried-and-misfit entries, and those are the record that stops the next search from re-proposing the same candidate.

### The workbench page

One row per cue: id, the trigger description, the backing recording and its library lineage, current loudness and pitch settings, fit status and note. Actions on a row: play (through the real pipeline, at the cue's authored settings), adjust loudness/pitch and hear it again, save the cue table, save the fit verdict. The page is verified by opening it and listening, like every other workbench.

### The feedback loop

1. Workbench writes the project review record locally.
2. An export step copies it into the library's projects area, replacing only this project's file.
3. The library's review pass reads all project files, drafts a proposal list — "generic finding, suggest sound-layer change" versus "project taste, keep as provenance" — with an LLM doing the sorting and a person approving each proposal before anything lands in annotations.

### Child overview

| Child | Focus                                                                                                                                               | Form    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 01    | Library rating reform: retire the rejected flag, migrate existing annotations, search hides one-star by default, audition reject key rates one star | Shipped |
| 02    | Project review record and the workbench page                                                                                                        | Shipped |
| 03    | Export step and the library-side review pass                                                                                                        | Shipped |

Landing order is 01, 02, 03: the workbench (02) wants the fit vocabulary to be the only rejection concept left, and the review pass (03) needs both sides existing.

## Non-Goals

1. No candidate browsing inside the workbench in this pass — swapping a take still goes through the library's own search and audition tooling; the workbench judges what is already wired in. Serving arbitrary library files into the project's dev server is its own problem and waits until the review loop proves itself.
2. No automatic writes to the library's sound-layer annotations, ever — the review pass proposes, a person disposes.
3. No new game-facing behaviour: nothing the workbench does changes what a player hears until a person saves an adjusted cue table.

## Acceptance Criteria

1. Every cue in the authored table appears on the workbench with a trigger description, plays audibly through the real pipeline, and a loudness change made there is heard on replay and survives a save and reload.
2. A fit verdict saved on the workbench appears in the project review record, and after an export, in the library's projects area file for this project.
3. In the library: searching without flags returns no one-star sounds, the audition reject key rates one star and advances, and every formerly-rejected annotation reads as one star after migration with no other field lost.
4. The review pass produces a human-readable proposal list from at least this project's file and changes nothing until a proposal is approved.

## Execution

All three children have shipped; their execution notes are cut per the forward-only rule. The plan stays active until the first acceptance criterion — the workbench heard and judged by an ear — has been taken; closeout follows that verification.

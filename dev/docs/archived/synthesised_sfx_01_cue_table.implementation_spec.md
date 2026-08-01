# Authored SFX Cue Table

Parent Plan: `synthesised_sfx.plan.md`

## Goal

Establish the authored cue table that every later child reads: a validated schema for synthesis recipes, a starter table covering the funnel tier, and an authoring-endpoint target so the table can be edited and saved like every other authored record. No sound is produced by this child; it only creates the data the audio engine will consume.

## Summary

The project has no audio at all, and the plan's first child builds the half that must exist before anything can be heard: the record of what each sound is made of. It lands in `src/content/` beside the other authored tables, because that is where every numeric record the design owns already lives, and because putting it there keeps the door open for an SFX workbench later.

A cue is one row: an id, a synthesis recipe (waveform, frequency sweep, duration, two-stage envelope, noise mix, optional filter), an authored volume in decibels, rate-limiting parameters, and a pitch-jitter range. The recipe vocabulary is deliberately small — enough to make fifty sounds distinguishable, not enough to make any of them good, which is what the plan's quantity-over-quality requirement asks for.

The id list is declared in the content layer rather than derived from the demo, because `src/content/` may only import content and core — it cannot reach into `src/demo/` for the particle and death-cause unions it is covering. This follows the existing prop-display precedent exactly: the kind list lives in content, the demo aliases it, and the validator demands one row per id so a referenced cue can never be missing its recipe.

The starter table is sixteen cues: one per particle kind, one per death cause, one message blip, and one each for the two world effects. That is the funnel tier the next child hooks, and no more — the semantic cues arrive with the child that raises them.

Once landed: `npm run verify` passes with new schema tests inside it, the table round-trips through the authoring endpoint, and nothing in the running game changes because nothing reads the table yet.

## Relational Context

- The content layer may import only content and core. It must not import `src/demo/`, so the cue id list is declared here and the demo will reference these ids rather than the reverse.
- A validator must answer the same shape its file holds. The authoring endpoint writes the validator's return value verbatim, so the parser returns the authored array unchanged — in particular it returns the authored decibel value and never a linear gain, because a reshaping parser writes a file its own next load rejects. Decibel-to-linear conversion is a point-of-use concern and belongs to the consumer, not the parser.
- The parser is the only place an unknown cue id can be rejected. Downstream dispatch over the id union relies on that closure, per the project's closed-enumeration rule.
- `validateSource` in the authoring API dispatches over the target union and ends in `target satisfies never`. The new branch goes before that tail, or the compiler rejects the addition — which is the intended enforcement.
- The authoring path whitelist is consumed by the dev server config to decide what not to watch, so a new single-file target is covered automatically by adding its entry; no separate watcher change exists.
- The API contract test asserts only that the client and tooling agree on the API root. It does not enumerate targets, so it needs no change.

## Scope

### Included

- Cue schema, id list, and validator in the content layer.
- Starter cue table as authored JSON, covering the funnel tier.
- A definitions module that parses the table once and exports it plus a lookup.
- An `sfx` single-file authoring target wired to the validator.
- Unit tests for the schema and validator.

### Excluded

- Any audio playback, synthesis, or browser audio API use — that is the next child.
- Semantic cues for actions, impacts, enemies, flow, and interface — those arrive with the child that hooks them.
- An SFX workbench UI.
- Tuning the starter recipes by ear.

## Files to Change

| File                                           | Change Size | Purpose                                                 |
| ---------------------------------------------- | ----------- | ------------------------------------------------------- |
| `src/content/sfx/sfx-cue-schema.ts`            | Medium      | Cue id list, recipe types, validator, decibel helper    |
| `src/content/sfx/sfx-cues.json`                | Medium      | The authored starter table                              |
| `src/content/sfx/sfx-cue-definitions.ts`       | Small       | Parses the table once; exports the list and a lookup    |
| `dev/tools/authoring/api-contract.ts`          | Small       | Adds the `sfx` single-file target to the path whitelist |
| `dev/tools/authoring/authoring-api.ts`         | Small       | Adds the `sfx` validation branch before the never-check |
| `test/unit/content/sfx/sfx-cue-schema.test.ts` | Small       | Accepts the canonical table; rejects malformed rows     |

## Execution Outline

1. Write the schema module: the id list, the recipe and cue types, the validator, and the decibel-to-linear helper. It comes first because everything else in this child is typed against it.
2. Author the starter table as JSON, one row per declared id, with recipes chosen so neighbouring categories are audibly unlike each other.
3. Add the definitions module that parses the table at import time and exposes the list and a by-id lookup.
4. Register the authoring target in the path whitelist, then add the matching validation branch. The whitelist comes first because the branch's target union is derived from it.
5. Write the schema tests, then run the verification gate.

## Implementation Notes

- **Schema module.** Mirror the structure of the prop-display and entity-display schemas: local `record` and `finiteNumber` helpers, per-field error messages naming the index and field, duplicate-id rejection, and a closing check that every declared id has a row. Range rules: duration, frequencies, window, and pitch bounds strictly positive; envelope stages and noise mix non-negative with noise mix at most one; pitch minimum not above pitch maximum; per-window count a positive integer. The filter is optional and, when present, validated whole.
- **The dB helper** converts a decibel offset to a linear multiplier. Export it here so the consumer converts at the point of use; do not call it inside the validator.
- **Recipe spread.** The starter rows exist to prove the vocabulary can separate categories, not to sound good. Keep blood soft and low, stone and bone bright and short, splash noisy and filtered, the death rows longer than the particle rows, the message blip a short clean tone, and the two world effects the lowest and longest of the set.
- **Authoring branch.** Follow the shape of the neighbouring branches exactly: try the parse, catch, and rethrow as a validation error whose message ends by saying canonical content was not changed.
- **Tests.** One case accepts the canonical authored document at its full row count; one case rejects a malformed row and an empty table. Import the JSON directly as the other content tests do, and clone before mutating.

## Edge Cases

| Case                               | Expected Handling                                             |
| ---------------------------------- | ------------------------------------------------------------- |
| A row names an id outside the list | Rejected, naming the index                                    |
| An id appears twice                | Rejected as listed twice                                      |
| A declared id has no row           | Rejected, listing every missing id                            |
| Pitch minimum above pitch maximum  | Rejected, so a jitter range can never invert at playback time |
| Filter present but malformed       | Rejected as a whole rather than partially defaulted           |
| Filter absent                      | Accepted; the cue is simply unfiltered                        |

## Acceptance Criteria

1. The authored starter table loads and validates, covering every declared cue id exactly once.
2. A malformed row is rejected at load with a message naming which row and which field.
3. The table saves and reloads through the authoring endpoint without changing shape.
4. The verification gate passes with the new schema tests running inside it.
5. Nothing observable changes in the running game, because nothing reads the table yet.

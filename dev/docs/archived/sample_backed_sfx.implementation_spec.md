# Sample-Backed Sound Effects

Parent Plan: none (standalone spec)

## Goal

Replace the synthesised placeholder sounds with real recordings for every cue that has a good match in the processed sound library, keeping the synthesised recipe for the handful that do not. The recipes were always placeholders; the engine was built so that swapping their source costs one branch.

## Summary

Forty-seven of the fifty-two cues now have a processed recording chosen for them, verified on disk, recorded in `dev/docs/briefs/sample_sfx_map.brief.md`. Five keep their recipe: four because the library holds nothing for them (dust, embers, the mortar's firing thump, the descent rumble) and one because what it holds is too weak to be an improvement (the extraction chime).

**What changes.** A cue gains a `source` discriminant: `recipe` as today, or `sample` naming a WAV shipped beside the table. The audio facade branches once at bake time — a recipe is rendered offline as it is now, a sample is fetched and decoded — and everything downstream is untouched, because the mixer only ever knew about buffers. The voice cap, the rate limiting, the pitch jitter, the distance falloff and the volume keys all carry over unchanged.

**What this costs, stated plainly.** The closed synthesised-SFX plan claimed no asset files, no licensing question and no bundle growth as benefits. All three are now spent: 3.9MB of WAV enters the tree, under purchased-pack licences the user has confirmed. The bundle figure is deliberately not optimised — the game already ships roughly fifty megabytes of sprite atlases, so compressing four would be effort against the wrong number, and WAV avoids both a format-compatibility question and the encoder delay that would blunt a percussive cue's attack.

**Files ship uncompressed and unrenamed in content, one per cue, named after the cue.** Each carries its own provenance inside it: the library's promote step wrote the source path, trim points and gain into the WAV's comment metadata, so a file's lineage survives leaving the catalog behind.

**Result.** The demo sounds like a game rather than like an oscilloscope, and the five unmatched cues keep working exactly as they do today.

## Requirements

1. Every cue that the map names gets its recording; the five it does not keep their recipe, unchanged and still audible — a partial migration must not create a silent cue.
2. The two sources are one closed enumeration, so a third kind of source later cannot compile without being handled at every branch.
3. A cue declaring a sample with no shipped file fails loudly at load rather than playing silence, for the same reason the table demands a row per declared id: silence is indistinguishable from breakage.
4. Nothing downstream of the buffer changes. Rate limiting, pitch jitter, voice cap, attenuation and the volume keys are untouched.
5. Authored volumes stay as they are. Both sources now peak at roughly full scale, so the existing per-cue decibels remain meaningful; tuning them by ear is separate work.

## Relational Context

- The mixer's contract is a buffer and nothing else. That is what makes this change small, and it must stay true: no sample-specific concept may reach the mixer.
- The content layer may import only content and core. Assets live under `src/content/sfx/assets/` and are imported through source so the bundler fingerprints them, matching how every other baked asset in this project ships.
- The validator answers the shape the file holds, unchanged — the authoring endpoint writes its return value verbatim, so the discriminant round-trips as authored.
- Sample URLs cannot be validated by the JSON schema, because the URL only exists after the bundler resolves an import. The definitions module owns that check instead, at module init, where a missing entry is a load-time failure.
- Baking a recipe uses an offline context; decoding a sample uses the live one. Both produce a buffer for the same map, and both remain individually failure-isolated: one bad cue is one silent cue, never a failed startup.
- The schema's unit tests cover the validator's shape rules and must be updated for the discriminant. Updating a test whose subject moved needs no new permission.

## Scope

### Included

- A `source` discriminant on the cue type, its validation, and the JSON table rewritten for forty-seven cues.
- Forty-seven WAV files copied into the content tree, one per cue, named by cue id.
- A definitions module resolving cue id to asset URL, failing at load on a gap.
- The facade's bake step branching on source.
- Schema test updates.

### Excluded

- Any change to the mixer, the limiter, the attenuation, or the volume keys.
- Tuning authored volumes by ear — the samples are level-matched to each other, not to the game's mix.
- Compressing or re-encoding the audio.
- The five unmatched cues, which keep their recipes untouched.

## Files to Change

| File                                           | Change Size | Purpose                                                    |
| ---------------------------------------------- | ----------- | ---------------------------------------------------------- |
| `src/content/sfx/sfx-cue-schema.ts`            | Medium      | The discriminant, its types, and its validation            |
| `src/content/sfx/sfx-cues.json`                | Large       | Forty-seven rows swapped from recipe to sample             |
| `src/content/sfx/sfx-cue-definitions.ts`       | Medium      | Asset imports, id-to-URL map, load-time completeness check |
| `src/content/sfx/assets/*.wav`                 | Large       | The recordings themselves                                  |
| `src/presentation/audio/sfx.ts`                | Small       | Branch on source when filling the buffer map               |
| `test/unit/content/sfx/sfx-cue-schema.test.ts` | Small       | Cover both source kinds                                    |

## Execution Outline

1. Copy the assets in, named by cue id, so the imports have something to resolve.
2. Change the schema: the discriminant, the sample branch, and the never-check that closes it.
3. Rewrite the table's forty-seven rows, leaving five recipes in place.
4. Add the imports and the completeness check to the definitions module.
5. Branch the facade's bake step; leave everything after the buffer alone.
6. Update the tests, then run the gate.

## Implementation Notes

- **The discriminant.** `source` is `"recipe" | "sample"`; a recipe row keeps its `recipe` object, a sample row carries `sample` naming its file. Validation dispatches on it and ends in the compiler-proved exception branch the project's code style requires.
- **Asset naming.** One file per cue, named for the cue, because each cue was given a distinct take — no file is shared, so the mapping is one to one and the import list is mechanical. The library-side path is not encoded in the filename; it is inside the WAV and in the library's annotations.
- **The completeness check** belongs beside the parse, not inside the validator: the validator runs on JSON that has no notion of a bundled URL.
- **Bake branching.** Keep the per-cue try/catch. A sample that fails to fetch or decode is one silent cue, exactly as an unrenderable recipe is.

## Edge Cases

| Case                                          | Expected Handling                                            |
| --------------------------------------------- | ------------------------------------------------------------ |
| A row declares `sample` with no shipped asset | Load-time failure naming the cue                             |
| A row declares `sample` and also a recipe     | Rejected; the two sources are exclusive                      |
| A sample fails to fetch or decode at runtime  | That cue is silent; every other cue is unaffected            |
| A cue kept on `recipe`                        | Behaves exactly as before this change                        |
| Playback before the bake finishes             | Silence, unchanged — sample decoding is inside the same bake |

## Acceptance Criteria

1. Entering the game plays recorded sound for the forty-seven mapped cues and synthesised sound for the five that keep recipes; nothing is silent that was audible before.
2. A cue whose sample is missing from the tree fails at load with a message naming it, rather than playing silence.
3. Distance attenuation, rate limiting, pitch jitter, mute and the volume keys behave exactly as they did.
4. The verification gate passes with the schema tests covering both source kinds.

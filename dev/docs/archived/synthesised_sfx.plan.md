# Synthesised Placeholder SFX

Closed 2026-08-02. Children 01 through 04 shipped; child 05 was withdrawn rather than run — see the note under the child overview.

## Goal

Give the demo a complete set of synthesised placeholder sound effects — the project currently ships no audio at all. Every moment worth hearing gets its own cheap, distinct sound, generated at runtime from authored recipes rather than shipped as asset files, so full coverage costs no licensing, no baking pipeline, and no bundle growth.

## Requirements

1. Every sound is synthesised at runtime from an authored recipe. No audio asset files ship — this is what keeps a fifty-sound coverage pass affordable and the bundle unchanged.
2. Quantity over quality, and every cue distinct: a cheap sound that exists beats a good sound that does not, and fifty different rough sounds are a playable game where five good ones repeated are torture. Every entry in the coverage table sounds different from its neighbours.
3. Audio can never break or gate the game. Without a usable audio capability the whole system degrades to a silent no-op and never throws; playback is fire-and-forget and never blocks the simulation or the frame.
4. Playback is bounded: a global simultaneous-voice cap and per-cue sliding-window rate limiting keep a bomb in a crowd from becoming one distorted roar, and per-play pitch jitter keeps a repeated cue from reading as copy-paste.
5. A cue raised at a world position attenuates with distance to the player; interface-level cues play flat at full volume.
6. The player controls volume from the keyboard — a mute toggle and a step-up/step-down pair, persisted across reloads. Keyboard rather than an overlay control because the pointer stays locked while paused, so there is no cursor to drag a slider with, and every other player-facing toggle in the demo is already a key for the same reason.
7. Audio suspends when the tab is hidden and resumes when it returns.
8. The cue table is authored content: schema-validated on load and saved through the unified authoring endpoint. Its schema and validator carry unit tests — test addition for this table is explicitly user-authorised for this plan.

## Design

### Four layers, one replaced source

The architecture is lifted from the sibling project's audio stack (read 2026-07-31), which splits delivery into four responsibilities; only the bottom source layer changes from files to synthesis:

- **The mixer** is the only owner of the browser audio context. Fixed gain graph — an effect bus and a music bus into a master gain — a cap of 24 simultaneous voices, per-cue rate limiting, suspend/resume, dispose. The context is created lazily on the first unlock gesture because browsers block pre-gesture audio, so constructing the mixer has no audio side effect. Volumes are pushed in from outside; the mixer reads no settings and owns no game state. Without an audio-context constructor it is a silent no-op.
- **The rate limiter** is a pure per-key sliding window with an injectable clock.
- **The cue table** is authored data: one entry per cue holding a synthesis recipe (waveform, frequency sweep, amplitude envelope, noise mix, optional filter, duration), a volume authored in dB, a limiter key with window parameters, and a pitch-jitter range.
- **The facade** exposes one fire-and-forget call: play this cue id, optionally at this world position. It resolves the cue, applies distance attenuation and pitch jitter, and hands the mixer a buffer. It exports the full cue-id set so "which moments are intentionally silent" stays a queryable fact. An unknown id logs a development-visible warning and stays silent — never a throw.

### Bake at unlock

At the moment of the unlock gesture, every recipe is rendered offline into an audio buffer once; playback thereafter is plain buffer playback. This keeps the entire downstream — voice cap, limiting, pitch jitter, buses, teardown — identical to the file-based reference, because synthesis only replaces where buffers come from. Building a node graph per play would instead force every mixer rule to be rewritten. The demo's entry gesture — clicking to lock the pointer — is the natural unlock.

### Recipe vocabulary

A recipe is deliberately small: enough to make fifty sounds distinct, not enough to make any of them good.

| Field                 | Meaning                                                    |
| --------------------- | ---------------------------------------------------------- |
| waveform              | sine, square, sawtooth, triangle, or noise                 |
| frequency start → end | a pitch sweep across the cue's duration                    |
| duration              | total length in seconds                                    |
| attack / decay        | a two-stage amplitude envelope                             |
| noise mix             | how much broadband noise is layered over the tone          |
| filter (optional)     | lowpass, highpass, or bandpass with a cutoff and resonance |

Volume is authored in dB because mixing judgement happens in dB, and converted to linear gain where it is consumed rather than where it is read — a validator that reshaped its input would write a file its own next load rejects, which is a rule the authoring endpoint already enforces on every other table. Pitch jitter defaults to roughly ±5–10% of playback rate per play — the cheapest way a repeated sound stops reading as a repeat.

### Hookup: two tiers, no event bus

The demo has no semantic event list; feedback is raised where it happens. Building an event bus first would tie this work to the demo-port line, so cues hook the funnels that exist today, in two tiers:

- **Funnel tier — the coverage floor.** The particle burst funnel (seven particle kinds, each with a default cue), the enemy death routine (one cue per death cause), the message announcer (one interface blip), and the world-effect spawner (blast and arc). Four touch points guarantee nothing stays silent.
- **Semantic tier — the distinctness.** Named cues raised directly at the meaningful sites: impact resolution (detonation, shell fall, rock landing, body barge, body landing, chain lightning, water entry), player actions (swing, the throw weights, pickup), enemy behaviour (windup telegraphs, charge, shell launch), rewards and flow (blessing, curse altar, sealed reward, extraction, descent), and interface (pause in and out, card, restart).

Where a semantic cue and a funnel cue would fire for the same instant, shared limiter keys collapse the pile-up; a per-target priority fold is added only if audible stacking survives that.

### Coverage table

The target is 50–70 recipes across seven categories: melee (swing, flesh hit, bone hit, blocked, wall break, final collapse), throwing (three launch weights, flight, impact, bounce, break, pickup), enemies (three telegraph starts, charge windup, wall slam, shell launch, shell fall, stunned, one per death cause), player (directional hurt, near-death, heal, death), environment (water step, drowning, hot spring, steam, ember, door, stair opening), rewards and flow (two blessing tiers, curse altar, sealed reward, extraction, task complete, descent), and interface (pause, card, message, restart). Authoring these recipes is the bulk of the work and lands as its own supervised pass, judged by ear.

### Child overview

| Child | Focus                                                                          | Form                                                                |
| ----- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 01    | Cue schema, validator, starter table, authoring endpoint target, schema tests  | Shipped — `synthesised_sfx_01_cue_table.implementation_spec.md`     |
| 02    | Audio engine: mixer, limiter, baker, facade, unlock, suspend, funnel-tier hook | Shipped — `synthesised_sfx_02_audio_engine.implementation_spec.md`  |
| 03    | Semantic-tier hookup across actions, impacts, enemy behaviour, flow, interface | Shipped — `synthesised_sfx_03_semantic_tier.implementation_spec.md` |
| 04    | Keyboard mute and volume steps, persisted                                      | Shipped — `synthesised_sfx_04_volume_keys.implementation_spec.md`   |
| 05    | Full recipe coverage pass to 50–70 cues, judged by ear                         | Execution below                                                     |

Children 01 through 04 shipped in that order. **Child 05 was withdrawn unrun**, and with it acceptance criterion 1: the fifty-two recipes exist, are hooked, and were never heard. Tuning a set of sounds that were always going to be placeholders stopped being worth the time the moment a real sample library became the intended source, so the listening pass belongs to that work rather than to this plan. What this plan delivered is the engine, the hookups and the controls — every one of which a sample-backed cue reuses unchanged, because the mixer only ever knew about buffers.

## Non-Goals

1. No background music or ambience, and no music direction layer. The music bus exists in the mixer because it arrives free with the copied gain graph, but nothing feeds it.
2. No stereo panning or positional audio beyond distance attenuation.
3. No semantic event bus. That belongs to the demo-port line; audio hooks the funnels that exist today.
4. No SFX workbench. The authored table and endpoint target leave the door open; building the tool is separate, unscheduled work.
5. Nothing is copied from the sibling project's asset files or tuned cue values — those carry another game's rhythm. Only the architecture travels.

## Acceptance Criteria

1. A full run played with sound on produces audible, mutually distinct feedback in every coverage category; no category is silent.
2. In an environment without the audio capability, the game boots and plays exactly as it does today, silently.
3. A bomb detonated in a crowd stays clean: voices stay bounded and the mix thins rather than distorts.
4. Mute and the volume steps take effect immediately from the keyboard during locked play, report the level on screen, and survive a reload.
5. Hiding the tab silences the game; returning to it resumes the sound.
6. An unknown cue id at any call site produces a development-visible warning and silence, never an error.
7. The aggregate verification gate passes, with the new schema and validator tests running inside it.

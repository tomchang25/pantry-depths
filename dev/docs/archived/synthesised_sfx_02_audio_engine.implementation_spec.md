# The Audio Engine And The Funnel Tier

Parent Plan: `synthesised_sfx.plan.md`

## Goal

Make the game audible. Build the playback engine that turns the authored recipe table into sound — a mixer owning the browser audio context, an offline baker, and a fire-and-forget facade — then hook it to the four funnels that already carry every moment worth hearing, so nothing that matters is silent.

## Summary

This is a demo-half change, so the note below states the shape and the hazards rather than an inventory; the rest is read just in time.

**What is being built.** Four modules under `src/presentation/audio/`. The mixer and the rate limiter are lifted from the sibling project's audio stack with minimal adaptation — they solve exactly this problem and their two safety belts, a voice cap and per-key window limiting, are the whole reason a bomb in a crowd does not become one distorted roar. The baker is new: at unlock it renders every recipe once through an `OfflineAudioContext` into a buffer, which is what lets the entire downstream stay identical to the file-based original. The facade is the only thing the demo talks to.

**What owns what.** The mixer is the sole owner of the audio context and the gain graph; it reads no settings and no game state, and volumes are pushed into it. The facade owns cue resolution, distance attenuation, and pitch jitter, and holds the listener position the demo pushes each frame. Nothing in the demo touches the mixer directly.

**What it replaces.** Nothing. There is no audio in the project today, so there is no compatibility surface and no old path to delete.

**Shapes to avoid.** Do not build a node graph per play — bake once and play buffers, or every mixer rule has to be rewritten around live graphs. Do not let the facade read the world; it takes a position or nothing. Do not let audio throw: no capability, no unlock, or an unknown id must all end in silence, never an exception on a gameplay path.

**The result.** Clicking into the game arms the audio; from then on blood, chips, dust, embers, splashes, bone, six kinds of death, the message line, and both world effects each make their own sound, quieter with distance, and the tab going away silences it.

## Relational Context

- The demo already imports the presentation layer in four places, and the presentation layer already imports content. Both directions this change needs are established and machine-checked.
- The mixer owns the audio context exclusively. The facade holds a mixer instance and never exposes it; the demo never sees either.
- The context must be created inside a user gesture, so the facade's unlock is called from the pointer-lock paths. Constructing the mixer before that must have no audio side effect.
- Baking is asynchronous and unlock is not. Playback before the bake finishes is silence, not an error or a queue.
- The listener position is pushed from the frame loop each tick; the facade owns it as presentation state. Cues raised with no position are interface cues and skip attenuation entirely.
- The particle funnel takes a field and coordinates but has no access to the world, which is why the listener is pushed rather than read — a positional cue there must not need a world reference.
- `src/demo/` and `src/presentation/` are the untested half. This change adds no automated test and must not.

## Scope

### Included

- Mixer, rate limiter, offline baker, and facade under `src/presentation/audio/`.
- Unlock on the pointer-lock gesture; suspend and resume on tab visibility.
- Listener position pushed from the demo frame loop.
- Funnel-tier cues on the particle burst, the death routine, the message line, and the world-effect spawner.

### Excluded

- Semantic cues at action, impact, enemy, flow, and interface sites — the next child.
- Player-facing volume and mute — the child after that.
- Any music: the music bus exists in the graph and nothing feeds it.
- Any automated test against the demo or presentation halves.

## Files to Change

| File                                     | Change Size | Purpose                                                      |
| ---------------------------------------- | ----------- | ------------------------------------------------------------ |
| `src/presentation/audio/rate-limiter.ts` | Small       | Per-key sliding window, injectable clock                     |
| `src/presentation/audio/audio-mixer.ts`  | Large       | Owns the context and gain graph; bounded, limited playback   |
| `src/presentation/audio/sfx-baker.ts`    | Medium      | Renders one recipe to a buffer through an offline context    |
| `src/presentation/audio/sfx.ts`          | Medium      | The facade: unlock, suspend, listener, play                  |
| `src/demo/demo-surface.ts`               | Small       | Unlock on gesture, visibility suspend/resume, listener push  |
| `src/demo/particles.ts`                  | Small       | A cue per particle kind on the burst funnel                  |
| `src/demo/world.ts`                      | Small       | Cues on the death routine, the message line, the vfx spawner |
| `src/content/sfx/sfx-cues.json`          | Small       | Aligns the noise rows' filter start with their sweep start   |

## Execution Outline

1. Land the rate limiter and the mixer first — they are self-contained and everything else is typed against the mixer's cue shape.
2. Add the baker, then the facade that owns the mixer and the baked buffer map. The facade is the only export the demo uses.
3. Wire unlock, visibility, and the listener push in the demo surface. At this point nothing is audible yet because nothing raises a cue.
4. Hook the four funnels, then play it.

## Implementation Notes

- **Mixer.** Keep the lifted design intact: lazy context on first unlock, silent no-op when no constructor exists, `effect` and `music` buses into a master gain, a voice cap around two dozen, per-cue limiting delegated to the limiter, and per-voice gain only when a cue's volume is not unity. Drop the file-decoding path — nothing fetches audio. Keep suspend, resume, stop-all, and dispose.
- **Baker.** One offline render per recipe. A tonal recipe drives an oscillator swept from its start frequency to its end frequency; a noise recipe has no oscillator and instead sweeps its filter across the same range, which is what makes the sweep meaningful for a cue that has no pitch. The tone and a white-noise buffer are blended by the recipe's noise mix, an optional filter shapes the sum, and a two-stage envelope closes it. Guard the envelope so attack plus decay never exceeds the duration, and use a ramp target above zero — an exponential ramp to zero is invalid.
- **Facade.** Module-level singleton. `unlock` is idempotent and kicks the bake once; `play` resolves the cue, computes attenuation from the pushed listener when a position is given, draws a playback rate inside the cue's jitter range, converts the authored decibels to linear gain, and hands it to the mixer. Unknown id warns once in development and returns. Attenuation falls linearly to zero at a hearing radius of about fourteen cells, which is a first guess to be tuned by ear in the coverage pass.
- **Demo surface.** Unlock from both pointer-lock entry paths, because either can be the first gesture. Suspend and resume on `visibilitychange` beside the existing listener registrations, and remove that listener in the disposer with the others. Push the listener position once per tick from the frame loop.
- **Funnels.** The particle burst maps its kind to a cue and passes its own coordinates. The death routine maps its cause. The message line raises the interface blip with no position. The vfx spawner branches over its two kinds — blast has a point, an arc uses its origin. Every one of these is a fire-and-forget call added beside what is already there; none of them changes an outcome.
- **Cue table.** Set each noise row's filter frequency equal to its sweep start, so a field the baker sweeps is not also authored to a different fixed value.

## Edge Cases

| Case                                        | Expected Handling                                      |
| ------------------------------------------- | ------------------------------------------------------ |
| No audio capability in the environment      | Every call is a silent no-op; the game plays normally  |
| A cue raised before unlock or before baking | Silence, no queue, no error                            |
| Voice cap reached                           | The cue is dropped; the mix thins rather than distorts |
| A cue raised beyond the hearing radius      | Dropped before it reaches the mixer                    |
| Tab hidden mid-run                          | Context suspends; returning resumes it                 |
| Repeated unlock gestures                    | Idempotent — one context, one bake                     |

## Acceptance Criteria

1. Entering the game arms the audio, and each of the seven particle kinds, six death causes, the message line, and both world effects produces its own distinguishable sound.
2. A sound raised far from the player is quieter than the same sound at the player's feet, and interface sounds are unaffected by distance.
3. A bomb in a crowd stays clean: the mix thins under load rather than distorting.
4. Hiding the tab silences the game; returning resumes it.
5. In an environment without audio capability, the game boots and plays exactly as before, silently.
6. The verification gate passes and no automated test covers the demo or presentation halves.

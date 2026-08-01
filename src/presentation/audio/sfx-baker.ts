/**
 * Turns an authored recipe into a buffer, once.
 *
 * Everything downstream — the voice cap, the rate limiting, the pitch jitter, the buses, the teardown —
 * is written against buffers, so synthesising offline and playing the result keeps all of it unchanged.
 * The alternative, building a node graph per play, would mean rewriting every one of those rules around
 * live graphs for no gain the ear could hear.
 */

import type { SfxRecipe } from "@/content/sfx/sfx-cue-definitions";

/** Below this an exponential ramp is invalid, and it is already far under anything audible. */
const SILENCE = 0.0001;

type OfflineContextFactory = (channels: number, frames: number, sampleRate: number) => OfflineAudioContext | undefined;

function defaultOfflineFactory(channels: number, frames: number, sampleRate: number): OfflineAudioContext | undefined {
  if (typeof OfflineAudioContext === "undefined") {
    return undefined;
  }

  return new OfflineAudioContext(channels, frames, sampleRate);
}

/** White noise, as long as the cue needs. The cheapest source of everything that is not a tone. */
function noiseBuffer(context: OfflineAudioContext, frames: number): AudioBuffer {
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const samples = buffer.getChannelData(0);

  for (let index = 0; index < frames; index += 1) {
    samples[index] = Math.random() * 2 - 1;
  }

  return buffer;
}

/**
 * Renders one recipe.
 *
 * A tonal recipe sweeps its oscillator from the start frequency to the end. A noise recipe has no pitch
 * to sweep, so the same two numbers drive its filter instead — which is what gives a splash its fall and
 * a dust puff its dulling, and is why a noise cue authors its filter to open at the sweep's start.
 */
export async function bakeRecipe(
  recipe: SfxRecipe,
  sampleRate: number,
  createOffline: OfflineContextFactory = defaultOfflineFactory,
): Promise<AudioBuffer | undefined> {
  const frames = Math.max(1, Math.ceil(recipe.durationSeconds * sampleRate));
  const context = createOffline(1, frames, sampleRate);

  if (!context) {
    return undefined;
  }

  const duration = recipe.durationSeconds;
  const isNoiseOnly = recipe.waveform === "noise";
  const noiseLevel = isNoiseOnly ? 1 : recipe.noiseMix;
  const toneLevel = isNoiseOnly ? 0 : 1 - recipe.noiseMix;

  const envelope = context.createGain();
  const filter = recipe.filter ? context.createBiquadFilter() : undefined;

  if (filter && recipe.filter) {
    filter.type = recipe.filter.type;
    filter.Q.value = recipe.filter.q;

    if (isNoiseOnly) {
      filter.frequency.setValueAtTime(recipe.frequencyStart, 0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(SILENCE, recipe.frequencyEnd), duration);
    } else {
      filter.frequency.value = recipe.filter.frequency;
    }

    filter.connect(envelope);
  }

  const head: AudioNode = filter ?? envelope;
  envelope.connect(context.destination);

  if (toneLevel > 0) {
    const oscillator = context.createOscillator();
    oscillator.type = recipe.waveform === "noise" ? "sine" : recipe.waveform;
    oscillator.frequency.setValueAtTime(recipe.frequencyStart, 0);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(SILENCE, recipe.frequencyEnd), duration);

    const toneGain = context.createGain();
    toneGain.gain.value = toneLevel;
    oscillator.connect(toneGain);
    toneGain.connect(head);
    oscillator.start(0);
    oscillator.stop(duration);
  }

  if (noiseLevel > 0) {
    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer(context, frames);

    const noiseGain = context.createGain();
    noiseGain.gain.value = noiseLevel;
    noise.connect(noiseGain);
    noiseGain.connect(head);
    noise.start(0);
    noise.stop(duration);
  }

  // Clamped against the duration so a recipe whose stages overrun cannot invert the envelope; a cue
  // authored that way simply gets a shorter attack rather than a click at the end.
  const attack = Math.min(recipe.attackSeconds, duration * 0.5);
  const decay = Math.min(recipe.decaySeconds, duration - attack);

  envelope.gain.setValueAtTime(SILENCE, 0);
  envelope.gain.exponentialRampToValueAtTime(1, Math.max(SILENCE, attack));
  envelope.gain.exponentialRampToValueAtTime(SILENCE, Math.max(attack + SILENCE, attack + decay));

  return context.startRendering();
}

/**
 * The one thing the game talks to about sound.
 *
 * Fire and forget: a call says what happened and, when it happened somewhere, where. It never returns a
 * result, never blocks, and never throws — before the context exists, before the bake finishes, without
 * an audio capability at all, every call here is silence. That is deliberate and it is the whole
 * contract: a feedback layer that can fail a gameplay path is worse than no feedback layer.
 *
 * It holds no game state. The listener position is pushed in each frame rather than read, because the
 * particle funnel that raises most of these cues has coordinates but no world to ask.
 */

import {
  fromDb,
  SFX_CUE_IDS,
  sfxCue,
  SFX_CUES,
  sfxSampleUrl,
  type SfxCue,
  type SfxCueId,
} from "@/content/sfx/sfx-cue-definitions";
import { AudioMixer } from "@/presentation/audio/audio-mixer";
import { bakeRecipe } from "@/presentation/audio/sfx-baker";

/**
 * How far a sound carries, in cells.
 *
 * A first guess, to be tuned by ear in the coverage pass. Wide enough that a fight across the room is
 * still heard, short enough that a floor full of activity is not one flat wall of noise.
 */
const HEARING_RADIUS = 14;

const mixer = new AudioMixer();
const buffers = new Map<SfxCueId, AudioBuffer>();
const listener = { x: 0, y: 0 };
const warned = new Set<string>();

let baking = false;
let baked = false;

function isCueId(value: string): value is SfxCueId {
  return (SFX_CUE_IDS as readonly string[]).includes(value);
}

/**
 * Fills one cue's buffer, from whichever of the two sources it declares.
 *
 * This is the whole of what a recording costs the audio layer. Everything past the buffer — the voice
 * cap, the rate limiting, the pitch jitter, the buses, the distance falloff — cannot tell the two
 * apart, which is exactly what the mixer's buffer-only contract was for.
 */
async function loadCue(cue: SfxCue, context: AudioContext): Promise<AudioBuffer | undefined> {
  if (cue.source === "recipe") {
    return bakeRecipe(cue.recipe, context.sampleRate);
  }

  if (cue.source === "sample") {
    const url = sfxSampleUrl(cue.id);

    if (!url) {
      return undefined;
    }

    const response = await fetch(url);
    return context.decodeAudioData(await response.arrayBuffer());
  }

  cue satisfies never;
  throw new Error("unknown SFX cue source");
}

/**
 * Fills every cue's buffer once.
 *
 * A cue that fails is left out of the map rather than retried or substituted: it plays silence, and
 * the rest of the table is unaffected by one bad recipe or one unreachable file.
 */
async function bakeAll(): Promise<void> {
  const context = mixer.audioContext;

  if (baking || baked || !context) {
    return;
  }

  baking = true;

  await Promise.all(
    SFX_CUES.map(async (cue) => {
      try {
        const buffer = await loadCue(cue, context);

        if (buffer) {
          buffers.set(cue.id, buffer);
        }
      } catch {
        // One unloadable cue is one silent cue, never a failed startup.
      }
    }),
  );

  baking = false;
  baked = true;
}

/**
 * Arms the audio. Must be called from inside a user gesture, because a browser refuses a context
 * outside one. Idempotent: repeated gestures never build a second context or bake a second time.
 */
export function unlockSfx(): void {
  mixer.unlock();
  void bakeAll();
}

/** Silences everything while the tab is away. */
export function suspendSfx(): void {
  mixer.suspend();
}

/** Brings it back when the tab returns. */
export function resumeSfx(): void {
  mixer.resume();
}

/** Where the ears are, pushed once per frame. */
export function setSfxListener(x: number, y: number): void {
  listener.x = x;
  listener.y = y;
}

/**
 * How loud, and whether muted at all — the player's setting, kept here because the mixer is
 * deliberately settings-blind and something has to remember across a reload.
 *
 * Storage is wrapped rather than trusted: a browser with storage disabled loses the setting at the end
 * of the session, which is a far better failure than the sound system throwing on startup.
 */
const MASTER_KEY = "pantry.sfx.master";
const MUTED_KEY = "pantry.sfx.muted";
const VOLUME_STEP = 0.1;

function readStored(): { master: number; muted: boolean } {
  try {
    const storedMaster = Number.parseFloat(window.localStorage.getItem(MASTER_KEY) ?? "");
    return {
      master: Number.isFinite(storedMaster) ? Math.min(1, Math.max(0, storedMaster)) : 1,
      muted: window.localStorage.getItem(MUTED_KEY) === "true",
    };
  } catch {
    return { master: 1, muted: false };
  }
}

function writeStored(): void {
  try {
    window.localStorage.setItem(MASTER_KEY, String(setting.master));
    window.localStorage.setItem(MUTED_KEY, String(setting.muted));
  } catch {
    // A session-only setting is the whole cost of storage being unavailable.
  }
}

const setting = readStored();

/** Pushes the current setting at the mixer. Muted is a level of zero rather than a second concept. */
function applySetting(): void {
  mixer.setVolumes({ master: setting.muted ? 0 : setting.master });
}

applySetting();

/** Master and bus levels, for whoever wants to push something other than the player's own setting. */
export function setSfxVolumes(volumes: Partial<{ master: number; effect: number; music: number }>): void {
  mixer.setVolumes(volumes);
}

/** How loud it currently is, `0..1`, and whether it is muted. For whatever wants to say so on screen. */
export function sfxSetting(): Readonly<{ master: number; muted: boolean }> {
  return { master: setting.master, muted: setting.muted };
}

/** Flips mute and answers the new state, so a caller can report it without asking again. */
export function toggleSfxMute(): boolean {
  setting.muted = !setting.muted;
  applySetting();
  writeStored();
  return setting.muted;
}

/**
 * Steps the level and answers where it landed.
 *
 * Stepping while muted unmutes: reaching for the volume is a statement about wanting to hear it, and
 * a step that silently moved a level nobody could hear would read as a broken key.
 */
export function stepSfxVolume(direction: 1 | -1): number {
  setting.muted = false;
  setting.master = Math.min(1, Math.max(0, Math.round((setting.master + direction * VOLUME_STEP) * 100) / 100));
  applySetting();
  writeStored();
  return setting.master;
}

export type SfxAt = Readonly<{ x: number; y: number }>;

/**
 * Raises one cue, optionally somewhere in the world.
 *
 * With a position the cue fades with distance and is dropped entirely beyond earshot, which is most of
 * what keeps a busy floor legible. Without one it is an interface sound and plays flat.
 */
export function playSfx(id: SfxCueId, at?: SfxAt): void {
  if (!isCueId(id)) {
    if (!warned.has(id) && import.meta.env.DEV) {
      warned.add(id);
      console.warn(`Unknown SFX cue "${id}"; nothing was played.`);
    }

    return;
  }

  const buffer = buffers.get(id);

  if (!buffer) {
    return;
  }

  const cue = sfxCue(id);
  let volume = fromDb(cue.volumeDb);

  if (at) {
    const distance = Math.hypot(at.x - listener.x, at.y - listener.y);
    const nearness = 1 - distance / HEARING_RADIUS;

    if (nearness <= 0) {
      return;
    }

    volume *= nearness;
  }

  mixer.play({
    buffer,
    bus: "effect",
    limiterKey: cue.limiterKey,
    maxPerWindow: cue.maxPerWindow,
    windowSeconds: cue.windowSeconds,
    volume,
    playbackRate: cue.pitchMin + Math.random() * (cue.pitchMax - cue.pitchMin),
  });
}

import { RateLimiter } from "@/presentation/audio/rate-limiter";

/** The two buses. Master multiplies both; every cue plays through `effect`, and nothing feeds `music` yet. */
export type AudioBus = "effect" | "music";

export interface AudioMixerVolumes {
  readonly master: number;
  readonly effect: number;
  readonly music: number;
}

export interface AudioPlayRequest {
  readonly buffer: AudioBuffer;
  /** Defaults to `effect`. */
  readonly bus?: AudioBus;
  /** When set, the cue is rate limited under this key; absent means no limiting. */
  readonly limiterKey?: string;
  readonly maxPerWindow?: number;
  readonly windowSeconds?: number;
  /** Per-play linear attenuation `0..1`, layered under the bus gain. Defaults to `1`. */
  readonly volume?: number;
  /** Source playback rate; doubles as pitch. Defaults to `1`. */
  readonly playbackRate?: number;
}

export interface AudioMixerOptions {
  /** Injectable so a caller can supply its own; answers undefined when the capability is absent. */
  readonly createContext?: () => AudioContext | undefined;
  readonly now?: () => number;
  readonly maxVoices?: number;
}

const DEFAULT_MAX_VOICES = 24;
const DEFAULT_MAX_PER_WINDOW = 4;
const DEFAULT_WINDOW_SECONDS = 0.05;

/**
 * The delivery engine, and the only owner of the browser audio context.
 *
 * It holds a fixed gain graph — `effect` and `music` into `master` into the destination — and plays
 * supplied buffers through a bus with per-cue rate limiting and a bounded voice count. It is a
 * presentation output: it reads no settings and owns no gameplay state, and volumes arrive as a push
 * from outside rather than being read from anywhere.
 *
 * The context is built lazily on the first {@link unlock} because browsers refuse one before a user
 * gesture, so constructing the mixer has no audio side effect at all. **Where there is no context
 * constructor the mixer degrades to a silent no-op and never throws** — a sound system has no business
 * being the reason a game fails to start.
 */
export class AudioMixer {
  private readonly limiter: RateLimiter;
  private readonly createContext: () => AudioContext | undefined;
  private readonly maxVoices: number;
  private readonly volumes = { master: 1, effect: 1, music: 1 };
  private readonly activeVoices = new Set<AudioBufferSourceNode>();

  private context: AudioContext | undefined;
  private masterGain: GainNode | undefined;
  private busGains: Record<AudioBus, GainNode> | undefined;

  constructor(options: AudioMixerOptions = {}) {
    this.limiter = new RateLimiter(options.now ? { now: options.now } : {});
    this.createContext = options.createContext ?? defaultContextFactory;
    this.maxVoices = options.maxVoices ?? DEFAULT_MAX_VOICES;
  }

  get isUnlocked(): boolean {
    return this.context !== undefined;
  }

  /** The live context, for whoever has to render against its sample rate. Undefined before unlock. */
  get audioContext(): AudioContext | undefined {
    return this.context;
  }

  /**
   * Builds the context and gain graph on first call, and resumes a suspended one after that.
   * Idempotent: a repeated gesture never creates a second context or a duplicate node.
   */
  unlock(): void {
    if (!this.context) {
      const context = this.createContext();

      if (!context) {
        return;
      }

      this.context = context;
      this.buildGraph(context);
    }

    if (this.context.state === "suspended") {
      void this.context.resume();
    }
  }

  /** Suspends the running context so everything goes quiet. No-op before unlock. */
  suspend(): void {
    if (this.context && this.context.state === "running") {
      void this.context.suspend();
    }
  }

  /** Resumes a suspended context. No-op before unlock or while already running. */
  resume(): void {
    if (this.context && this.context.state === "suspended") {
      void this.context.resume();
    }
  }

  /** Records the given volumes and applies whichever map to a live gain node. Safe before unlock. */
  setVolumes(volumes: Partial<AudioMixerVolumes>): void {
    if (volumes.master !== undefined) {
      this.volumes.master = clamp01(volumes.master);
    }

    if (volumes.effect !== undefined) {
      this.volumes.effect = clamp01(volumes.effect);
    }

    if (volumes.music !== undefined) {
      this.volumes.music = clamp01(volumes.music);
    }

    this.applyVolumes();
  }

  /**
   * Plays a buffer through its bus.
   *
   * A no-op before unlock, when the cue is rate limited, or when the voice cap is reached. Each play
   * builds a single-use source node — a source cannot be restarted, so voices are never pooled and
   * concurrency is bounded by count instead.
   */
  play(request: AudioPlayRequest): void {
    const context = this.context;
    const busGains = this.busGains;

    if (!context || !busGains) {
      return;
    }

    if (
      request.limiterKey &&
      !this.limiter.tryAcquire(
        request.limiterKey,
        request.maxPerWindow ?? DEFAULT_MAX_PER_WINDOW,
        request.windowSeconds ?? DEFAULT_WINDOW_SECONDS,
      )
    ) {
      return;
    }

    if (this.activeVoices.size >= this.maxVoices) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = request.buffer;

    if (request.playbackRate !== undefined) {
      source.playbackRate.value = request.playbackRate;
    }

    source.connect(this.voiceDestination(context, busGains[request.bus ?? "effect"], request.volume));
    this.activeVoices.add(source);
    source.onended = () => {
      this.activeVoices.delete(source);
      source.disconnect();
    };
    source.start();
  }

  /** Stops and releases every active voice and clears the limiter's history. */
  stopAll(): void {
    // Safe to walk directly: the handler that would remove an entry is cleared before the stop below,
    // so nothing mutates the set while this runs, and the clear afterwards empties it in one go.
    for (const source of this.activeVoices) {
      source.onended = null;

      try {
        source.stop();
      } catch {
        // A source that already ended throws on stop(); the disconnect below still releases it.
      }

      source.disconnect();
    }

    this.activeVoices.clear();
    this.limiter.clear();
  }

  /** Stops everything and closes the context; the mixer returns to its pre-unlock state. */
  dispose(): void {
    this.stopAll();

    const context = this.context;
    this.context = undefined;
    this.masterGain = undefined;
    this.busGains = undefined;

    if (context && context.state !== "closed") {
      void context.close();
    }
  }

  private voiceDestination(context: AudioContext, busGain: GainNode, volume: number | undefined): AudioNode {
    if (volume === undefined || volume === 1) {
      return busGain;
    }

    const voiceGain = context.createGain();
    voiceGain.gain.value = clamp01(volume);
    voiceGain.connect(busGain);
    return voiceGain;
  }

  private buildGraph(context: AudioContext): void {
    const masterGain = context.createGain();
    masterGain.connect(context.destination);

    const effectGain = context.createGain();
    effectGain.connect(masterGain);

    const musicGain = context.createGain();
    musicGain.connect(masterGain);

    this.masterGain = masterGain;
    this.busGains = { effect: effectGain, music: musicGain };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (this.masterGain) {
      this.masterGain.gain.value = this.volumes.master;
    }

    if (this.busGains) {
      this.busGains.effect.gain.value = this.volumes.effect;
      this.busGains.music.gain.value = this.volumes.music;
    }
  }
}

function defaultContextFactory(): AudioContext | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const constructor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return constructor ? new constructor() : undefined;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

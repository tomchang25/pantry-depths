import type { SemanticEvent } from "@/core/run-state";

export type AudioCapability = "pending" | "ready" | "silent";

export class ProceduralAudio {
  #context: AudioContext | undefined;
  #ambientGain: GainNode | undefined;
  #capability: AudioCapability = "pending";

  public get capability(): AudioCapability {
    return this.#capability;
  }

  public async activate(): Promise<AudioCapability> {
    if (this.#capability !== "pending") {
      return this.#capability;
    }

    try {
      if (!window.AudioContext) {
        this.#capability = "silent";
        return this.#capability;
      }

      const context = new AudioContext();
      await context.resume();
      const ambientGain = context.createGain();
      ambientGain.gain.value = 0.025;
      ambientGain.connect(context.destination);
      const drone = context.createOscillator();
      drone.type = "sine";
      drone.frequency.value = 46;
      const overtone = context.createOscillator();
      overtone.type = "triangle";
      overtone.frequency.value = 69;
      const droneGain = context.createGain();
      droneGain.gain.value = 0.48;
      drone.connect(droneGain);
      overtone.connect(droneGain);
      droneGain.connect(ambientGain);
      drone.start();
      overtone.start();
      this.#context = context;
      this.#ambientGain = ambientGain;
      this.#capability = "ready";
    } catch {
      this.#capability = "silent";
    }

    return this.#capability;
  }

  public play(events: readonly SemanticEvent[]): void {
    const context = this.#context;

    if (!context || this.#capability !== "ready") {
      return;
    }

    for (const event of events) {
      if (event.type === "entityDamaged") {
        this.#tone(118, 0.075, "square", 0.1);
      } else if (event.type === "entityRetaliated") {
        this.#tone(72, 0.13, "sawtooth", 0.12);
      } else if (event.type === "entityDefeated") {
        this.#tone(92, 0.28, "triangle", 0.14, 38);
      } else if (event.type === "keyCollected") {
        this.#tone(590, 0.12, "sine", 0.08, 830);
      } else if (event.type === "playerTransitioned") {
        this.#tone(160, 0.22, "sine", 0.08, 82);
      } else if (event.type === "playerHealthRestored") {
        this.#tone(330, 0.3, "sine", 0.07, 495);
      }
    }
  }

  /** Backward rejection produces no `SemanticEvent`, so it needs its own non-event cue entry point. */
  public playRejection(): void {
    const context = this.#context;

    if (!context || this.#capability !== "ready") {
      return;
    }

    this.#tone(94, 0.2, "sawtooth", 0.1, 52);
  }

  public async dispose(): Promise<void> {
    const context = this.#context;
    this.#context = undefined;
    this.#ambientGain?.disconnect();
    this.#ambientGain = undefined;

    if (context) {
      await context.close().catch(() => undefined);
    }
  }

  #tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency = frequency * 0.72,
  ): void {
    const context = this.#context;

    if (!context) {
      return;
    }

    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }
}

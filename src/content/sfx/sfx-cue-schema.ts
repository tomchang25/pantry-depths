/**
 * What every sound in the game is made of, as authored numbers rather than audio files.
 *
 * The whole point of this table is that a sound costs nothing to add. There is no asset to license, no
 * bake step, and no bundle growth — a cue is a handful of numbers, and the engine turns them into a
 * buffer at startup. That is what makes covering fifty moments affordable, and covering fifty moments
 * is worth far more here than making any one of them good.
 *
 * The id list lives here rather than beside the code that raises each sound, because `src/content/` may
 * only import content and core — a validator in this layer cannot reach into the demo for the particle
 * kinds and death causes it is covering. Keeping one list and demanding a row per id is the only
 * arrangement where a cue somebody raises cannot be missing its recipe and play silence instead.
 */

export const SFX_CUE_IDS = [
  "particleBlood",
  "particleStoneChip",
  "particleWoodChip",
  "particleDust",
  "particleEmber",
  "particleSplash",
  "particleBone",
  "deathSlain",
  "deathCleaved",
  "deathDrowned",
  "deathSplattered",
  "deathBlasted",
  "deathImpaled",
  "uiMessage",
  "vfxBlast",
  "vfxArc",
  "meleeSwing",
  "meleeHitFlesh",
  "meleeHitBone",
  "meleeHitWall",
  "meleeHitAltar",
  "throwLight",
  "throwMedium",
  "throwHeavy",
  "throwEnemy",
  "shootBolt",
  "propPickup",
  "propDrop",
  "enemyWindupBlade",
  "enemyWindupShot",
  "enemyWindupCharge",
  "enemyChargeLaunch",
  "enemyChargeSlam",
  "enemyShotFire",
  "playerHurt",
  "playerDeath",
  "waterEntry",
  "rockLand",
  "bodyBarge",
  "bodyLand",
  "detonation",
  "shellFire",
  "shellLand",
  "chainHop",
  "blessGain",
  "sealedReward",
  "extractionDone",
  "descend",
  "uiPause",
  "uiResume",
  "uiCard",
  "uiRestart",
] as const;

export type SfxCueId = (typeof SFX_CUE_IDS)[number];

export const SFX_WAVEFORMS = ["sine", "square", "sawtooth", "triangle", "noise"] as const;

export type SfxWaveform = (typeof SFX_WAVEFORMS)[number];

export const SFX_FILTER_TYPES = ["lowpass", "highpass", "bandpass"] as const;

export type SfxFilterType = (typeof SFX_FILTER_TYPES)[number];

export type SfxFilter = Readonly<{
  type: SfxFilterType;
  /** Cutoff for a lowpass or highpass, centre for a bandpass, in hertz. */
  frequency: number;
  /** Resonance. Higher rings more; around one is neutral. */
  q: number;
}>;

/**
 * How one sound is synthesised.
 *
 * Deliberately the smallest vocabulary that can still tell fifty sounds apart. A sweep plus an envelope
 * plus a noise blend covers the difference between a wet hit, a dry chip and a thump, and anything
 * richer than that is a tool for making one sound good — which is not what this table is for.
 */
export type SfxRecipe = Readonly<{
  waveform: SfxWaveform;
  /** Where the tone starts, in hertz. */
  frequencyStart: number;
  /** Where it has arrived by the end of the cue. Equal to the start means no sweep. */
  frequencyEnd: number;
  durationSeconds: number;
  /** Rise to full amplitude. Near zero is a click; longer is a swell. */
  attackSeconds: number;
  /** Fall back to silence after the attack. */
  decaySeconds: number;
  /** How much broadband noise is blended over the tone, `0..1`. One is pure noise. */
  noiseMix: number;
  /** Absent means the cue is unfiltered. */
  filter?: SfxFilter;
}>;

export type SfxCue = Readonly<{
  id: SfxCueId;
  recipe: SfxRecipe;
  /**
   * Authored loudness in decibels, negative being quieter than reference.
   *
   * Held in decibels rather than as a linear gain because that is the unit the ear and the person
   * tuning the table both think in — halving perceived loudness is a step of about ten, not a
   * multiplication by a half. {@link fromDb} converts at the point of use; see the note there for why
   * the conversion must not happen in the parser.
   */
  volumeDb: number;
  /** Cues sharing a key share one rate-limit window, which is how a pile-up is collapsed. */
  limiterKey: string;
  maxPerWindow: number;
  windowSeconds: number;
  /** Playback rate is drawn between these each play, so a repeat never sounds like a copy. */
  pitchMin: number;
  pitchMax: number;
}>;

/**
 * Converts an authored decibel offset to a linear gain multiplier.
 *
 * Exported for the consumer to call, and deliberately **not** called inside the validator: the
 * authoring endpoint writes whatever the validator returns, so a parser that converted here would
 * write linear gains into a file whose own next load expects decibels.
 */
export function fromDb(db: number): number {
  return 10 ** (db / 20);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }

  return value;
}

function positiveNumber(value: unknown, label: string): number {
  const parsed = finiteNumber(value, label);

  if (parsed <= 0) {
    throw new TypeError(`${label} must be greater than zero.`);
  }

  return parsed;
}

function nonNegativeNumber(value: unknown, label: string): number {
  const parsed = finiteNumber(value, label);

  if (parsed < 0) {
    throw new TypeError(`${label} must not be negative.`);
  }

  return parsed;
}

function parseFilter(value: unknown, label: string): SfxFilter {
  const source = record(value, label);
  const type = source.type;

  if (typeof type !== "string" || !SFX_FILTER_TYPES.includes(type as SfxFilterType)) {
    throw new TypeError(`${label}.type must name a filter type.`);
  }

  return {
    type: type as SfxFilterType,
    frequency: positiveNumber(source.frequency, `${label}.frequency`),
    q: positiveNumber(source.q, `${label}.q`),
  };
}

function parseRecipe(value: unknown, label: string): SfxRecipe {
  const source = record(value, label);
  const waveform = source.waveform;

  if (typeof waveform !== "string" || !SFX_WAVEFORMS.includes(waveform as SfxWaveform)) {
    throw new TypeError(`${label}.waveform must name a waveform.`);
  }

  const noiseMix = nonNegativeNumber(source.noiseMix, `${label}.noiseMix`);

  if (noiseMix > 1) {
    throw new TypeError(`${label}.noiseMix must not exceed one.`);
  }

  const parsed: SfxRecipe = {
    waveform: waveform as SfxWaveform,
    frequencyStart: positiveNumber(source.frequencyStart, `${label}.frequencyStart`),
    frequencyEnd: positiveNumber(source.frequencyEnd, `${label}.frequencyEnd`),
    durationSeconds: positiveNumber(source.durationSeconds, `${label}.durationSeconds`),
    attackSeconds: nonNegativeNumber(source.attackSeconds, `${label}.attackSeconds`),
    decaySeconds: nonNegativeNumber(source.decaySeconds, `${label}.decaySeconds`),
    noiseMix,
  };

  // Absent rather than null, so the saved file carries no key at all for an unfiltered cue and the
  // round trip through the authoring endpoint leaves it exactly as authored.
  return source.filter === undefined ? parsed : { ...parsed, filter: parseFilter(source.filter, `${label}.filter`) };
}

/**
 * Validates an authored cue table and answers it in the shape the file holds.
 *
 * **The list, not a lookup, and that is load-bearing.** The authoring endpoint writes whatever this
 * returns, so answering a different shape from the one handed in writes a file the next load rejects.
 * Anything wanting a lookup builds one with {@link sfxCuesById}.
 *
 * Every declared id must be present. A partial table would mean a cue somebody raises falls through to
 * silence, and silence is indistinguishable from a sound that failed — which is the one failure this
 * table exists to make impossible.
 */
export function parseSfxCues(value: unknown): readonly SfxCue[] {
  if (!Array.isArray(value)) {
    throw new TypeError("SFX cues must be an array.");
  }

  const parsed = new Map<SfxCueId, SfxCue>();

  value.forEach((entry, index) => {
    const label = `sfxCue[${index}]`;
    const source = record(entry, label);
    const id = source.id;

    if (typeof id !== "string" || !SFX_CUE_IDS.includes(id as SfxCueId)) {
      throw new TypeError(`${label}.id must name a cue.`);
    }

    if (parsed.has(id as SfxCueId)) {
      throw new TypeError(`${label}.id is listed twice.`);
    }

    const limiterKey = source.limiterKey;

    if (typeof limiterKey !== "string" || limiterKey.length === 0) {
      throw new TypeError(`${label}.limiterKey must be a non-empty string.`);
    }

    const maxPerWindow = positiveNumber(source.maxPerWindow, `${label}.maxPerWindow`);

    if (!Number.isInteger(maxPerWindow)) {
      throw new TypeError(`${label}.maxPerWindow must be a whole number.`);
    }

    const pitchMin = positiveNumber(source.pitchMin, `${label}.pitchMin`);
    const pitchMax = positiveNumber(source.pitchMax, `${label}.pitchMax`);

    if (pitchMin > pitchMax) {
      throw new TypeError(`${label}.pitchMin must not exceed ${label}.pitchMax.`);
    }

    parsed.set(id as SfxCueId, {
      id: id as SfxCueId,
      recipe: parseRecipe(source.recipe, `${label}.recipe`),
      volumeDb: finiteNumber(source.volumeDb, `${label}.volumeDb`),
      limiterKey,
      maxPerWindow,
      windowSeconds: positiveNumber(source.windowSeconds, `${label}.windowSeconds`),
      pitchMin,
      pitchMax,
    });
  });

  const missing = SFX_CUE_IDS.filter((id) => !parsed.has(id));

  if (missing.length > 0) {
    throw new TypeError(`SFX cues are missing an entry for: ${missing.join(", ")}.`);
  }

  return [...parsed.values()];
}

/** The same table as a lookup, for the readers that want one. Order is not meaningful to either. */
export function sfxCuesById(cues: readonly SfxCue[]): Readonly<Record<SfxCueId, SfxCue>> {
  return Object.fromEntries(cues.map((cue) => [cue.id, cue])) as Record<SfxCueId, SfxCue>;
}

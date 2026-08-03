/**
 * What every sound in the game is made of, as an authored table beside its recordings.
 *
 * The table is deliberately short. It used to cover fifty moments; most of those sounds fired so often
 * they were wallpaper, or marked moments nobody needed marked. What is left is the set worth hearing:
 * the player's own strikes and what they land on, the deaths the environment hands out, the two blasts,
 * and one voice for the interface. A moment not on this list is meant to be silent.
 *
 * The id list is core vocabulary (`@/core/sfx-cues`): the rules report cues typed by it, and this
 * table demands a row per id, which is the only arrangement where a cue somebody raises cannot be
 * missing its recipe and play silence instead.
 */

import { SFX_CUE_IDS, type SfxCueId } from "@/core/sfx-cues";

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

export const SFX_SOURCES = ["recipe", "sample"] as const;

export type SfxSource = (typeof SFX_SOURCES)[number];

/**
 * What a cue is made of, and the two ways that answer can go.
 *
 * A recipe is synthesised at startup; a sample is a recording shipped beside this table. The two are
 * a closed enumeration rather than an optional field on one shape, so a third kind of source later
 * cannot be added without every branch that consumes a cue failing to compile until it is handled.
 */
type SfxCueSource = Readonly<{ source: "recipe"; recipe: SfxRecipe }> | Readonly<{ source: "sample"; sample: string }>;

export type SfxCue = SfxCueSource &
  Readonly<{
    id: SfxCueId;
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
 * Which of the two things a cue is made of, and the fields that go with it.
 *
 * The exclusivity is checked rather than assumed: a row carrying both a recipe and a sample has two
 * answers to one question, and picking one silently is how a table starts describing a sound nobody
 * can find. The chain ends in the compiler-proved exception branch, so adding a third source kind
 * fails to build here rather than falling through to whichever branch happened to be last.
 */
function parseSource(source: Record<string, unknown>, label: string): SfxCueSource {
  const kind = source.source;

  if (typeof kind !== "string" || !SFX_SOURCES.includes(kind as SfxSource)) {
    throw new TypeError(`${label}.source must be one of: ${SFX_SOURCES.join(", ")}.`);
  }

  // Narrowed once here so the chain below dispatches over the union rather than over `string`, which
  // is what lets the closing never-check actually prove the chain complete.
  const declared: SfxSource = kind as SfxSource;

  if (declared === "recipe") {
    if (source.sample !== undefined) {
      throw new TypeError(`${label} is a recipe cue, so it must not also carry a sample.`);
    }

    return { source: "recipe", recipe: parseRecipe(source.recipe, `${label}.recipe`) };
  }

  if (declared === "sample") {
    if (source.recipe !== undefined) {
      throw new TypeError(`${label} is a sample cue, so it must not also carry a recipe.`);
    }

    const sample = source.sample;

    if (typeof sample !== "string" || !/^[\w-]+\.wav$/.test(sample)) {
      throw new TypeError(`${label}.sample must name a WAV file shipped beside this table.`);
    }

    return { source: "sample", sample };
  }

  declared satisfies never;
  throw new Error("unknown SFX cue source");
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
      ...parseSource(source, label),
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

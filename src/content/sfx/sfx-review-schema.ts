/**
 * The project's judgement of each shipped recording, as an authored table beside the cue table.
 *
 * A different subject from the audio library's annotations, and deliberately a different file: the
 * library rates a sound in itself, while a row here is a verdict about one recording serving one cue —
 * a five-star recording can still be the wrong voice for a moment. The table is keyed by cue id
 * because the cue is the role being judged, and cue ids are defined in this repository.
 *
 * One row per declared cue, enforced the same way the cue table is: a cue missing its row would be a
 * cue the review workbench silently cannot show, and silence is the failure this layer exists to
 * prevent.
 */

import { SFX_CUE_IDS, type SfxCueId } from "@/core/sfx-cues";

export const SFX_FITS = ["shipped", "trial", "misfit"] as const;

/**
 * Where a take stands in its role. `shipped` is settled by an ear, `trial` was chosen by tags and
 * awaits one, and `misfit` is a verdict against the pairing — the sound itself may be fine elsewhere.
 */
export type SfxFit = (typeof SFX_FITS)[number];

/** A recording tried in this role before the current one, kept so a search never re-proposes it. */
export type SfxTriedTake = Readonly<{
  catalogPath: string;
  fit: SfxFit;
  note: string;
}>;

export type SfxReviewEntry = Readonly<{
  id: SfxCueId;
  /** When the cue fires, in one authored line. The workbench shows it; nothing derives it. */
  trigger: string;
  /** The current recording's library-relative source path, written when the take is wired in. */
  catalogPath: string;
  fit: SfxFit;
  note: string;
  tags: readonly string[];
  tried: readonly SfxTriedTake[];
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function plainString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be a string.`);
  }

  return value;
}

function fitValue(value: unknown, label: string): SfxFit {
  if (typeof value !== "string" || !SFX_FITS.includes(value as SfxFit)) {
    throw new TypeError(`${label} must be one of: ${SFX_FITS.join(", ")}.`);
  }

  return value as SfxFit;
}

function stringList(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array.`);
  }

  return value.map((entry, index) => plainString(entry, `${label}[${index}]`));
}

function parseTried(value: unknown, label: string): readonly SfxTriedTake[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array.`);
  }

  return value.map((entry, index) => {
    const source = record(entry, `${label}[${index}]`);
    return {
      catalogPath: plainString(source.catalogPath, `${label}[${index}].catalogPath`),
      fit: fitValue(source.fit, `${label}[${index}].fit`),
      note: plainString(source.note, `${label}[${index}].note`),
    };
  });
}

/**
 * Validates the authored review table and answers it in the shape the file holds.
 *
 * The list, not a lookup, for the same reason the cue parser answers one: the authoring endpoint
 * writes whatever this returns, and a reshaped answer writes a file the next load rejects. Anything
 * wanting a lookup builds one with {@link sfxReviewById}.
 */
export function parseSfxReview(value: unknown): readonly SfxReviewEntry[] {
  if (!Array.isArray(value)) {
    throw new TypeError("SFX review must be an array.");
  }

  const parsed = new Map<SfxCueId, SfxReviewEntry>();

  value.forEach((entry, index) => {
    const label = `sfxReview[${index}]`;
    const source = record(entry, label);
    const id = source.id;

    if (typeof id !== "string" || !SFX_CUE_IDS.includes(id as SfxCueId)) {
      throw new TypeError(`${label}.id must name a cue.`);
    }

    if (parsed.has(id as SfxCueId)) {
      throw new TypeError(`${label}.id is listed twice.`);
    }

    parsed.set(id as SfxCueId, {
      id: id as SfxCueId,
      trigger: plainString(source.trigger, `${label}.trigger`),
      catalogPath: plainString(source.catalogPath, `${label}.catalogPath`),
      fit: fitValue(source.fit, `${label}.fit`),
      note: plainString(source.note, `${label}.note`),
      tags: stringList(source.tags, `${label}.tags`),
      tried: parseTried(source.tried, `${label}.tried`),
    });
  });

  const missing = SFX_CUE_IDS.filter((id) => !parsed.has(id));

  if (missing.length > 0) {
    throw new TypeError(`SFX review is missing an entry for: ${missing.join(", ")}.`);
  }

  return [...parsed.values()];
}

/** The same table as a lookup, for the readers that want one. */
export function sfxReviewById(entries: readonly SfxReviewEntry[]): Readonly<Record<SfxCueId, SfxReviewEntry>> {
  return Object.fromEntries(entries.map((entry) => [entry.id, entry])) as Record<SfxCueId, SfxReviewEntry>;
}

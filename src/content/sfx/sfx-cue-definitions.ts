/**
 * The authored cue table, validated once at import.
 *
 * Parsed here rather than by each reader so a malformed table fails at load with a message naming the
 * row, instead of somewhere downstream as a cue that quietly plays nothing.
 */

import sfxCuesJson from "@/content/sfx/sfx-cues.json";
import { parseSfxCues, sfxCuesById, type SfxCue, type SfxCueId } from "@/content/sfx/sfx-cue-schema";

export type { SfxCue, SfxCueId, SfxRecipe, SfxWaveform, SfxFilter } from "@/content/sfx/sfx-cue-schema";
export { SFX_CUE_IDS, fromDb } from "@/content/sfx/sfx-cue-schema";

export const SFX_CUES: readonly SfxCue[] = parseSfxCues(sfxCuesJson);

const CUES_BY_ID = sfxCuesById(SFX_CUES);

/** The recipe for one cue. Total, because the table is validated to hold every declared id. */
export function sfxCue(id: SfxCueId): SfxCue {
  return CUES_BY_ID[id];
}

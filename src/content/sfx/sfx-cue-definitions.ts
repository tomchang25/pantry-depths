/**
 * The authored cue table, validated once at import, with its recordings resolved.
 *
 * Parsed here rather than by each reader so a malformed table fails at load with a message naming the
 * row, instead of somewhere downstream as a cue that quietly plays nothing.
 *
 * The asset imports are what turns a filename in the table into a URL the bundler has fingerprinted.
 * They cannot be checked by the validator — a URL does not exist until the bundler has resolved the
 * import — so the completeness check lives here instead, and it is deliberately load-time and loud.
 */

import sfxCuesJson from "@/content/sfx/sfx-cues.json";
import { parseSfxCues, sfxCuesById, type SfxCue, type SfxCueId } from "@/content/sfx/sfx-cue-schema";
import uiSelectUrl from "@/content/sfx/assets/uiSelect.wav";
import meleeSwingUrl from "@/content/sfx/assets/meleeSwing.wav";
import meleeHitFleshUrl from "@/content/sfx/assets/meleeHitFlesh.wav";
import meleeHitBoneUrl from "@/content/sfx/assets/meleeHitBone.wav";
import meleeHitWallStoneUrl from "@/content/sfx/assets/meleeHitWallStone.wav";
import meleeHitWallWoodUrl from "@/content/sfx/assets/meleeHitWallWood.wav";
import meleeHitAltarUrl from "@/content/sfx/assets/meleeHitAltar.wav";
import wallBreakStoneUrl from "@/content/sfx/assets/wallBreakStone.wav";
import wallBreakWoodUrl from "@/content/sfx/assets/wallBreakWood.wav";
import pinLandUrl from "@/content/sfx/assets/pinLand.wav";
import strikeLandUrl from "@/content/sfx/assets/strikeLand.wav";
import rockLandUrl from "@/content/sfx/assets/rockLand.wav";
import bodyLandUrl from "@/content/sfx/assets/bodyLand.wav";
import waterEntryUrl from "@/content/sfx/assets/waterEntry.wav";
import bombUrl from "@/content/sfx/assets/bomb.wav";
import rewardGainUrl from "@/content/sfx/assets/rewardGain.wav";
import playerHurtUrl from "@/content/sfx/assets/playerHurt.wav";
import playerDeathUrl from "@/content/sfx/assets/playerDeath.wav";

export type { SfxCue, SfxCueId, SfxRecipe, SfxWaveform, SfxFilter, SfxSource } from "@/content/sfx/sfx-cue-schema";
export { SFX_CUE_IDS, fromDb } from "@/content/sfx/sfx-cue-schema";

export const SFX_CUES: readonly SfxCue[] = parseSfxCues(sfxCuesJson);

const CUES_BY_ID = sfxCuesById(SFX_CUES);

/**
 * Every shipped recording, keyed by the cue that uses it.
 *
 * Three pairs deliberately share a take: `detonation`/`shellLand` are the same explosive going off,
 * `bodyBarge`/`bodyLand` are the same body arriving somewhere, and `throw`/`meleeSwing` are the same
 * arm moving. The rows stay separate so each keeps its own volume and rate limit.
 */
const SAMPLE_URLS: Partial<Record<SfxCueId, string>> = {
  uiSelect: uiSelectUrl,
  meleeSwing: meleeSwingUrl,
  meleeHitFlesh: meleeHitFleshUrl,
  meleeHitBone: meleeHitBoneUrl,
  meleeHitWallStone: meleeHitWallStoneUrl,
  meleeHitWallWood: meleeHitWallWoodUrl,
  meleeHitAltar: meleeHitAltarUrl,
  wallBreakStone: wallBreakStoneUrl,
  wallBreakWood: wallBreakWoodUrl,
  throw: meleeSwingUrl,
  pinLand: pinLandUrl,
  strikeLand: strikeLandUrl,
  rockLand: rockLandUrl,
  bodyBarge: bodyLandUrl,
  bodyLand: bodyLandUrl,
  waterEntry: waterEntryUrl,
  detonation: bombUrl,
  shellLand: bombUrl,
  rewardGain: rewardGainUrl,
  playerHurt: playerHurtUrl,
  playerDeath: playerDeathUrl,
};

const missingSamples = SFX_CUES.filter((cue) => cue.source === "sample" && SAMPLE_URLS[cue.id] === undefined);

if (missingSamples.length > 0) {
  throw new Error(`SFX cues declare a sample with no shipped file: ${missingSamples.map((cue) => cue.id).join(", ")}.`);
}

/** The recipe for one cue. Total, because the table is validated to hold every declared id. */
export function sfxCue(id: SfxCueId): SfxCue {
  return CUES_BY_ID[id];
}

/** Where a sample-backed cue's recording lives, once the bundler has placed it. */
export function sfxSampleUrl(id: SfxCueId): string | undefined {
  return SAMPLE_URLS[id];
}

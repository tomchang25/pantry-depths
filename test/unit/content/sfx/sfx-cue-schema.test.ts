import sfxCuesJson from "@/content/sfx/sfx-cues.json";
import { parseSfxCues, SFX_CUE_IDS } from "@/content/sfx/sfx-cue-schema";
import { describe, expect, it } from "vitest";

describe("parseSfxCues", () => {
  it("accepts the canonical authored table with one row per declared cue", () => {
    expect(parseSfxCues(sfxCuesJson)).toHaveLength(SFX_CUE_IDS.length);
  });

  it("rejects a table missing a declared cue", () => {
    expect(() => parseSfxCues([])).toThrow(/missing an entry for/);
  });

  it("rejects a malformed recipe value and an inverted pitch range", () => {
    const invalid = structuredClone(sfxCuesJson);
    const firstCue = invalid[0];

    if (!firstCue) {
      throw new Error("Canonical SFX cue fixture must not be empty.");
    }

    firstCue.recipe.durationSeconds = 0;
    expect(() => parseSfxCues(invalid)).toThrow(/durationSeconds must be greater than zero/);

    firstCue.recipe.durationSeconds = 0.1;
    firstCue.pitchMin = firstCue.pitchMax + 1;
    expect(() => parseSfxCues(invalid)).toThrow(/pitchMin must not exceed/);
  });
});

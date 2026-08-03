import sfxCuesJson from "@/content/sfx/sfx-cues.json";
import { parseSfxCues } from "@/content/sfx/sfx-cue-schema";
import { SFX_CUE_IDS } from "@/core/sfx-cues";
import { describe, expect, it } from "vitest";

/**
 * The authored table as loose records.
 *
 * The import's inferred type describes the one document that exists today; these cases exist to mutate
 * rows into shapes that document must never take, which that type is right to forbid and wrong to
 * enforce here.
 */
function mutableCues(): Record<string, unknown>[] {
  return structuredClone(sfxCuesJson) as unknown as Record<string, unknown>[];
}

/**
 * Rewrites one authored row into a recipe cue.
 *
 * The shipped table is sample-only since the coverage cut, so the recipe half of the parser can only be
 * exercised against a row built here; the id has to stay authored because the parser demands a row per
 * declared id.
 */
function withRecipeRow(cues: Record<string, unknown>[]): Record<string, unknown> {
  const row = cues[0];

  if (!row) {
    throw new Error("Canonical SFX cue fixture must hold at least one row.");
  }

  delete row.sample;
  row.source = "recipe";
  row.recipe = {
    waveform: "sine",
    frequencyStart: 200,
    frequencyEnd: 100,
    durationSeconds: 0.2,
    attackSeconds: 0.01,
    decaySeconds: 0.15,
    noiseMix: 0.2,
  };
  return row;
}

describe("parseSfxCues", () => {
  it("accepts the canonical authored table with one row per declared cue", () => {
    expect(parseSfxCues(sfxCuesJson)).toHaveLength(SFX_CUE_IDS.length);
  });

  it("rejects a table missing a declared cue", () => {
    expect(() => parseSfxCues([])).toThrow(/missing an entry for/);
  });

  it("carries the canonical table as sample cues, and still parses a recipe cue", () => {
    const parsed = parseSfxCues(sfxCuesJson);

    expect(parsed.every((cue) => cue.source === "sample" && "sample" in cue && !("recipe" in cue))).toBe(true);

    const withRecipe = mutableCues();
    const recipeId = withRecipeRow(withRecipe).id;
    const reparsed = parseSfxCues(withRecipe);
    const recipeCue = reparsed.find((cue) => cue.id === recipeId);

    expect(recipeCue?.source).toBe("recipe");
    expect(recipeCue !== undefined && "recipe" in recipeCue && !("sample" in recipeCue)).toBe(true);
  });

  it("rejects a row claiming both sources, and one claiming neither", () => {
    const bothSources = mutableCues();
    const sampleCue = bothSources.find((cue) => cue.source === "sample");

    if (!sampleCue) {
      throw new Error("Canonical SFX cue fixture must hold at least one sample cue.");
    }

    sampleCue.recipe = {
      waveform: "sine",
      frequencyStart: 1,
      frequencyEnd: 1,
      durationSeconds: 1,
      attackSeconds: 0,
      decaySeconds: 0,
      noiseMix: 0,
    };
    expect(() => parseSfxCues(bothSources)).toThrow(/must not also carry a recipe/);

    const noSource = mutableCues();
    delete noSource[0]?.source;
    expect(() => parseSfxCues(noSource)).toThrow(/source must be one of/);
  });

  it("rejects a sample name that is not a plain WAV file beside the table", () => {
    const escaping = mutableCues();
    const sampleCue = escaping.find((cue) => cue.source === "sample");

    if (!sampleCue) {
      throw new Error("Canonical SFX cue fixture must hold at least one sample cue.");
    }

    sampleCue.sample = "../secrets/elsewhere.wav";
    expect(() => parseSfxCues(escaping)).toThrow(/must name a WAV file/);
  });

  it("rejects a malformed recipe value and an inverted pitch range", () => {
    const invalid = mutableCues();
    const recipeCue = withRecipeRow(invalid);
    const recipe = recipeCue.recipe as Record<string, unknown>;
    recipe.durationSeconds = 0;
    expect(() => parseSfxCues(invalid)).toThrow(/durationSeconds must be greater than zero/);

    recipe.durationSeconds = 0.1;
    recipeCue.pitchMin = (recipeCue.pitchMax as number) + 1;
    expect(() => parseSfxCues(invalid)).toThrow(/pitchMin must not exceed/);
  });
});

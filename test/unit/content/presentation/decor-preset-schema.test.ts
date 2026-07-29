import decorPresetsJson from "@/content/presentation/decor-presets.json";
import { parseDecorPresets } from "@/content/presentation/decor-preset-schema";
import { describe, expect, it } from "vitest";

describe("parseDecorPresets", () => {
  it("accepts the canonical named decor variants", () => {
    expect(parseDecorPresets(decorPresetsJson)).toHaveLength(4);
  });

  it("rejects duplicate identities and invalid scale", () => {
    const duplicate = structuredClone(decorPresetsJson);
    const first = duplicate[0];
    const second = duplicate[1];

    if (!first || !second) {
      throw new Error("Canonical decor fixture must contain two presets.");
    }

    second.id = first.id;
    expect(() => parseDecorPresets(duplicate)).toThrow(/unique/);
    first.scale = 0;
    expect(() => parseDecorPresets(duplicate)).toThrow(/greater than zero/);
  });
});

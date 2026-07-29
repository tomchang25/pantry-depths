import meleeAttacksJson from "@/content/viewmodel/melee-attacks.json";
import { parseMeleeAttacks } from "@/content/viewmodel/melee-attack-schema";
import { describe, expect, it } from "vitest";

describe("parseMeleeAttacks", () => {
  it("accepts the canonical eight-attack authored document", () => {
    expect(parseMeleeAttacks(meleeAttacksJson)).toHaveLength(8);
  });

  it("rejects missing ids and non-finite pose values", () => {
    const invalid = structuredClone(meleeAttacksJson);
    const firstAttack = invalid[0];

    if (!firstAttack) {
      throw new Error("Canonical melee attacks fixture must not be empty.");
    }

    firstAttack.windup.angle = Number.NaN;
    expect(() => parseMeleeAttacks([])).toThrow(/each of the eight/);
    expect(() => parseMeleeAttacks(invalid)).toThrow(/finite number/);
  });
});

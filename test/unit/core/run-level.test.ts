import { LEVEL_PER_DESCENT, LEVEL_PER_MINUTE, runLevel } from "@/core/run-level";
import { describe, expect, it } from "vitest";

/**
 * The run's one difficulty number, named in the rules-move spec: derived from time and depth,
 * never stored, and priced so five minutes on a floor costs the same as one descent.
 */

describe("the run level", () => {
  it("starts at zero and never reads a negative clock", () => {
    expect(runLevel({ elapsedSeconds: 0, depth: 1 })).toBe(0);
    expect(runLevel({ elapsedSeconds: -30, depth: 0 })).toBe(0);
  });

  it("prices a floor at five minutes: the exchange rate the tasks are decided against", () => {
    expect(runLevel({ elapsedSeconds: 5 * 60, depth: 1 })).toBe(5 * LEVEL_PER_MINUTE);
    expect(runLevel({ elapsedSeconds: 0, depth: 2 })).toBe(LEVEL_PER_DESCENT);
    expect(runLevel({ elapsedSeconds: 5 * 60, depth: 1 })).toBe(runLevel({ elapsedSeconds: 0, depth: 2 }));
  });

  it("adds minutes and descents rather than trading them", () => {
    expect(runLevel({ elapsedSeconds: 130, depth: 3 })).toBe(2 * LEVEL_PER_MINUTE + 2 * LEVEL_PER_DESCENT);
  });
});

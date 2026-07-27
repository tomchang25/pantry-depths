import { commandForKey, normalizeKey } from "@/runtime/keymap";
import { describe, expect, it } from "vitest";

describe("normalizeKey", () => {
  it("lowercases single-character keys", () => {
    expect(normalizeKey("W")).toBe("w");
    expect(normalizeKey("w")).toBe("w");
  });

  it("leaves named keys untouched", () => {
    expect(normalizeKey("Shift")).toBe("Shift");
    expect(normalizeKey("ArrowUp")).toBe("ArrowUp");
  });
});

describe("commandForKey", () => {
  it("maps every gameplay key case-insensitively", () => {
    expect(commandForKey("w")).toBe("forward");
    expect(commandForKey("W")).toBe("forward");
    expect(commandForKey("s")).toBe("backward");
    expect(commandForKey("S")).toBe("backward");
    expect(commandForKey("a")).toBe("strafeLeft");
    expect(commandForKey("A")).toBe("strafeLeft");
    expect(commandForKey("d")).toBe("strafeRight");
    expect(commandForKey("D")).toBe("strafeRight");
    expect(commandForKey("q")).toBe("turnLeft");
    expect(commandForKey("Q")).toBe("turnLeft");
    expect(commandForKey("e")).toBe("turnRight");
    expect(commandForKey("E")).toBe("turnRight");
    expect(commandForKey("f")).toBe("interact");
    expect(commandForKey("F")).toBe("interact");
  });

  it("returns undefined for keys outside the gameplay command set", () => {
    expect(commandForKey("r")).toBeUndefined();
    expect(commandForKey("Shift")).toBeUndefined();
    expect(commandForKey("ArrowUp")).toBeUndefined();
    expect(commandForKey(" ")).toBeUndefined();
  });
});

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
    expect(commandForKey("a")).toBe("turnLeft");
    expect(commandForKey("A")).toBe("turnLeft");
    expect(commandForKey("d")).toBe("turnRight");
    expect(commandForKey("D")).toBe("turnRight");
    expect(commandForKey("s")).toBe("backward");
    expect(commandForKey("S")).toBe("backward");
    expect(commandForKey("e")).toBe("interact");
    expect(commandForKey("E")).toBe("interact");
  });

  it("returns undefined for keys outside the gameplay command set", () => {
    expect(commandForKey("q")).toBeUndefined();
    expect(commandForKey("Shift")).toBeUndefined();
    expect(commandForKey("ArrowUp")).toBeUndefined();
    expect(commandForKey(" ")).toBeUndefined();
  });
});

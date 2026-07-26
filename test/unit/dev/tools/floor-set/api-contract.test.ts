import { FLOOR_AUTHORING_API_ROOT } from "../../../../../dev/tools/floor-set/api-contract";
import { API_ROOT } from "@/app/debug/floor-workbench";
import { describe, expect, it } from "vitest";

describe("floor authoring API root", () => {
  it("holds the workbench client copy equal to the tooling declaration", () => {
    expect(API_ROOT).toBe(FLOOR_AUTHORING_API_ROOT);
  });
});

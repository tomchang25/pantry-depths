import { AUTHORING_API_ROOT } from "../../../../../dev/tools/authoring/api-contract";
import { API_ROOT } from "@/app/debug/floor-workbench";
import { describe, expect, it } from "vitest";

describe("authoring API root", () => {
  it("holds the workbench client copy equal to the tooling declaration", () => {
    expect(API_ROOT).toBe(AUTHORING_API_ROOT);
  });
});

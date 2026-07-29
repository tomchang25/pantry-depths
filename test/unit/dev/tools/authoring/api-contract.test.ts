import { AUTHORING_API_ROOT } from "../../../../../dev/tools/authoring/api-contract";
import { AUTHORING_API_ROOT as CLIENT_AUTHORING_API_ROOT } from "@/app/debug/authoring-client";
import { describe, expect, it } from "vitest";

describe("authoring API root", () => {
  it("holds the workbench client copy equal to the tooling declaration", () => {
    expect(CLIENT_AUTHORING_API_ROOT).toBe(AUTHORING_API_ROOT);
  });
});

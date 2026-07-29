import { AUTHORING_API_ROOT, type AuthoringTargetId } from "../../../../../dev/tools/authoring/api-contract";
import { handleAuthoringRequest, type AuthoringDependencies } from "../../../../../dev/tools/authoring/authoring-api";
import { generateFloorSet } from "../../../../../dev/tools/floor-set/generator";
import { MELEE_ATTACKS } from "@/content/viewmodel/melee-viewmodel";
import { describe, expect, it, vi } from "vitest";

function createDependencies(): AuthoringDependencies & Readonly<{ writeCanonical: ReturnType<typeof vi.fn> }> {
  const sources: Readonly<Record<AuthoringTargetId, unknown>> = {
    floorSet: generateFloorSet({ seed: 1, floorCount: 1 }),
    meleeAttacks: MELEE_ATTACKS,
  };
  return {
    readCanonical: async (target) => JSON.stringify(sources[target]),
    writeCanonical: vi.fn(async () => undefined),
  };
}

describe("handleAuthoringRequest", () => {
  it("loads a whitelisted target and generates deterministic floor content without writing", async () => {
    const dependencies = createDependencies();
    const loaded = await handleAuthoringRequest(
      { method: "GET", pathname: `${AUTHORING_API_ROOT}/meleeAttacks/canonical` },
      dependencies,
    );
    const generated = await handleAuthoringRequest(
      {
        method: "POST",
        pathname: `${AUTHORING_API_ROOT}/floorSet/generate`,
        body: { seed: 42, floorCount: 3 },
      },
      dependencies,
    );

    expect(loaded).toMatchObject({ status: 200, body: { source: MELEE_ATTACKS } });
    expect(generated).toMatchObject({
      status: 200,
      body: { source: generateFloorSet({ seed: 42, floorCount: 3 }) },
    });
    expect(dependencies.writeCanonical).not.toHaveBeenCalled();
  });

  it("rejects paths outside the target whitelist and invalid generation input", async () => {
    const dependencies = createDependencies();
    const unknown = await handleAuthoringRequest(
      { method: "GET", pathname: `${AUTHORING_API_ROOT}/other/canonical` },
      dependencies,
    );
    const invalid = await handleAuthoringRequest(
      {
        method: "POST",
        pathname: `${AUTHORING_API_ROOT}/floorSet/generate`,
        body: { seed: 17, floorCount: 0 },
      },
      dependencies,
    );

    expect(unknown).toMatchObject({ status: 400 });
    expect(invalid).toEqual({ status: 400, body: { message: "floorCount must be at least 1." } });
    expect(dependencies.writeCanonical).not.toHaveBeenCalled();
  });

  it("validates each target with its own contract before writing", async () => {
    const dependencies = createDependencies();
    const invalidFloor = await handleAuthoringRequest(
      {
        method: "POST",
        pathname: `${AUTHORING_API_ROOT}/floorSet/save`,
        body: { source: { schemaVersion: 1 } },
      },
      dependencies,
    );
    const invalidAttacks = await handleAuthoringRequest(
      {
        method: "POST",
        pathname: `${AUTHORING_API_ROOT}/meleeAttacks/save`,
        body: { source: [] },
      },
      dependencies,
    );

    expect(invalidFloor).toMatchObject({ status: 422 });
    expect(invalidAttacks).toMatchObject({ status: 422 });
    expect(dependencies.writeCanonical).not.toHaveBeenCalled();
  });

  it("formats and writes valid melee attacks only to their whitelisted target", async () => {
    const dependencies = createDependencies();
    const saved = await handleAuthoringRequest(
      {
        method: "POST",
        pathname: `${AUTHORING_API_ROOT}/meleeAttacks/save`,
        body: { source: MELEE_ATTACKS },
      },
      dependencies,
    );

    expect(saved).toMatchObject({ status: 200 });
    expect(dependencies.writeCanonical).toHaveBeenCalledOnce();
    expect(dependencies.writeCanonical).toHaveBeenCalledWith(
      "meleeAttacks",
      `${JSON.stringify(MELEE_ATTACKS, null, 2)}\n`,
    );
  });
});

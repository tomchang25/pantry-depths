import { FLOOR_AUTHORING_API_ROOT } from "../../../../../dev/tools/floor-set/api-contract";
import {
  handleFloorAuthoringRequest,
  type FloorAuthoringDependencies,
} from "../../../../../dev/tools/floor-set/authoring-api";
import { generateFloorSet } from "../../../../../dev/tools/floor-set/generator";
import { describe, expect, it, vi } from "vitest";

function createDependencies(
  source = generateFloorSet({ seed: 1, floorCount: 1 }),
): FloorAuthoringDependencies & Readonly<{ writeCanonical: ReturnType<typeof vi.fn> }> {
  return {
    readCanonical: async () => JSON.stringify(source),
    writeCanonical: vi.fn(async () => undefined),
  };
}

describe("handleFloorAuthoringRequest", () => {
  it("loads canonical JSON and generates deterministic draft content without writing", async () => {
    const dependencies = createDependencies();
    const loaded = await handleFloorAuthoringRequest(
      { method: "GET", pathname: `${FLOOR_AUTHORING_API_ROOT}/canonical` },
      dependencies,
    );
    const generated = await handleFloorAuthoringRequest(
      {
        method: "POST",
        pathname: `${FLOOR_AUTHORING_API_ROOT}/generate`,
        body: { seed: 42, floorCount: 3 },
      },
      dependencies,
    );

    expect(loaded).toMatchObject({ status: 200 });
    expect(generated).toMatchObject({
      status: 200,
      body: { source: generateFloorSet({ seed: 42, floorCount: 3 }) },
    });
    expect(dependencies.writeCanonical).not.toHaveBeenCalled();
  });

  it("rejects a non-positive generated floor count as a bad request", async () => {
    const dependencies = createDependencies();
    const response = await handleFloorAuthoringRequest(
      {
        method: "POST",
        pathname: `${FLOOR_AUTHORING_API_ROOT}/generate`,
        body: { seed: 17, floorCount: 0 },
      },
      dependencies,
    );

    expect(response).toEqual({ status: 400, body: { message: "floorCount must be at least 1." } });
    expect(dependencies.writeCanonical).not.toHaveBeenCalled();
  });

  it("rejects invalid or non-canonical saves without writing", async () => {
    const dependencies = createDependencies();
    const wrongTarget = await handleFloorAuthoringRequest(
      {
        method: "POST",
        pathname: `${FLOOR_AUTHORING_API_ROOT}/save`,
        body: { target: "tmp/other.json", source: generateFloorSet({ seed: 1, floorCount: 1 }) },
      },
      dependencies,
    );
    const invalid = await handleFloorAuthoringRequest(
      {
        method: "POST",
        pathname: `${FLOOR_AUTHORING_API_ROOT}/save`,
        body: { target: "canonical", source: { schemaVersion: 1 } },
      },
      dependencies,
    );

    expect(wrongTarget).toMatchObject({ status: 400 });
    expect(invalid).toMatchObject({ status: 422 });
    expect(dependencies.writeCanonical).not.toHaveBeenCalled();
  });

  it("formats and writes a valid draft only after server-side validation", async () => {
    const dependencies = createDependencies();
    const source = generateFloorSet({ seed: 7, floorCount: 2 });
    const saved = await handleFloorAuthoringRequest(
      {
        method: "POST",
        pathname: `${FLOOR_AUTHORING_API_ROOT}/save`,
        body: { target: "canonical", source },
      },
      dependencies,
    );

    expect(saved).toMatchObject({ status: 200 });
    expect(dependencies.writeCanonical).toHaveBeenCalledOnce();
    expect(dependencies.writeCanonical).toHaveBeenCalledWith(`${JSON.stringify(source, null, 2)}\n`);
  });
});

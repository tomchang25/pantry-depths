import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CANONICAL_FLOOR_SET_PATH, FLOOR_AUTHORING_API_ROOT } from "./api-contract";
import { generateFloorSet } from "./generator";
import { parseFloorSet } from "@/content/floor/floor-schema";
import { validateFloorSet } from "@/content/floor/floor-validation";

export type FloorAuthoringRequest = Readonly<{
  method: string;
  pathname: string;
  body?: unknown;
}>;

export type FloorAuthoringResponse = Readonly<{
  status: number;
  body: unknown;
}>;

export type FloorAuthoringDependencies = Readonly<{
  readCanonical(): Promise<string>;
  writeCanonical(content: string): Promise<void>;
}>;

class FloorAuthoringRequestError extends Error {}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FloorAuthoringRequestError(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function asInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new FloorAuthoringRequestError(`${label} must be an integer.`);
  }

  return value;
}

function asCount(value: unknown, label: string, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const count = asInteger(value, label);

  if (count < 0) {
    throw new FloorAuthoringRequestError(`${label} must not be negative.`);
  }

  return count;
}

/**
 * Handles one development-only floor authoring operation without depending on Vite request objects.
 *
 * Only `save` validates. The read-only `canonical` and `generate` operations hand the draft back
 * unvalidated because the workbench always revalidates client-side before it previews or saves.
 */
export async function handleFloorAuthoringRequest(
  request: FloorAuthoringRequest,
  dependencies: FloorAuthoringDependencies,
): Promise<FloorAuthoringResponse | undefined> {
  if (!request.pathname.startsWith(`${FLOOR_AUTHORING_API_ROOT}/`)) {
    return undefined;
  }

  try {
    if (request.method === "GET" && request.pathname === `${FLOOR_AUTHORING_API_ROOT}/canonical`) {
      const source = JSON.parse(await dependencies.readCanonical()) as unknown;
      return { status: 200, body: { source } };
    }

    if (request.method === "POST" && request.pathname === `${FLOOR_AUTHORING_API_ROOT}/generate`) {
      const body = asRecord(request.body, "generate request");
      const seed = asInteger(body.seed, "seed");
      const floorCount = asInteger(body.floorCount, "floorCount");

      if (floorCount < 1) {
        throw new FloorAuthoringRequestError("floorCount must be at least 1.");
      }

      const source = generateFloorSet({
        seed,
        floorCount,
        keysPerFloor: asCount(body.keysPerFloor, "keysPerFloor", 1),
        doorsPerFloor: asCount(body.doorsPerFloor, "doorsPerFloor", 1),
        enemiesPerFloor: asCount(body.enemiesPerFloor, "enemiesPerFloor", 1),
      });
      return { status: 200, body: { source } };
    }

    if (request.method === "POST" && request.pathname === `${FLOOR_AUTHORING_API_ROOT}/save`) {
      const body = asRecord(request.body, "save request");

      if (body.target !== "canonical") {
        throw new FloorAuthoringRequestError("Save target must be canonical.");
      }

      const validation = validateFloorSet(body.source);
      const errors = validation.findings.filter((finding) => finding.severity === "error");

      if (errors.length > 0 || !validation.solution) {
        return {
          status: 422,
          body: { message: "Floor-set validation failed; canonical content was not changed.", validation },
        };
      }

      const parsed = parseFloorSet(body.source);
      await dependencies.writeCanonical(`${JSON.stringify(parsed, null, 2)}\n`);
      return { status: 200, body: { message: "Canonical floor-set content saved.", source: parsed } };
    }

    return { status: 405, body: { message: "Unsupported floor authoring operation." } };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unable to complete floor authoring request.";
    const rejected = caught instanceof FloorAuthoringRequestError || caught instanceof RangeError;
    return { status: rejected ? 400 : 500, body: { message } };
  }
}

/** Creates filesystem dependencies confined to the one canonical floor-set path. */
export function createFloorAuthoringDependencies(projectRoot: string): FloorAuthoringDependencies {
  const canonicalPath = resolve(projectRoot, CANONICAL_FLOOR_SET_PATH);

  return {
    readCanonical: () => readFile(canonicalPath, "utf8"),
    writeCanonical: (content) => writeFile(canonicalPath, content, "utf8"),
  };
}

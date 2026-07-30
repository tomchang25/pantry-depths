import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { AUTHORING_API_ROOT, CANONICAL_AUTHORING_PATHS, type AuthoringTargetId } from "./api-contract";
import { generateFloorSet } from "../floor-set/generator";
import { parseFloorSet } from "@/content/floor/floor-schema";
import { validateFloorSet } from "@/content/floor/floor-validation";
import { parseEntityDisplays } from "@/content/enemies/entity-display-schema";
import { parseDecorPresets } from "@/content/presentation/decor-preset-schema";
import { parseMeleeAttacks } from "@/content/viewmodel/melee-attack-schema";

export type AuthoringRequest = Readonly<{
  method: string;
  pathname: string;
  body?: unknown;
}>;

export type AuthoringResponse = Readonly<{
  status: number;
  body: unknown;
}>;

export type AuthoringDependencies = Readonly<{
  readCanonical(target: AuthoringTargetId): Promise<string>;
  writeCanonical(target: AuthoringTargetId, content: string): Promise<void>;
}>;

class AuthoringRequestError extends Error {}

class AuthoringValidationError extends Error {
  public constructor(
    message: string,
    readonly validation?: unknown,
  ) {
    super(message);
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthoringRequestError(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function asInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new AuthoringRequestError(`${label} must be an integer.`);
  }

  return value;
}

function asOptionalInteger(value: unknown, label: string): number | undefined {
  return value === undefined ? undefined : asInteger(value, label);
}

function asOptionalCount(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const count = asInteger(value, label);

  if (count < 0) {
    throw new AuthoringRequestError(`${label} must not be negative.`);
  }

  return count;
}

function targetId(value: string): AuthoringTargetId | undefined {
  return Object.hasOwn(CANONICAL_AUTHORING_PATHS, value) ? (value as AuthoringTargetId) : undefined;
}

function parsePath(pathname: string): Readonly<{ operation: string; target: AuthoringTargetId }> | undefined {
  if (!pathname.startsWith(`${AUTHORING_API_ROOT}/`)) {
    return undefined;
  }

  const [targetValue, operation, extra] = pathname.slice(AUTHORING_API_ROOT.length + 1).split("/");
  const target = targetValue ? targetId(targetValue) : undefined;

  if (!target || !operation || extra !== undefined) {
    throw new AuthoringRequestError("Authoring path must name one whitelisted target and one operation.");
  }

  return { target, operation };
}

/**
 * Validates one target's payload and answers what should be written to its canonical file.
 *
 * **A validator must answer the same shape its file holds.** The save path writes this return value
 * verbatim, so a parser that helpfully reshapes its input — an array into a lookup, say — writes a file
 * its own next load will reject, and the failure lands on whoever opens the tool afterwards rather than
 * on whoever saved. Reshape at the point of use, never here.
 */
function validateSource(target: AuthoringTargetId, source: unknown): unknown {
  if (target === "decor") {
    try {
      return parseDecorPresets(source);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Decor preset validation failed.";
      throw new AuthoringValidationError(`${message} Canonical content was not changed.`);
    }
  }

  if (target === "entityDisplay") {
    try {
      return parseEntityDisplays(source);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Entity display validation failed.";
      throw new AuthoringValidationError(`${message} Canonical content was not changed.`);
    }
  }

  if (target === "floorSet") {
    const validation = validateFloorSet(source);
    const errors = validation.findings.filter((finding) => finding.severity === "error");

    if (errors.length > 0 || !validation.solution) {
      throw new AuthoringValidationError("Floor-set validation failed; canonical content was not changed.", validation);
    }

    return parseFloorSet(source);
  }

  if (target === "meleeAttacks") {
    try {
      return parseMeleeAttacks(source);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Melee attack validation failed.";
      throw new AuthoringValidationError(`${message} Canonical content was not changed.`);
    }
  }

  target satisfies never;
  throw new Error("Unknown authoring target.");
}

function generateFloorSource(bodyValue: unknown): unknown {
  const body = asRecord(bodyValue, "generate request");
  const seed = asInteger(body.seed, "seed");
  const floorCount = asInteger(body.floorCount, "floorCount");

  if (floorCount < 1) {
    throw new AuthoringRequestError("floorCount must be at least 1.");
  }

  const width = asOptionalInteger(body.width, "width");
  const height = asOptionalInteger(body.height, "height");
  const redKeys = asOptionalCount(body.redKeys, "redKeys");
  const redDoors = asOptionalCount(body.redDoors, "redDoors");
  const blueKeys = asOptionalCount(body.blueKeys, "blueKeys");
  const blueDoors = asOptionalCount(body.blueDoors, "blueDoors");
  const yellowKeys = asOptionalCount(body.yellowKeys, "yellowKeys");
  const yellowDoors = asOptionalCount(body.yellowDoors, "yellowDoors");
  const enemies = asOptionalCount(body.enemies, "enemies");

  return generateFloorSet({
    seed,
    floorCount,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(redKeys !== undefined ? { redKeys } : {}),
    ...(redDoors !== undefined ? { redDoors } : {}),
    ...(blueKeys !== undefined ? { blueKeys } : {}),
    ...(blueDoors !== undefined ? { blueDoors } : {}),
    ...(yellowKeys !== undefined ? { yellowKeys } : {}),
    ...(yellowDoors !== undefined ? { yellowDoors } : {}),
    ...(enemies !== undefined ? { enemies } : {}),
  });
}

/** Handles every read, generation, and save through one target-whitelisted request boundary. */
export async function handleAuthoringRequest(
  request: AuthoringRequest,
  dependencies: AuthoringDependencies,
): Promise<AuthoringResponse | undefined> {
  try {
    const route = parsePath(request.pathname);

    if (!route) {
      return undefined;
    }

    if (request.method === "GET" && route.operation === "canonical") {
      const source = JSON.parse(await dependencies.readCanonical(route.target)) as unknown;
      return { status: 200, body: { source } };
    }

    if (request.method === "POST" && route.operation === "generate" && route.target === "floorSet") {
      return { status: 200, body: { source: generateFloorSource(request.body) } };
    }

    if (request.method === "POST" && route.operation === "save") {
      const body = asRecord(request.body, "save request");
      const source = validateSource(route.target, body.source);
      await dependencies.writeCanonical(route.target, `${JSON.stringify(source, null, 2)}\n`);
      return {
        status: 200,
        body: { message: `Canonical ${route.target} content saved.`, source },
      };
    }

    return { status: 405, body: { message: "Unsupported authoring operation for this target." } };
  } catch (caught) {
    if (caught instanceof AuthoringValidationError) {
      return {
        status: 422,
        body: {
          message: caught.message,
          ...(caught.validation === undefined ? {} : { validation: caught.validation }),
        },
      };
    }

    const message = caught instanceof Error ? caught.message : "Unable to complete authoring request.";
    const rejected = caught instanceof AuthoringRequestError || caught instanceof RangeError;
    return { status: rejected ? 400 : 500, body: { message } };
  }
}

/** Creates filesystem dependencies whose paths can only come from the checked-in target whitelist. */
export function createAuthoringDependencies(projectRoot: string): AuthoringDependencies {
  const canonicalPaths = Object.fromEntries(
    Object.entries(CANONICAL_AUTHORING_PATHS).map(([target, path]) => [target, resolve(projectRoot, path)]),
  ) as Readonly<Record<AuthoringTargetId, string>>;

  return {
    readCanonical: (target) => readFile(canonicalPaths[target], "utf8"),
    writeCanonical: (target, content) => writeFile(canonicalPaths[target], content, "utf8"),
  };
}

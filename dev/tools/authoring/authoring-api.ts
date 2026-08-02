import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  AUTHORING_API_ROOT,
  CANONICAL_AUTHORING_PATHS,
  type AuthoringFile,
  type AuthoringTargetId,
} from "./api-contract";
import { parseEntityDisplays } from "@/content/enemies/entity-display-schema";
import { MAP_NAME_PATTERN, parseMapSource } from "@/content/maps/map-schema";
import { ROOM_ID_PATTERN, parseRoomSource } from "@/content/maps/room-schema";
import { parsePropDisplays } from "@/content/presentation/prop-display-schema";
import { parseSfxCues } from "@/content/sfx/sfx-cue-schema";
import { parseSfxReview } from "@/content/sfx/sfx-review-schema";
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
  readCanonical(file: AuthoringFile): Promise<string>;
  writeCanonical(file: AuthoringFile, content: string): Promise<void>;
  /**
   * The names a directory target currently holds, without their suffix.
   *
   * Only a directory target has one. A library is discovered rather than listed in code, and the tool
   * that edits one creates files — so something has to be able to ask what is there now, and a build-time
   * view of the directory is fixed at the moment the page loaded.
   */
  listCanonical(target: AuthoringTargetId): Promise<readonly string[]>;
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

function targetId(value: string): AuthoringTargetId | undefined {
  return Object.hasOwn(CANONICAL_AUTHORING_PATHS, value) ? (value as AuthoringTargetId) : undefined;
}

/**
 * What a name in a directory target may look like.
 *
 * The content layer's own patterns rather than a third one written here. A name the library would
 * refuse to load is a name the endpoint has no business writing, and the two rules drifting apart is
 * how a file gets saved that nothing can open afterwards.
 */
const NAME_PATTERNS: Readonly<Record<string, RegExp>> = { map: MAP_NAME_PATTERN, room: ROOM_ID_PATTERN };

/**
 * Refuses a name that is not a plain slug.
 *
 * This is the whole of what keeps a directory target inside its directory. A slug has no separator, no
 * dot and no drive letter, so nothing that passes here can climb out of the directory it is joined to —
 * and this is a development-only endpoint writing straight into the working tree, so the check is
 * made twice: once where a request is read, and again where a path is built.
 */
function checkedName(target: AuthoringTargetId, name: string): string {
  const pattern = NAME_PATTERNS[target];

  if (!pattern || !pattern.test(name)) {
    throw new AuthoringRequestError(`"${name}" is not a plain lowercase slug, so it cannot name a ${target}.`);
  }

  return name;
}

function parsePath(pathname: string): (AuthoringFile & Readonly<{ operation: string }>) | undefined {
  if (!pathname.startsWith(`${AUTHORING_API_ROOT}/`)) {
    return undefined;
  }

  const [targetValue, operation, name, extra] = pathname.slice(AUTHORING_API_ROOT.length + 1).split("/");
  const target = targetValue ? targetId(targetValue) : undefined;

  if (!target || !operation || extra !== undefined) {
    throw new AuthoringRequestError("Authoring path must name one whitelisted target and one operation.");
  }

  const entry = CANONICAL_AUTHORING_PATHS[target];

  if (!("directory" in entry)) {
    if (name !== undefined) {
      throw new AuthoringRequestError(`The ${target} target is one file, so it takes no name.`);
    }

    return { target, operation };
  }

  // Listing is the one operation on a directory target that is about the directory rather than a file in
  // it, so it is the one that takes no name — and it is decided before the rejection below, which exists
  // to stop a request addressing a whole directory as though it were a file.
  if (operation === "list") {
    if (name !== undefined) {
      throw new AuthoringRequestError(`Listing the ${target} target names no file.`);
    }

    return { target, operation };
  }

  if (name === undefined) {
    throw new AuthoringRequestError(`The ${target} target is a directory, so a request must say which one.`);
  }

  return { target, operation, name: checkedName(target, name) };
}

/**
 * Validates one target's payload and answers what should be written to its canonical file.
 *
 * **A validator must answer the same shape its file holds.** The save path writes this return value
 * verbatim, so a parser that helpfully reshapes its input — an array into a lookup, say — writes a file
 * its own next load will reject, and the failure lands on whoever opens the tool afterwards rather than
 * on whoever saved. Reshape at the point of use, never here.
 *
 * A directory target checks one thing more: that the identity inside the file is the name the request
 * addressed. A map's file is named after the map and a room's after the room, so a mismatch writes a
 * file the library refuses — and it refuses the whole library, not just that file.
 */
function validateSource(file: AuthoringFile, source: unknown): unknown {
  const { target } = file;

  if (target === "map") {
    try {
      const map = parseMapSource(source);

      if (map.name !== file.name) {
        throw new TypeError(`This map declares the name "${map.name}", and it was saved as "${file.name ?? ""}".`);
      }

      return map;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Map validation failed.";
      throw new AuthoringValidationError(`${message} Canonical content was not changed.`);
    }
  }

  if (target === "room") {
    try {
      const room = parseRoomSource(source);

      if (room.id !== file.name) {
        throw new TypeError(`This room declares the id "${room.id}", and it was saved as "${file.name ?? ""}".`);
      }

      return room;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Room validation failed.";
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

  if (target === "propDisplay") {
    try {
      return parsePropDisplays(source);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Prop display validation failed.";
      throw new AuthoringValidationError(`${message} Canonical content was not changed.`);
    }
  }

  if (target === "meleeAttacks") {
    try {
      return parseMeleeAttacks(source);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Melee attack validation failed.";
      throw new AuthoringValidationError(`${message} Canonical content was not changed.`);
    }
  }

  if (target === "sfx") {
    try {
      return parseSfxCues(source);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "SFX cue validation failed.";
      throw new AuthoringValidationError(`${message} Canonical content was not changed.`);
    }
  }

  if (target === "sfxReview") {
    try {
      return parseSfxReview(source);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "SFX review validation failed.";
      throw new AuthoringValidationError(`${message} Canonical content was not changed.`);
    }
  }

  target satisfies never;
  throw new Error("Unknown authoring target.");
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

    const file: AuthoringFile =
      route.name === undefined ? { target: route.target } : { target: route.target, name: route.name };
    const named = route.name === undefined ? `${route.target} content` : `${route.target} "${route.name}"`;

    if (request.method === "GET" && route.operation === "canonical") {
      const source = JSON.parse(await dependencies.readCanonical(file)) as unknown;
      return { status: 200, body: { source } };
    }

    if (request.method === "GET" && route.operation === "list") {
      if (!("directory" in CANONICAL_AUTHORING_PATHS[route.target])) {
        return {
          status: 405,
          body: { message: `The ${route.target} target is one file, so there is nothing to list.` },
        };
      }

      return { status: 200, body: { names: await dependencies.listCanonical(route.target) } };
    }

    if (request.method === "POST" && route.operation === "save") {
      const body = asRecord(request.body, "save request");
      const source = validateSource(file, body.source);
      await dependencies.writeCanonical(file, `${JSON.stringify(source, null, 2)}\n`);
      return {
        status: 200,
        body: { message: `Canonical ${named} saved.`, source },
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

/**
 * Turns one whitelisted target into one absolute path.
 *
 * A directory target is the only place a request gets to contribute to a path, so the name is checked
 * against its content layer's own pattern again here rather than trusted from the request that carried
 * it. A slug cannot hold a separator, a dot, or a drive letter, so the join below cannot leave the
 * directory the whitelist named.
 */
function canonicalPath(projectRoot: string, file: AuthoringFile): string {
  const entry = CANONICAL_AUTHORING_PATHS[file.target];

  if (!("directory" in entry)) {
    return resolve(projectRoot, entry.file);
  }

  if (file.name === undefined) {
    throw new AuthoringRequestError(`The ${file.target} target is a directory, so a request must say which one.`);
  }

  return resolve(projectRoot, entry.directory, `${checkedName(file.target, file.name)}${entry.suffix}`);
}

/** Creates filesystem dependencies whose paths can only come from the checked-in target whitelist. */
export function createAuthoringDependencies(projectRoot: string): AuthoringDependencies {
  return {
    readCanonical: (file) => readFile(canonicalPath(projectRoot, file), "utf8"),
    writeCanonical: (file, content) => writeFile(canonicalPath(projectRoot, file), content, "utf8"),
    listCanonical: async (target) => {
      const entry = CANONICAL_AUTHORING_PATHS[target];

      if (!("directory" in entry)) {
        throw new AuthoringRequestError(`The ${target} target is one file, so there is nothing to list.`);
      }

      const entries = await readdir(resolve(projectRoot, entry.directory));

      // A name that could not be loaded back is a name nothing should be offered, so the same pattern
      // the library holds a file to decides what is listed. Anything else in the directory is not a
      // room or a map by that directory's own rule.
      return entries
        .filter((candidate) => candidate.endsWith(entry.suffix))
        .map((candidate) => candidate.slice(0, -entry.suffix.length))
        .filter((name) => NAME_PATTERNS[target]?.test(name) ?? false)
        .sort();
    },
  };
}

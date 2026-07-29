/**
 * The one mechanical guard behind a rule that was only ever prose.
 *
 * `dev/agent_rules/test_operations.md` has always said the demo half — `src/demo/` and
 * `src/presentation/` — is verified by playing it, and that tests must not be added there. Prose did
 * not hold: an agent added a four-case presentation suite anyway, and two of its assertions froze a
 * rendering bug in place as the expected answer. So the rule now fails a command instead of asking
 * to be read.
 *
 * The check is on imports, not directories, because the directory a test file sits in is the easiest
 * thing in the world to change and says nothing about what the test actually covers.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const TEST_ROOT = fileURLToPath(new URL("../../../test", import.meta.url));

/** The demo half. A test importing from either of these is covering something it must not cover. */
const BANNED_IMPORTS = ["@/demo/", "@/presentation/"] as const;

/**
 * Frozen, and it does not grow.
 *
 * This one predates the guard and covers the shipped asset manifest's loader — the boundary where a
 * missing or wrong-sized PNG becomes a startup failure, which no amount of playing the demo shows
 * you. Its subject stays testable; nothing joins it.
 */
const EXEMPT = ["unit/presentation/presentation-image-loader.test.ts"] as const;

function testFiles(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...testFiles(path));
      continue;
    }

    if (entry.name.endsWith(".test.ts")) {
      found.push(path);
    }
  }

  return found;
}

describe("the demo half is not a test subject", () => {
  it("has no test importing from src/demo or src/presentation", () => {
    const guard = relative(TEST_ROOT, fileURLToPath(import.meta.url))
      .split(sep)
      .join("/");
    const exempt = new Set<string>([...EXEMPT, guard]);
    const offenders = testFiles(TEST_ROOT)
      .map((path) => ({ path: relative(TEST_ROOT, path).split(sep).join("/"), source: readFileSync(path, "utf8") }))
      .filter((file) => !exempt.has(file.path))
      .filter((file) => BANNED_IMPORTS.some((banned) => file.source.includes(banned)))
      .map((file) => `test/${file.path}`);

    expect(
      offenders,
      "The demo is verified by playing it. Delete these and read dev/agent_rules/test_operations.md.",
    ).toEqual([]);
  });
});

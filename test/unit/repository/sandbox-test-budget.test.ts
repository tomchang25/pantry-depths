/**
 * The sandbox track's test budget, machine-enforced.
 *
 * `dev/agent_rules/test_operations.md`: a sandbox experiment (`src/sandbox/`) never gets browser
 * coverage, and its unit coverage is budgeted at one spec file holding at most three test cases.
 * The demo guard beside this file exists because prose alone did not hold; this rule starts out
 * enforced rather than waiting for the same lesson.
 *
 * As with the demo guard, the check is on what a test references, not where it sits.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const TEST_ROOT = fileURLToPath(new URL("../../../test", import.meta.url));

/** One spec file per experiment, and no more cases in it than this. */
const CASE_BUDGET = 3;

const SANDBOX_IMPORT = /@\/sandbox\/([^/'"]+)\//g;

/** Counts `it(...)`, `test(...)`, and their modifier forms such as `it.each(...)(...)`. */
const TEST_CASE = /\b(?:it|test)\b\s*(?:\.\w+\s*)*\(/g;

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }

    if (entry.name.endsWith(".ts")) {
      found.push(path);
    }
  }

  return found;
}

function posix(path: string): string {
  return relative(TEST_ROOT, path).split(sep).join("/");
}

const guard = posix(fileURLToPath(import.meta.url));

describe("the sandbox track stays inside its test budget", () => {
  it("has no browser spec referencing the sandbox tree", () => {
    const offenders = sourceFiles(join(TEST_ROOT, "e2e"))
      .map((path) => ({ path: posix(path), source: readFileSync(path, "utf8") }))
      .filter((file) => /sandbox/i.test(file.source))
      .map((file) => `test/${file.path}`);

    expect(
      offenders,
      "A sandbox experiment is verified by opening it. Delete these and read dev/agent_rules/test_operations.md.",
    ).toEqual([]);
  });

  it("has at most one unit spec of at most three cases per experiment", () => {
    const specs = sourceFiles(TEST_ROOT)
      .filter((path) => path.endsWith(".test.ts"))
      .map((path) => ({ path: posix(path), source: readFileSync(path, "utf8") }))
      .filter((file) => file.path !== guard);

    const specsByExperiment = new Map<string, string[]>();
    const overdrawn: string[] = [];

    for (const file of specs) {
      const experiments = new Set(
        [...file.source.matchAll(SANDBOX_IMPORT)].flatMap((match) => (match[1] === undefined ? [] : [match[1]])),
      );

      if (experiments.size === 0) {
        continue;
      }

      for (const experiment of experiments) {
        const owners = specsByExperiment.get(experiment) ?? [];
        owners.push(`test/${file.path}`);
        specsByExperiment.set(experiment, owners);
      }

      const cases = file.source.match(TEST_CASE)?.length ?? 0;

      if (cases > CASE_BUDGET) {
        overdrawn.push(`test/${file.path} holds ${cases} cases; the budget is ${CASE_BUDGET}`);
      }
    }

    const crowded = [...specsByExperiment.entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(
        ([experiment, owners]) =>
          `experiment "${experiment}" is covered by ${owners.join(", ")}; the budget is one spec`,
      );

    expect(
      [...crowded, ...overdrawn],
      "The sandbox unit budget is one spec, three cases, per experiment. Read dev/agent_rules/test_operations.md.",
    ).toEqual([]);
  });
});

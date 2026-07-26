import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateFloorSet } from "@/content/floor/floor-validation";

const DEFAULT_INPUT = "src/content/floors/provisional-floor-set.json";

function parseInputPath(values: readonly string[]): string {
  if (values.length === 0) {
    return DEFAULT_INPUT;
  }

  if (values.length === 2 && values[0] === "--input" && values[1]) {
    return values[1];
  }

  throw new Error("Usage: npm run validate:floor-set -- [--input <path>]");
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    process.stdout.write("Usage: npm run validate:floor-set -- [--input <path>]\n");
    return;
  }

  const inputPath = resolve(parseInputPath(process.argv.slice(2)));
  const source = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
  const validation = validateFloorSet(source);
  const errors = validation.findings.filter((finding) => finding.severity === "error");

  for (const finding of validation.findings) {
    process.stdout.write(`${finding.severity.toUpperCase()} ${finding.code}: ${finding.message}\n`);
  }

  if (errors.length > 0 || !validation.solution) {
    process.stderr.write(`Floor-set validation failed for ${inputPath}.\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `Floor-set validation passed for ${inputPath} with a ${validation.solution.length}-step structural solution.\n`,
  );
}

void main().catch((caught: unknown) => {
  const message = caught instanceof Error ? caught.message : "Unable to validate floor-set data.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

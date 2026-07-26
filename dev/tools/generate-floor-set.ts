import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { generateFloorSet } from "./floor-set-generator";

type Arguments = Readonly<{
  floorCount: number;
  output?: string;
  seed: number;
  keysPerFloor: number;
  doorsPerFloor: number;
  enemiesPerFloor: number;
}>;

function parseInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${flag} requires an integer value.`);
  }

  return parsed;
}

function parseArguments(values: readonly string[]): Arguments {
  let seed = 1;
  let floorCount = 5;
  let keysPerFloor = 1;
  let doorsPerFloor = 1;
  let enemiesPerFloor = 1;
  let output: string | undefined;

  for (let index = 0; index < values.length; index += 1) {
    const flag = values[index];
    const value = values[index + 1];

    if (flag === "--seed") {
      seed = parseInteger(value, flag);
      index += 1;
      continue;
    }

    if (flag === "--floors") {
      floorCount = parseInteger(value, flag);
      index += 1;
      continue;
    }

    if (flag === "--keys") {
      keysPerFloor = parseInteger(value, flag);
      index += 1;
      continue;
    }

    if (flag === "--doors") {
      doorsPerFloor = parseInteger(value, flag);
      index += 1;
      continue;
    }

    if (flag === "--enemies") {
      enemiesPerFloor = parseInteger(value, flag);
      index += 1;
      continue;
    }

    if (flag === "--output") {
      if (!value) {
        throw new Error("--output requires a file path.");
      }

      output = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${flag}`);
  }

  return {
    floorCount,
    seed,
    keysPerFloor,
    doorsPerFloor,
    enemiesPerFloor,
    ...(output === undefined ? {} : { output }),
  };
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    process.stdout.write(
      "Usage: npm run generate:floor-set -- --seed <integer> --floors <positive integer>" +
        " [--keys <count per floor>] [--doors <count per floor>] [--enemies <count per floor>] [--output <path>]\n",
    );
    return;
  }

  const parsedArguments = parseArguments(process.argv.slice(2));
  const baked = `${JSON.stringify(generateFloorSet(parsedArguments), null, 2)}\n`;

  if (!parsedArguments.output) {
    process.stdout.write(baked);
    return;
  }

  const outputPath = resolve(parsedArguments.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, baked, "utf8");
  process.stdout.write(`Baked ${parsedArguments.floorCount} floors to ${outputPath}.\n`);
}

void main().catch((caught: unknown) => {
  const message = caught instanceof Error ? caught.message : "Unable to bake floors.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

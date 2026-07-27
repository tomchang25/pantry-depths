import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { generateFloorSet } from "./floor-set/generator";

type Arguments = Readonly<{
  floorCount: number;
  output?: string;
  seed: number;
  width?: number;
  height?: number;
  redKeys?: number;
  redDoors?: number;
  blueKeys?: number;
  blueDoors?: number;
  yellowKeys?: number;
  yellowDoors?: number;
  enemies?: number;
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
  let width: number | undefined;
  let height: number | undefined;
  let redKeys: number | undefined;
  let redDoors: number | undefined;
  let blueKeys: number | undefined;
  let blueDoors: number | undefined;
  let yellowKeys: number | undefined;
  let yellowDoors: number | undefined;
  let enemies: number | undefined;
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

    if (flag === "--width") {
      width = parseInteger(value, flag);
      index += 1;
      continue;
    }

    if (flag === "--height") {
      height = parseInteger(value, flag);
      index += 1;
      continue;
    }

    if (flag === "--red-keys") {
      redKeys = parseInteger(value, flag);
      index += 1;
      continue;
    }

    if (flag === "--red-doors") {
      redDoors = parseInteger(value, flag);
      index += 1;
      continue;
    }

    if (flag === "--blue-keys") {
      blueKeys = parseInteger(value, flag);
      index += 1;
      continue;
    }

    if (flag === "--blue-doors") {
      blueDoors = parseInteger(value, flag);
      index += 1;
      continue;
    }

    if (flag === "--yellow-keys") {
      yellowKeys = parseInteger(value, flag);
      index += 1;
      continue;
    }

    if (flag === "--yellow-doors") {
      yellowDoors = parseInteger(value, flag);
      index += 1;
      continue;
    }

    if (flag === "--enemies") {
      enemies = parseInteger(value, flag);
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
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
    ...(redKeys === undefined ? {} : { redKeys }),
    ...(redDoors === undefined ? {} : { redDoors }),
    ...(blueKeys === undefined ? {} : { blueKeys }),
    ...(blueDoors === undefined ? {} : { blueDoors }),
    ...(yellowKeys === undefined ? {} : { yellowKeys }),
    ...(yellowDoors === undefined ? {} : { yellowDoors }),
    ...(enemies === undefined ? {} : { enemies }),
    ...(output === undefined ? {} : { output }),
  };
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    process.stdout.write(
      "Usage: npm run generate:floor-set -- --seed <integer> --floors <positive integer>" +
        " [--width <odd integer>=5] [--height <odd integer>=5]" +
        " [--red-keys <candidate total>] [--red-doors <candidate total>]" +
        " [--blue-keys <candidate total>] [--blue-doors <candidate total>]" +
        " [--yellow-keys <candidate total>] [--yellow-doors <candidate total>]" +
        " [--enemies <candidate total>] [--output <path>]\n",
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

/**
 * One address in, one picture out.
 *
 * The other capture command shoots a curated list and rotates its output so a scene can be compared
 * with its own past. This one answers the other question — "show me what this page looks like" — for
 * any address the development server serves: a named map, a workbench, anything. It rotates nothing,
 * compares nothing, and writes outside the directories the harness rotates, so taking a picture can
 * never destroy the comparison the harness exists to produce.
 *
 * It asserts nothing and returns no verdict about what it photographed.
 * `dev/agent_rules/test_operations.md` owns that line, and it applies here exactly as it does to the
 * harness: this may observe and must not judge.
 *
 * It starts its own dev server by default — never the user-owned 5273 — because a tool whose
 * behaviour depends on a server it does not own fails differently depending on what else is open.
 * `--port` attaches to a server that is already running instead, and then photographs whatever that
 * server is serving, from whichever working tree it was started in.
 *
 * Usage: node dev/tools/capture-page.mjs <address> [--out <file>] [--seed 42] [--wait <selector>]
 *        [--frames 30] [--port <port>] [--aim nearest|<degrees>]
 *
 * Output: capture-output/adhoc/<address>.png unless --out says otherwise.
 *
 * On Windows, run it from PowerShell. Git Bash rewrites an argument beginning with a slash into a
 * Windows path before Node ever sees it, so `/debug/map-workbench` arrives as something under the
 * Git installation; the address check catches it and says so, but the picture is not taken.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  DEMO_WORLD_READY,
  PAGE_LOAD_READY,
  ROOT,
  openBrowser,
  openPage,
  selectorReady,
  settleFrames,
  startDevServer,
  waitForServer,
} from "./capture/browser.mjs";

const ADHOC_OUTPUT = path.join(ROOT, "capture-output", "adhoc");
const USAGE =
  "Usage: node dev/tools/capture-page.mjs <address> [--out <file>] [--seed 42] [--wait <selector>] [--frames 30] [--port <port>] [--aim nearest|<degrees>]";

function parseAim(value) {
  if (value === "nearest") {
    return { kind: "nearest" };
  }

  const degrees = Number.parseFloat(value ?? "");

  if (!Number.isFinite(degrees)) {
    throw new Error('--aim takes "nearest" or a heading in degrees.');
  }

  return { degrees, kind: "heading" };
}

function parseInteger(value, flag) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${flag} takes an integer.`);
  }

  return parsed;
}

function parseArguments(argv) {
  const options = {
    address: undefined,
    aim: undefined,
    frames: 30,
    out: undefined,
    port: undefined,
    seed: 42,
    wait: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--out") {
      options.out = argv[index + 1];
      index += 1;
    } else if (argument === "--seed") {
      options.seed = parseInteger(argv[index + 1], "--seed");
      index += 1;
    } else if (argument === "--wait") {
      options.wait = argv[index + 1];
      index += 1;
    } else if (argument === "--frames") {
      options.frames = parseInteger(argv[index + 1], "--frames");
      index += 1;
    } else if (argument === "--port") {
      options.port = parseInteger(argv[index + 1], "--port");
      index += 1;
    } else if (argument === "--aim") {
      options.aim = parseAim(argv[index + 1]);
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown argument: ${argument}\n${USAGE}`);
    } else if (options.address === undefined) {
      options.address = argument;
    } else {
      throw new Error(`Only one address can be photographed at a time.\n${USAGE}`);
    }
  }

  if (options.address === undefined) {
    throw new Error(`An address is required, such as "/?map=circle-water".\n${USAGE}`);
  }

  return options;
}

/**
 * A filename derived from the address, so photographing the same page twice replaces one picture
 * rather than accumulating a directory of near-identical ones.
 */
function fileNameFor(address) {
  const slug = address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug === "" ? "play" : slug}.png`;
}

/**
 * The play surface publishes a development handle when the world exists; nothing else does. So an
 * address naming the game's own path waits for it, and any other page waits for its own load unless
 * the caller names something better to wait for.
 */
function readinessFor(address, selector) {
  if (selector !== undefined) {
    return selectorReady(selector);
  }

  return new URL(address, "http://localhost").pathname === "/" ? DEMO_WORLD_READY : PAGE_LOAD_READY;
}

/**
 * Turning the camera, and nothing else.
 *
 * Without it a picture of an empty room is a picture of a wall. Anything past aiming — walking,
 * fighting, picking something up — is what a curated scene is for, and this command presses no keys
 * at all, which is also what keeps it unable to reach the authoring endpoint's save operation.
 */
async function aimCamera(page, aim) {
  const outcome = await page.evaluate((request) => {
    const world = window.demoWorld;

    if (!world) {
      return "no-handle";
    }

    if (request.kind === "heading") {
      world.player.angle = (request.degrees * Math.PI) / 180;
      world.player.pitch = 0;
      return "aimed";
    }

    if (request.kind === "nearest") {
      if (world.enemies.length === 0) {
        return "no-enemies";
      }

      let nearest = world.enemies[0];
      let nearestDistance = Infinity;

      for (const enemy of world.enemies) {
        const distance = (enemy.x - world.player.x) ** 2 + (enemy.y - world.player.y) ** 2;

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = enemy;
        }
      }

      world.player.angle = Math.atan2(nearest.y - world.player.y, nearest.x - world.player.x);
      world.player.pitch = 0;
      return "aimed";
    }

    return "unknown-aim";
  }, aim);

  if (outcome === "no-handle") {
    console.warn("Nothing to aim: this page publishes no world handle. Taking the picture as it is.");
  } else if (outcome === "no-enemies") {
    console.warn("Nothing to aim at: no enemies are alive. Taking the picture as it is.");
  } else if (outcome === "unknown-aim") {
    throw new Error(`Unknown aim kind: ${aim.kind}`);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const attached = options.port !== undefined;
  let server;

  if (attached) {
    server = { baseUrl: `http://localhost:${options.port}`, stop: () => {} };
    console.log(`Attaching to the server on port ${options.port}; whatever it is serving is what gets photographed.`);
    await waitForServer(server.baseUrl, {
      attempts: 8,
      description: `Nothing is serving port ${options.port}`,
    });
  } else {
    console.log("Starting a dev server on a free port (5273 stays untouched) ...");
    server = await startDevServer();
  }

  let browser;

  try {
    browser = await openBrowser(options.seed);
    // Nothing is hidden: the harness hides the instrument panel because a curated picture judges the
    // game's own frame, and this command photographs the page as served.
    const page = await openPage(browser.context, server.baseUrl, options.address, {
      readiness: readinessFor(options.address, options.wait),
    });

    if (options.aim !== undefined) {
      await aimCamera(page, options.aim);
    }

    await settleFrames(page, options.frames);

    const output = options.out
      ? path.resolve(process.cwd(), options.out)
      : path.join(ADHOC_OUTPUT, fileNameFor(options.address));
    await mkdir(path.dirname(output), { recursive: true });
    await page.screenshot({ path: output });
    console.log(`Wrote ${path.relative(ROOT, output) || output}`);
  } finally {
    await browser?.close();
    server.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

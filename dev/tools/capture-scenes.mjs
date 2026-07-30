/**
 * Screenshot harness for the demo: fixed scenes, seeded random, side-by-side output.
 *
 * Starts its own Vite dev server on a free port — never the user-owned 5273 — drives the demo in a
 * headless Chromium through the same debug keys a person uses, and writes one PNG per scene plus a
 * contact sheet comparing this run against the previous one. There are no assertions anywhere in
 * here: the demo is verified by looking, and this tool exists to do the looking without a person
 * driving the browser. `dev/agent_rules/test_operations.md` owns that line.
 *
 * Determinism comes from replacing `Math.random` with a seeded generator before the page loads, so
 * the same seed grows the same floor on every run and two captures of a scene differ only by the
 * change being judged.
 *
 * Usage: node dev/tools/capture-scenes.mjs [--seed 42] [--scene <name>]
 *
 * Output: capture-output/latest/<scene>.png, capture-output/latest/stats.json, and
 * capture-output/index.html; the previous run is rotated into capture-output/previous/ first.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { contactSheetHtml } from "./capture/contact-sheet.mjs";
import { SCENES } from "./capture/scenes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUTPUT_ROOT = path.join(ROOT, "capture-output");
const VITE_BIN = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
const VIEWPORT = { width: 1280, height: 720 };
/** Frames the FPS sample spans; two seconds at sixty, long enough to catch a stutter. */
const FPS_SAMPLE_FRAMES = 120;

function parseArguments(argv) {
  const options = { seed: 42, scene: undefined };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--seed") {
      options.seed = Number.parseInt(argv[index + 1] ?? "", 10);
      index += 1;
    } else if (argv[index] === "--scene") {
      options.scene = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argv[index]}`);
    }
  }

  if (!Number.isInteger(options.seed)) {
    throw new Error("--seed takes an integer.");
  }

  return options;
}

/** Asks the operating system for a free ephemeral port, so 5273 is never contested. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // Not up yet; keep waiting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Dev server did not answer at ${url} within 30 seconds.`);
}

/**
 * Mulberry32 as an init script, replacing `Math.random` before any module runs.
 *
 * Page-level rather than a code change: every random call site in the demo flows through
 * `Math.random`, so seeding here makes floor generation deterministic without the shipped code
 * learning that seeds exist.
 */
function seedScript(seed) {
  return `(() => {
  let state = ${seed} >>> 0;
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;
}

/** Waits `frames` animation frames inside the page, so "settle" is frame-time rather than wall-time. */
function settleFrames(page, frames) {
  return page.evaluate(
    (count) =>
      new Promise((resolve) => {
        let seen = 0;
        const step = () => {
          seen += 1;

          if (seen >= count) {
            resolve(undefined);
          } else {
            requestAnimationFrame(step);
          }
        };
        requestAnimationFrame(step);
      }),
    frames,
  );
}

function sampleFps(page) {
  return page.evaluate(
    (frames) =>
      new Promise((resolve) => {
        const deltas = [];
        let last = performance.now();
        const step = (now) => {
          deltas.push(now - last);
          last = now;

          if (deltas.length >= frames) {
            const average = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
            const worst = Math.max(...deltas);
            resolve({ avgFps: Math.round(1000 / average), minFps: Math.round(1000 / worst) });
          } else {
            requestAnimationFrame(step);
          }
        };
        requestAnimationFrame(step);
      }),
    FPS_SAMPLE_FRAMES,
  );
}

function worldSnapshot(page) {
  return page.evaluate(() => {
    const world = window.demoWorld;

    if (!world) {
      return undefined;
    }

    return {
      depth: world.depth,
      enemies: world.enemies.length,
      held: world.held ? (world.held.kind === "enemy" ? world.held.enemy.archetype.id : world.held.prop) : undefined,
      hp: Math.round(world.player.hp),
      maxHp: world.player.maxHp,
    };
  });
}

async function captureScene(context, baseUrl, scene) {
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/?capture=1`);
    await page.waitForFunction(() => window.demoWorld !== undefined, undefined, { timeout: 30_000 });
    // The instrument panel is for a person at the keyboard; a screenshot judging the game's own
    // picture should not have the tooling in frame.
    await page.addStyleTag({ content: ".demo-dev { display: none !important; }" });
    await settleFrames(page, 10);

    const helpers = {
      // Spawn faces whatever wall the entrance happens to face; a scene about the crowd has to be
      // looking at it. Turning the head through the published dev handle, not through mouse deltas,
      // keeps the aim exact and the same on every run.
      faceNearestEnemy: () =>
        page.evaluate(() => {
          const world = window.demoWorld;

          if (!world || world.enemies.length === 0) {
            return;
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
        }),
      press: (key) => page.keyboard.press(key),
      rightClickCentre: () => page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2, { button: "right" }),
      settle: (frames) => settleFrames(page, frames),
      wait: (milliseconds) => page.waitForTimeout(milliseconds),
    };
    await scene.setup(helpers);

    const fps = scene.sampleFps ? await sampleFps(page) : undefined;
    const world = await worldSnapshot(page);
    await page.screenshot({ path: path.join(OUTPUT_ROOT, "latest", `${scene.name}.png`) });

    return { name: scene.name, note: scene.note, ...(fps ? { fps } : {}), ...(world ? { world } : {}) };
  } finally {
    await page.close();
  }
}

async function rotateOutput() {
  const latest = path.join(OUTPUT_ROOT, "latest");
  const previous = path.join(OUTPUT_ROOT, "previous");

  if (existsSync(latest)) {
    await rm(previous, { force: true, recursive: true });
    await rename(latest, previous);
  }

  await mkdir(latest, { recursive: true });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const scenes = options.scene ? SCENES.filter((scene) => scene.name === options.scene) : SCENES;

  if (scenes.length === 0) {
    throw new Error(`No scene named "${options.scene}". Known scenes: ${SCENES.map((s) => s.name).join(", ")}`);
  }

  const port = await freePort();
  const baseUrl = `http://localhost:${port}`;
  console.log(`Starting dev server on ${baseUrl} (5273 stays untouched) ...`);
  const server = spawn(process.execPath, [VITE_BIN, "--port", String(port)], { cwd: ROOT, stdio: "pipe" });
  const serverFailure = new Promise((_, reject) => {
    server.on("error", reject);
    server.on("exit", (code) => reject(new Error(`Dev server exited early with code ${code}.`)));
  });

  let browser;

  try {
    await Promise.race([waitForServer(baseUrl), serverFailure]);
    browser = await chromium.launch();
    const context = await browser.newContext({ deviceScaleFactor: 1, viewport: VIEWPORT });
    await context.addInitScript(seedScript(options.seed));
    await rotateOutput();

    const results = [];

    for (const scene of scenes) {
      console.log(`Capturing ${scene.name} ...`);
      // Every scene gets a fresh page: the same seed then grows the same floor, so scenes are
      // comparable with each other and with their own past runs.
      results.push(await captureScene(context, baseUrl, scene));
    }

    const stamp = new Date().toISOString();
    await writeFile(
      path.join(OUTPUT_ROOT, "latest", "stats.json"),
      `${JSON.stringify({ captured: stamp, seed: options.seed, scenes: results }, undefined, 2)}\n`,
    );
    await writeFile(
      path.join(OUTPUT_ROOT, "index.html"),
      contactSheetHtml(results, `seed ${options.seed} · captured ${stamp}`),
    );
    console.log(
      `Wrote ${results.length} scene(s) to capture-output/latest/ and the contact sheet to capture-output/index.html`,
    );
  } finally {
    await browser?.close();
    server.kill();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

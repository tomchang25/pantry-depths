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
 * change being judged. The browser work itself lives in `./capture/browser.mjs`, shared with the
 * ad-hoc command; a scene may point at any address that server serves.
 *
 * Usage: node dev/tools/capture-scenes.mjs [--seed 42] [--scene <name>]
 *
 * Output: capture-output/latest/<scene>.png, capture-output/latest/stats.json, and
 * capture-output/index.html; the previous run is rotated into capture-output/previous/ first. A
 * picture taken by the ad-hoc command lives outside both directories and survives this rotation.
 */

import { existsSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { contactSheetHtml } from "./capture/contact-sheet.mjs";
import {
  DEMO_WORLD_READY,
  ROOT,
  VIEWPORT,
  openBrowser,
  openPage,
  selectorReady,
  settleFrames,
  startDevServer,
} from "./capture/browser.mjs";
import { SCENES } from "./capture/scenes.mjs";

const OUTPUT_ROOT = path.join(ROOT, "capture-output");
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
  // A scene that names no address photographs the play surface, and one that names no selector waits
  // for the handle only the play surface publishes. Both defaults are what every scene did before a
  // scene could say otherwise.
  const readiness = scene.readySelector ? selectorReady(scene.readySelector) : DEMO_WORLD_READY;
  const page = await openPage(context, baseUrl, scene.address ?? "/", { hideInstruments: true, readiness });

  try {
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

  console.log("Starting a dev server on a free port (5273 stays untouched) ...");
  const server = await startDevServer();
  let browser;

  try {
    browser = await openBrowser(options.seed);
    await rotateOutput();

    const results = [];

    for (const scene of scenes) {
      console.log(`Capturing ${scene.name} ...`);
      // Every scene gets a fresh page: the same seed then grows the same floor, so scenes are
      // comparable with each other and with their own past runs.
      results.push(await captureScene(browser.context, server.baseUrl, scene));
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
    server.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

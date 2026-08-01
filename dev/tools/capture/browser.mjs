/**
 * The browser work both capture commands need: a server of our own, a seeded page, and a way to wait
 * for a page that is not the play surface.
 *
 * Two commands photograph this project. `dev/tools/capture-scenes.mjs` shoots a curated list and
 * rotates its output so a scene can be compared with its own past; `dev/tools/capture-page.mjs`
 * takes one address and writes one picture. Everything they agree about lives here, so the two
 * cannot drift apart on which port they take, how they seed randomness, or what "ready" means.
 *
 * Nothing in this file asserts anything. `dev/agent_rules/test_operations.md` owns that line: these
 * tools may observe and must not judge.
 */

import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const VIEWPORT = { width: 1280, height: 720 };

const VITE_BIN = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
/** How long a page has to become ready before the wait is called a failure. */
const READINESS_TIMEOUT_MS = 30_000;
/** The instrument panel is for a person at the keyboard, so a curated picture hides it. */
const INSTRUMENT_PANEL_HIDDEN = ".demo-dev { display: none !important; }";

/** Asks the operating system for a free ephemeral port, so 5273 is never contested. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

export async function waitForServer(url, { attempts = 120, intervalMs = 250, description = "Dev server" } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // Not up yet; keep waiting.
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const seconds = Math.round((attempts * intervalMs) / 1000);
  throw new Error(`${description} did not answer at ${url} within ${seconds} seconds.`);
}

/**
 * Starts a Vite server on a port the operating system picks.
 *
 * Never 5273: a port the user is using is not a tool's to claim, and a tool whose behaviour depends
 * on a server it does not own fails differently depending on what else is open.
 */
export async function startDevServer() {
  const port = await freePort();
  const baseUrl = `http://localhost:${port}`;
  const server = spawn(process.execPath, [VITE_BIN, "--port", String(port)], { cwd: ROOT, stdio: "pipe" });
  const serverFailure = new Promise((_, reject) => {
    server.on("error", reject);
    server.on("exit", (code) => reject(new Error(`Dev server exited early with code ${code}.`)));
  });

  try {
    await Promise.race([waitForServer(baseUrl), serverFailure]);
  } catch (error) {
    server.kill();
    throw error;
  }

  return { baseUrl, stop: () => server.kill() };
}

/**
 * Mulberry32 as an init script, replacing `Math.random` before any module runs.
 *
 * Page-level rather than a code change: every random call site in the demo flows through
 * `Math.random`, so seeding here makes floor generation deterministic without the shipped code
 * learning that seeds exist. It has to be a context init script — added after navigation it would
 * seed nothing that has already generated a floor.
 */
export function seedScript(seed) {
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
export function settleFrames(page, frames) {
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

/** A headless Chromium with the seed already installed, at the one viewport every picture uses. */
export async function openBrowser(seed) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 1, viewport: VIEWPORT });
  await context.addInitScript(seedScript(seed));

  return { browser, context, close: () => browser.close() };
}

/** Waits for the play surface's development handle: what a page showing the game publishes. */
export const DEMO_WORLD_READY = { kind: "demoWorld" };
/** Waits for nothing beyond the navigation itself, which already waits for the load event. */
export const PAGE_LOAD_READY = { kind: "load" };
/** Waits for an element to appear: what a page that is not the play surface has instead. */
export function selectorReady(selector) {
  return { kind: "selector", selector };
}

function readinessDescription(readiness) {
  if (readiness.kind === "demoWorld") {
    return "the play surface's development handle";
  }

  if (readiness.kind === "selector") {
    return `an element matching "${readiness.selector}"`;
  }

  if (readiness.kind === "load") {
    return "the page's own load event";
  }

  throw new Error(`Unknown readiness kind: ${readiness.kind}`);
}

async function awaitReadiness(page, readiness) {
  if (readiness.kind === "demoWorld") {
    await page.waitForFunction(() => window.demoWorld !== undefined, undefined, { timeout: READINESS_TIMEOUT_MS });
    return;
  }

  if (readiness.kind === "selector") {
    await page.waitForSelector(readiness.selector, { timeout: READINESS_TIMEOUT_MS });
    return;
  }

  if (readiness.kind === "load") {
    return;
  }

  throw new Error(`Unknown readiness kind: ${readiness.kind}`);
}

/**
 * The address to navigate to, with the capture flag on it.
 *
 * The flag is not decoration and not inert: `src/demo/demo-surface.ts` reads it on a development
 * build and treats the pointer as locked from the first frame. Pointer lock needs a user gesture a
 * headless browser cannot make, so without it the play surface waits for a click that never comes.
 * Adding it here rather than in every scene means nobody can forget it and photograph the wait.
 * An address that already names the flag keeps whatever value it gave.
 */
export function pageUrl(baseUrl, address) {
  const base = `${baseUrl}/`;
  const url = new URL(address === "" ? "/" : address, base);

  if (url.origin !== new URL(base).origin) {
    throw new Error(`Address "${address}" points outside ${baseUrl}; these tools photograph this project's server.`);
  }

  if (!url.searchParams.has("capture")) {
    url.searchParams.set("capture", "1");
  }

  return url.toString();
}

/** Opens one page at one address and returns it once the page says it is ready. */
export async function openPage(
  context,
  baseUrl,
  address,
  { readiness = DEMO_WORLD_READY, hideInstruments = false } = {},
) {
  const page = await context.newPage();
  const url = pageUrl(baseUrl, address);

  try {
    await page.goto(url);
    await awaitReadiness(page, readiness);
  } catch (error) {
    await page.close();
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${url} never became ready, waiting for ${readinessDescription(readiness)}. ${reason}`);
  }

  if (hideInstruments) {
    await page.addStyleTag({ content: INSTRUMENT_PANEL_HIDDEN });
  }

  return page;
}

import { defineConfig, devices } from "@playwright/test";

// `vite.config.ts` pins 5273 with `strictPort`, so a run cannot silently move to another port.
// `PLAYWRIGHT_PORT` exists for the isolation rule in `dev/agent_rules/test_operations.md`: when 5273
// is already owned by someone else's development server, pass an alternate port to this run instead
// of editing the pinned configuration.
const port = process.env.PLAYWRIGHT_PORT ?? "5273";
// `localhost`, not `127.0.0.1`: Vite's default host binds the loopback name, which resolves to `::1`
// first on Windows, so a literal IPv4 base URL cannot reach a development server that is already
// running and would make `reuseExistingServer` start a second one against the pinned port.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./test/e2e",
  // The suite is deliberately small and every spec drives the same development server, whose
  // authoring endpoint spawns a child process per request. Serial keeps that contention out of the
  // results; parallelism would buy nothing at this size.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});

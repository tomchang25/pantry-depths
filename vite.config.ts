import { spawn } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import type { IncomingMessage } from "node:http";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

import { FLOOR_AUTHORING_API_ROOT } from "./dev/tools/floor-set/api-contract";

const FLOOR_AUTHORING_RUNNER_PATH = fileURLToPath(new URL("./node_modules/vite-node/vite-node.mjs", import.meta.url));
const FLOOR_AUTHORING_SCRIPT_PATH = fileURLToPath(
  new URL("./dev/tools/run-floor-authoring-request.ts", import.meta.url),
);
const FLOOR_TOOL_CONFIG_PATH = fileURLToPath(new URL("./dev/tools/vite-node.config.ts", import.meta.url));

type FloorAuthoringResponse = Readonly<{ status: number; body: unknown }>;

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > 1_000_000) {
      throw new Error("Floor authoring request exceeds the 1 MB limit.");
    }

    chunks.push(buffer);
  }

  return chunks.length === 0 ? undefined : (JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
}

function runFloorAuthoringRequest(request: Readonly<{ method: string; pathname: string; body?: unknown }>) {
  return new Promise<FloorAuthoringResponse>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [FLOOR_AUTHORING_RUNNER_PATH, "--config", FLOOR_TOOL_CONFIG_PATH, FLOOR_AUTHORING_SCRIPT_PATH],
      {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    const standardOutput: Buffer[] = [];
    const standardError: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => standardOutput.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => standardError.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(Buffer.concat(standardError).toString("utf8") || `Floor authoring runner exited with ${code}.`),
        );
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(standardOutput).toString("utf8")) as FloorAuthoringResponse);
      } catch (caught) {
        reject(caught);
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

function floorAuthoringPlugin(): Plugin {
  return {
    name: "pantry-floor-authoring",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        void (async () => {
          try {
            const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

            if (!pathname.startsWith(`${FLOOR_AUTHORING_API_ROOT}/`)) {
              next();
              return;
            }

            const body = request.method === "POST" ? await readJsonBody(request) : undefined;
            const result = await runFloorAuthoringRequest({
              method: request.method ?? "GET",
              pathname,
              ...(body === undefined ? {} : { body }),
            });

            response.statusCode = result.status;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify(result.body));
          } catch (caught) {
            const message = caught instanceof Error ? caught.message : "Unable to parse floor authoring request.";
            response.statusCode = 400;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify({ message }));
          }
        })();
      });
    },
  };
}

export default defineConfig({
  plugins: [floorAuthoringPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5273,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    target: "es2022",
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        // Standalone real-time demo surface; shares only the renderer with the ordinary game.
        demo: fileURLToPath(new URL("./demo.html", import.meta.url)),
      },
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});

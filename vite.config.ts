import { spawn } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import type { IncomingMessage } from "node:http";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

import { AUTHORING_API_ROOT, CANONICAL_AUTHORING_PATHS } from "./dev/tools/authoring/api-contract";

const AUTHORING_RUNNER_PATH = fileURLToPath(new URL("./node_modules/vite-node/vite-node.mjs", import.meta.url));
const AUTHORING_SCRIPT_PATH = fileURLToPath(new URL("./dev/tools/run-authoring-request.ts", import.meta.url));
const FLOOR_TOOL_CONFIG_PATH = fileURLToPath(new URL("./dev/tools/vite-node.config.ts", import.meta.url));

type AuthoringResponse = Readonly<{ status: number; body: unknown }>;

/**
 * The canonical authored files, which the dev server deliberately does not watch.
 *
 * Saving from a workbench writes one of these, and they live under `src/` where a module imports them —
 * so the write used to look to Vite exactly like an edit. JSON has no hot-update boundary and nothing in
 * the chain accepts one, so the fallback fired and the whole page reloaded: every slider back to its
 * loaded value, the selected subject lost, and any other tab reloaded too, including a game mid-run.
 *
 * Nothing is given up by not watching them. The endpoint validates before it writes, so a file that
 * could not be loaded back cannot be written in the first place, and the tool that saved already has the
 * new values on screen. Reading the file back is a button in each workbench rather than something the
 * watcher does behind everyone's back.
 *
 * Derived from the whitelist so a target added later is covered without anybody remembering to. A
 * directory target becomes a glob over the directory, because the files in one are not known in
 * advance — being able to add one without restarting anything is the point of a library.
 */
const UNWATCHED_AUTHORED_FILES = Object.values(CANONICAL_AUTHORING_PATHS).map((entry) => {
  const file = "file" in entry ? entry.file : `${entry.directory}/`;
  // The watcher matches with picomatch, which only speaks posix, so a Windows path is spelled forwards.
  const absolute = fileURLToPath(new URL(file, import.meta.url)).replaceAll("\\", "/");
  return "file" in entry ? absolute : `${absolute}**`;
});

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > 1_000_000) {
      throw new Error("Authoring request exceeds the 1 MB limit.");
    }

    chunks.push(buffer);
  }

  return chunks.length === 0 ? undefined : (JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
}

function runAuthoringRequest(request: Readonly<{ method: string; pathname: string; body?: unknown }>) {
  return new Promise<AuthoringResponse>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [AUTHORING_RUNNER_PATH, "--config", FLOOR_TOOL_CONFIG_PATH, AUTHORING_SCRIPT_PATH],
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
        reject(new Error(Buffer.concat(standardError).toString("utf8") || `Authoring runner exited with ${code}.`));
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(standardOutput).toString("utf8")) as AuthoringResponse);
      } catch (caught) {
        reject(caught);
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

function authoringPlugin(): Plugin {
  return {
    name: "pantry-authoring",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        void (async () => {
          try {
            const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

            if (!pathname.startsWith(`${AUTHORING_API_ROOT}/`)) {
              next();
              return;
            }

            const body = request.method === "POST" ? await readJsonBody(request) : undefined;
            const result = await runAuthoringRequest({
              method: request.method ?? "GET",
              pathname,
              ...(body === undefined ? {} : { body }),
            });

            response.statusCode = result.status;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify(result.body));
          } catch (caught) {
            const message = caught instanceof Error ? caught.message : "Unable to parse authoring request.";
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
  plugins: [authoringPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5273,
    strictPort: true,
    watch: {
      ignored: UNWATCHED_AUTHORED_FILES,
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
      },
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
